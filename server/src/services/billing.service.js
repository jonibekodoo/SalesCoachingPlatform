import { q, tx } from '../db.js';
import { config } from '../config.js';
import { newId, nowIso } from '../util/ids.js';
import { HttpError } from '../middleware/errors.js';

/** Billing unit: every started minute counts as a full minute */
export const billableSeconds = (durationSeconds) => {
  const unit = config.billingUnitSeconds;
  const s = Math.max(0, Number(durationSeconds) || 0);
  return Math.max(unit, Math.ceil(s / unit) * unit);
};

export const balanceOf = (companyId) =>
  q.one('SELECT COALESCE(SUM(amount), 0) AS balance FROM ledger WHERE company_id = ?', companyId).balance;

/** Marks expired packages, then returns the subscription that pays for the next call */
export const activeSubscription = (companyId) => {
  const now = nowIso();
  q.run(
    "UPDATE subscriptions SET status = 'expired' WHERE company_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < ?",
    companyId,
    now
  );
  // Oldest active package first, then a per-minute plan
  return q.one(
    `SELECT * FROM subscriptions WHERE company_id = ? AND status = 'active'
     ORDER BY CASE type WHEN 'package' THEN 0 ELSE 1 END, started_at ASC LIMIT 1`,
    companyId
  );
};

export const subscriptionView = (s) =>
  s && {
    id: s.id,
    planId: s.plan_id,
    planName: s.plan_name,
    type: s.type,
    pricePerMinute: s.price_per_minute,
    includedMinutes: Math.round(s.included_seconds / 60),
    usedMinutes: Math.round((s.used_seconds / 60) * 100) / 100,
    remainingMinutes: s.type === 'package' ? Math.max(0, Math.round(((s.included_seconds - s.used_seconds) / 60) * 100) / 100) : null,
    price: s.price,
    startedAt: s.started_at,
    expiresAt: s.expires_at,
    status: s.status,
  };

/** Account snapshot shown to the CRM (GET /api/v1/account) and in the admin panel */
export const accountState = (company) => {
  const sub = activeSubscription(company.id);
  const balance = balanceOf(company.id);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const month = q.one(
    `SELECT COUNT(*) AS calls, COALESCE(SUM(billed_seconds), 0) AS billed, COALESCE(SUM(cost), 0) AS cost
     FROM analyses WHERE company_id = ? AND status = 'done' AND created_at >= ?`,
    company.id,
    monthStart.toISOString()
  );
  let remainingMinutes = null;
  if (sub?.type === 'package') remainingMinutes = Math.max(0, (sub.included_seconds - sub.used_seconds) / 60);
  else if (sub?.type === 'per_minute' && sub.price_per_minute > 0) remainingMinutes = Math.max(0, Math.floor(balance / sub.price_per_minute));
  const pending = q.one("SELECT * FROM subscriptions WHERE company_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", company.id);
  return {
    companyId: company.id,
    companyName: company.name,
    country: company.country,
    status: company.status,
    subscription: subscriptionView(sub),
    pendingSubscription: subscriptionView(pending),
    balance,
    remainingMinutes: remainingMinutes === null ? null : Math.round(remainingMinutes * 100) / 100,
    thisMonth: { calls: month.calls, minutes: Math.round(month.billed / 60), cost: month.cost },
    canAnalyze: company.status === 'active' && !!sub && (sub.type === 'package' ? sub.included_seconds > sub.used_seconds : balance > 0),
  };
};

/**
 * Checks that the company may analyze `durationSeconds` of audio.
 * Returns { subscription, billedSeconds, cost } or throws a 402 HttpError.
 */
