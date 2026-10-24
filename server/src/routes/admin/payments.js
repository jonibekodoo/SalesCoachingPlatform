import { Router } from 'express';
import { q } from '../../db.js';
import { HttpError } from '../../middleware/errors.js';
import {
  listPayments,
  getPayment,
  updatePayment,
  deletePayment,
  topUp,
  activateSubscription,
  paymentView,
  accountState,
} from '../../services/billing.service.js';
import { newId, nowIso } from '../../util/ids.js';

const router = Router();

const getCompany = (id) => {
  const c = q.one('SELECT * FROM companies WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Kompaniya topilmadi');
  return c;
};

// GET /api/admin/payments?companyId&kind&from&to&limit&offset
router.get('/', (req, res) => {
  const toDate = (v, end) => {
    if (!v) return undefined;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Sana notoʻgʻri');
    if (end) d.setUTCHours(23, 59, 59, 999);
    else d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  };
  res.json(
    listPayments({
      companyId: req.query.companyId ? String(req.query.companyId) : undefined,
      kind: req.query.kind ? String(req.query.kind) : undefined,
      from: toDate(req.query.from, false),
      to: toDate(req.query.to, true),
      limit: Math.min(500, Number(req.query.limit) || 100),
      offset: Number(req.query.offset) || 0,
    })
  );
});

/**
 * POST /api/admin/payments
 * { companyId, kind: 'topup' | 'package', amount, subscriptionId?, method?, paidAt?, note? }
 * A package payment for a pending subscription confirms it and opens the company.
 */
router.post('/', (req, res) => {
  const b = req.body || {};
  const company = getCompany(b.companyId);
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new HttpError(400, 'Summa notoʻgʻri');
  const method = String(b.method || '').slice(0, 50);
  const note = String(b.note || '').slice(0, 300);
  const paidAt = b.paidAt ? new Date(b.paidAt).toISOString() : null;
  const kind = b.kind || 'topup';

  let entry;
  if (kind === 'package') {
    const sub = b.subscriptionId ? q.one('SELECT * FROM subscriptions WHERE id = ? AND company_id = ?', b.subscriptionId, company.id) : null;
    if (!sub) throw new HttpError(400, 'Paket toʻlovi uchun obunani tanlang');
    if (sub.status === 'pending') {
      activateSubscription(company, sub, { amount, note, method, paidAt });
      entry = q.one('SELECT * FROM ledger WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 1', sub.id);
    } else {
      const id = newId('led');
      q.run(
        'INSERT INTO ledger(id, company_id, amount, kind, note, analysis_id, created_at, paid, subscription_id, method, paid_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        id, company.id, 0, 'package', note || `Paket toʻlovi: ${sub.plan_name}`, null, nowIso(), Math.round(amount), sub.id, method, paidAt || nowIso()
      );
      entry = q.one('SELECT * FROM ledger WHERE id = ?', id);
    }
  } else if (kind === 'topup') {
    entry = topUp(company, amount, note, { method, paidAt });
  } else {
    throw new HttpError(400, 'kind: topup yoki package');
  }
  res.status(201).json({ payment: getPayment(entry.id), account: accountState(getCompany(company.id)) });
});

router.get('/:id', (req, res) => {
  const p = getPayment(req.params.id);
  if (!p) throw new HttpError(404, 'Toʻlov topilmadi');
  res.json(p);
});

router.patch('/:id', (req, res) => {
  const b = req.body || {};
  const p = updatePayment(req.params.id, { amount: b.amount, note: b.note, method: b.method, paidAt: b.paidAt });
  res.json({ payment: p, account: accountState(getCompany(p.companyId)) });
});

router.delete('/:id', (req, res) => {
  const p = getPayment(req.params.id);
  if (!p) throw new HttpError(404, 'Toʻlov topilmadi');
  const r = deletePayment(p.id);
  res.json({ ...r, account: accountState(getCompany(p.companyId)) });
});

export { paymentView };
export default router;