export const checkAllowance = (company, durationSeconds) => {
  if (company.status === 'pending') {
    throw new HttpError(403, 'Toʻlov tasdiqlanmagan, kompaniya hali ochilmagan', { code: 'COMPANY_PENDING' });
  }
  if (company.status !== 'active') {
    throw new HttpError(403, 'Kompaniya hisobi toʻxtatilgan', { code: 'COMPANY_SUSPENDED' });
  }
  const sub = activeSubscription(company.id);
  if (!sub) {
    throw new HttpError(402, 'Tarif tanlanmagan. Administrator bilan bogʻlaning.', { code: 'NO_PLAN' });
  }
  const billed = billableSeconds(durationSeconds);
  if (sub.type === 'package') {
    const remaining = sub.included_seconds - sub.used_seconds;
    if (remaining < billed) {
      throw new HttpError(402, 'Paket limiti tugadi', {
        code: 'LIMIT_EXCEEDED',
        remainingMinutes: Math.max(0, Math.floor(remaining / 60)),
        requiredMinutes: billed / 60,
      });
    }
    return { subscription: sub, billedSeconds: billed, cost: 0 };
  }
  const cost = (billed / 60) * sub.price_per_minute;
  const balance = balanceOf(company.id);
  if (balance < cost) {
    throw new HttpError(402, 'Balans yetarli emas', {
      code: 'INSUFFICIENT_BALANCE',
      balance,
      requiredAmount: cost,
    });
  }
  return { subscription: sub, billedSeconds: billed, cost };
};

/** Debits the call after a successful analysis (inside the caller's transaction) */
export const charge = ({ company, subscription, billedSeconds, cost, analysisId }) => {
  if (subscription.type === 'package') {
    const used = subscription.used_seconds + billedSeconds;
    const exhausted = used >= subscription.included_seconds;
    q.run("UPDATE subscriptions SET used_seconds = ?, status = CASE WHEN ? THEN 'exhausted' ELSE status END WHERE id = ?", used, exhausted ? 1 : 0, subscription.id);
  } else if (cost > 0) {
    q.run(
      'INSERT INTO ledger(id, company_id, amount, kind, note, analysis_id, created_at) VALUES(?,?,?,?,?,?,?)',
      newId('led'),
      company.id,
      -Math.round(cost),
      'charge',
      `Tahlil ${Math.round(billedSeconds / 60)} daqiqa`,
      analysisId,
      nowIso()
    );
  }
};

/** Ledger line for a package purchase: revenue is tracked on the subscription, the balance is untouched */
const recordPackagePayment = (companyId, { paid, note, subscriptionId = null, method = '', paidAt = null }) => {
  const id = newId('led');
  const now = nowIso();
  q.run(
    'INSERT INTO ledger(id, company_id, amount, kind, note, analysis_id, created_at, paid, subscription_id, method, paid_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    id,
    companyId,
    0,
    'package',
    note,
    null,
    now,
    Math.round(paid),
    subscriptionId,
    method,
    paidAt || now
  );
  return id;
};

/**
 * Admin: subscribe a company to a plan.
 * activate=false creates a "pending" subscription that opens only after the payment is confirmed (activateSubscription).
 * paidAmount: for a package the amount actually paid (defaults to the plan price); for a per-minute plan the first top-up.
 */
export const subscribe = (company, plan, { note = '', activate = true, paidAmount } = {}) =>
  tx(() => {
    const now = new Date();
    const id = newId('sub');
    let expiresAt = null;
    if (activate && plan.type === 'package' && plan.validity_days) {
      expiresAt = new Date(now.getTime() + plan.validity_days * 86400000).toISOString();
    }
    if (activate && plan.type === 'per_minute') {
      // Only one per-minute tariff at a time
      q.run("UPDATE subscriptions SET status = 'cancelled' WHERE company_id = ? AND type = 'per_minute' AND status = 'active'", company.id);
    }
    const price = plan.type === 'package' ? (paidAmount === undefined || paidAmount === null ? plan.price : Math.round(paidAmount)) : 0;
    q.run(
      `INSERT INTO subscriptions(id, company_id, plan_id, plan_name, type, price_per_minute, included_seconds, used_seconds, price, started_at, expires_at, status, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      company.id,
      plan.id,
      plan.name,
      plan.type,
      plan.price_per_minute,
      plan.included_minutes * 60,
      0,
      price,
      now.toISOString(),
      expiresAt,
      activate ? 'active' : 'pending',
      now.toISOString()
    );
    if (activate) {
      if (plan.type === 'package' && price > 0) recordPackagePayment(company.id, { paid: price, note: note || `Paket: ${plan.name}`, subscriptionId: id });
      if (plan.type === 'per_minute' && paidAmount > 0) topUp(company, paidAmount, note || `Boshlangʻich toʻlov: ${plan.name}`, { subscriptionId: id });
    }
    return q.one('SELECT * FROM subscriptions WHERE id = ?', id);
  });

/** Admin confirms the payment of a pending subscription: the package starts now and the company is opened */
export const activateSubscription = (company, sub, { amount, note = '', method = '', paidAt = null } = {}) =>
  tx(() => {
    if (sub.status !== 'pending') throw new HttpError(400, 'Bu obuna toʻlov kutayotgan holatda emas');
    const plan = q.one('SELECT * FROM plans WHERE id = ?', sub.plan_id);
    const now = new Date();
    let expiresAt = null;
    if (sub.type === 'package' && plan?.validity_days) expiresAt = new Date(now.getTime() + plan.validity_days * 86400000).toISOString();
    const paid = amount === undefined || amount === null || amount === '' ? sub.price : Math.round(Number(amount));
    if (!Number.isFinite(paid) || paid < 0) throw new HttpError(400, 'Summa notoʻgʻri');
    if (sub.type === 'per_minute') {
      if (paid <= 0) throw new HttpError(400, 'Daqiqalik tarif uchun boshlangʻich toʻlov summasi kerak');
      q.run("UPDATE subscriptions SET status = 'cancelled' WHERE company_id = ? AND type = 'per_minute' AND status = 'active'", company.id);
    }
    q.run(
      "UPDATE subscriptions SET status = 'active', started_at = ?, expires_at = ?, price = ? WHERE id = ?",
      now.toISOString(),
      expiresAt,
      sub.type === 'package' ? paid : 0,
      sub.id
    );
    if (sub.type === 'package' && paid > 0) recordPackagePayment(company.id, { paid, note: note || `Paket toʻlovi: ${sub.plan_name}`, subscriptionId: sub.id, method, paidAt });
    if (sub.type === 'per_minute') topUp(company, paid, note || `Boshlangʻich toʻlov: ${sub.plan_name}`, { subscriptionId: sub.id, method, paidAt });
    if (company.status === 'pending') q.run("UPDATE companies SET status = 'active', updated_at = ? WHERE id = ?", now.toISOString(), company.id);
    return q.one('SELECT * FROM subscriptions WHERE id = ?', sub.id);
  });

export const topUp = (company, amount, note = '', { subscriptionId = null, method = '', paidAt = null } = {}) => {
  const id = newId('led');
  const now = nowIso();
  const rounded = Math.round(amount);
  q.run(
    'INSERT INTO ledger(id, company_id, amount, kind, note, analysis_id, created_at, paid, subscription_id, method, paid_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    id,
    company.id,
    rounded,
    rounded >= 0 ? 'topup' : 'adjustment',
    note,
    null,
    now,
    rounded >= 0 ? rounded : 0,
    subscriptionId,
    method,
    paidAt || now
  );
  return q.one('SELECT * FROM ledger WHERE id = ?', id);
};

export const paymentView = (l) =>
  l && {
    id: l.id,
    companyId: l.company_id,
    companyName: l.company_name,
    amount: l.amount,
    paid: l.paid || 0,
    kind: l.kind,
    note: l.note,
    method: l.method || '',
    paidAt: l.paid_at || l.created_at,
    createdAt: l.created_at,
    analysisId: l.analysis_id,
    subscriptionId: l.subscription_id,
    subscriptionName: l.subscription_name || null,
  };

const PAYMENT_SQL = `SELECT l.*, c.name AS company_name, s.plan_name AS subscription_name
  FROM ledger l JOIN companies c ON c.id = l.company_id LEFT JOIN subscriptions s ON s.id = l.subscription_id`;

export const listPayments = ({ companyId, kind, from, to, limit = 100, offset = 0 } = {}) => {
  const where = ["l.kind IN ('topup', 'package', 'adjustment')"];
  const params = [];
  if (companyId) {
    where.push('l.company_id = ?');
    params.push(companyId);
  }
  if (kind) {
    where.push('l.kind = ?');
    params.push(kind);
  }
  if (from) {
    where.push('COALESCE(l.paid_at, l.created_at) >= ?');
    params.push(from);
  }
  if (to) {
    where.push('COALESCE(l.paid_at, l.created_at) <= ?');
    params.push(to);
  }
  const w = `WHERE ${where.join(' AND ')}`;
  const items = q.all(`${PAYMENT_SQL} ${w} ORDER BY COALESCE(l.paid_at, l.created_at) DESC LIMIT ? OFFSET ?`, ...params, limit, offset).map(paymentView);
  const totals = q.one(
    `SELECT COUNT(*) AS n, COALESCE(SUM(l.paid),0) AS paid,
            COALESCE(SUM(CASE WHEN l.kind='topup' THEN l.paid ELSE 0 END),0) AS topups,
            COALESCE(SUM(CASE WHEN l.kind='package' THEN l.paid ELSE 0 END),0) AS packages,
            COALESCE(SUM(CASE WHEN l.kind='adjustment' THEN l.amount ELSE 0 END),0) AS adjustments
     FROM ledger l ${w}`,
    ...params
  );
  return { items, totals };
};

export const getPayment = (id) => paymentView(q.one(`${PAYMENT_SQL} WHERE l.id = ?`, id));

/** Edit a payment: the balance effect follows the paid amount for top-ups, the subscription price for packages */
export const updatePayment = (id, { amount, note, method, paidAt }) =>
  tx(() => {
    const l = q.one('SELECT * FROM ledger WHERE id = ?', id);
    if (!l) throw new HttpError(404, 'Toʻlov topilmadi');
    if (!['topup', 'package', 'adjustment'].includes(l.kind)) throw new HttpError(400, 'Faqat toʻlovlarni tahrirlash mumkin');
    let { amount: bal, paid } = l;
    if (amount !== undefined && amount !== null && amount !== '') {
      const n = Math.round(Number(amount));
      if (!Number.isFinite(n)) throw new HttpError(400, 'Summa notoʻgʻri');
      if (l.kind === 'package') {
        if (n < 0) throw new HttpError(400, 'Summa manfiy boʻlmasin');
        paid = n;
        if (l.subscription_id) q.run('UPDATE subscriptions SET price = ? WHERE id = ?', n, l.subscription_id);
      } else {
        bal = n;
        paid = n > 0 ? n : 0;
      }
    }
    q.run(
      'UPDATE ledger SET amount = ?, paid = ?, note = COALESCE(?, note), method = COALESCE(?, method), paid_at = COALESCE(?, paid_at) WHERE id = ?',
      bal,
      paid,
      note === undefined ? null : String(note).slice(0, 300),
      method === undefined ? null : String(method).slice(0, 50),
      paidAt ? new Date(paidAt).toISOString() : null,
      id
    );
    return getPayment(id);
  });

export const deletePayment = (id) => {
  const l = q.one('SELECT * FROM ledger WHERE id = ?', id);
  if (!l) throw new HttpError(404, 'Toʻlov topilmadi');
  if (!['topup', 'package', 'adjustment'].includes(l.kind)) throw new HttpError(400, 'Faqat toʻlovlarni oʻchirish mumkin');
  q.run('DELETE FROM ledger WHERE id = ?', id);
  return { ok: true, subscriptionId: l.subscription_id };
};
