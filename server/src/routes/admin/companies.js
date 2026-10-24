import { Router } from 'express';
import { q, tx } from '../../db.js';
import { newId, nowIso, newApiToken, hashToken, tokenPrefix } from '../../util/ids.js';
import { HttpError } from '../../middleware/errors.js';
import { accountState, subscribe, topUp, subscriptionView, activateSubscription, paymentView } from '../../services/billing.service.js';
import { normalizeFieldDefs } from '../../services/customFields.js';
import { isValidCountry, findCountry } from '../../util/countries.js';
import { rowToApi, analyzeForCompany } from '../../services/analysis.service.js';
import multer from 'multer';
import { config } from '../../config.js';
import { asyncHandler } from '../../middleware/errors.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxAudioBytes, files: 1 } });
import { getPricing } from '../../services/settings.service.js';

const router = Router();

const getCompany = (id) => {
  const c = q.one('SELECT * FROM companies WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Kompaniya topilmadi');
  return c;
};

export const companyView = (c) => {
  const country = findCountry(c.country);
  return {
    id: c.id,
    name: c.name,
    contactName: c.contact_name,
    email: c.email,
    phone: c.phone,
    country: c.country,
    countryName: country?.name || c.country,
    language: country?.language || '',
    status: c.status,
    notes: c.notes,
    customFields: JSON.parse(c.custom_fields || '[]'),
    script: c.script || '',
    hasScript: !!(c.script && c.script.trim()),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
};

const tokenView = (t) => ({
  id: t.id,
  name: t.name,
  prefix: t.token_prefix,
  createdAt: t.created_at,
  lastUsedAt: t.last_used_at,
  revokedAt: t.revoked_at,
});

const parseCompany = (body, existing = {}) => {
  const name = String(body.name ?? existing.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Kompaniya nomi kerak');
  const country = String(body.country ?? existing.country ?? 'UZ').toUpperCase();
  if (!isValidCountry(country)) throw new HttpError(400, `Davlat kodi qoʻllanmaydi: ${country}`);
  const status = body.status ?? existing.status ?? 'active';
  if (!['active', 'suspended', 'pending'].includes(status)) throw new HttpError(400, 'status: active, suspended yoki pending');
  const customFields = body.customFields === undefined ? JSON.parse(existing.custom_fields || '[]') : normalizeFieldDefs(body.customFields);
  return {
    name,
    contact_name: String(body.contactName ?? existing.contact_name ?? '').slice(0, 200),
    email: String(body.email ?? existing.email ?? '').slice(0, 200),
    phone: String(body.phone ?? existing.phone ?? '').slice(0, 50),
    country,
    status,
    notes: String(body.notes ?? existing.notes ?? '').slice(0, 2000),
    script: String(body.script ?? existing.script ?? '').slice(0, 20000),
    custom_fields: JSON.stringify(customFields),
  };
};

// ---- Companies -------------------------------------------------------------

router.get('/', (_req, res) => {
  const rows = q.all('SELECT * FROM companies ORDER BY created_at DESC');
  const stats = new Map(
    q.all(
      `SELECT company_id, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, MAX(created_at) AS last_at
       FROM analyses WHERE status = 'done' GROUP BY company_id`
    ).map((r) => [r.company_id, r])
  );
  res.json(
    rows.map((c) => {
      const acc = accountState(c);
      const s = stats.get(c.id);
      return {
        ...companyView(c),
        account: acc,
        totals: { calls: s?.calls || 0, minutes: Math.round((s?.billed || 0) / 60), cost: s?.cost || 0, lastAnalysisAt: s?.last_at || null },
        tokens: q.one('SELECT COUNT(*) AS n FROM api_tokens WHERE company_id = ? AND revoked_at IS NULL', c.id).n,
      };
    })
  );
});

// A new company picks its plan right away and stays "pending" until the admin confirms the payment
router.post('/', (req, res) => {
  const body = req.body || {};
  const plan = body.planId ? q.one('SELECT * FROM plans WHERE id = ?', String(body.planId)) : null;
  if (!plan) throw new HttpError(400, 'Tarif (paket) tanlanishi shart');
  if (!plan.is_active) throw new HttpError(400, 'Tanlangan tarif faol emas');
  const c = parseCompany({ ...body, status: 'pending' });
  const id = newId('co');
  const now = nowIso();
  q.run(
    'INSERT INTO companies(id, name, contact_name, email, phone, country, status, notes, custom_fields, script, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    id, c.name, c.contact_name, c.email, c.phone, c.country, c.status, c.notes, c.custom_fields, c.script, now, now
  );
  const company = getCompany(id);
  const sub = subscribe(company, plan, { activate: false });
  res.status(201).json({ ...companyView(company), pendingSubscription: subscriptionView(sub) });
});

router.get('/:id', (req, res) => {
  const c = getCompany(req.params.id);
  res.json({
    ...companyView(c),
    account: accountState(c),
    tokens: q.all('SELECT * FROM api_tokens WHERE company_id = ? ORDER BY created_at DESC', c.id).map(tokenView),
    subscriptions: q.all('SELECT * FROM subscriptions WHERE company_id = ? ORDER BY created_at DESC', c.id).map(subscriptionView),
    ledger: q
      .all(
        `SELECT l.*, s.plan_name AS subscription_name FROM ledger l LEFT JOIN subscriptions s ON s.id = l.subscription_id
         WHERE l.company_id = ? ORDER BY COALESCE(l.paid_at, l.created_at) DESC LIMIT 100`,
        c.id
      )
      .map(paymentView),
  });
});

router.patch('/:id', (req, res) => {
  const existing = getCompany(req.params.id);
  const c = parseCompany(req.body || {}, existing);
  q.run(
    'UPDATE companies SET name=?, contact_name=?, email=?, phone=?, country=?, status=?, notes=?, custom_fields=?, script=?, updated_at=? WHERE id=?',
    c.name, c.contact_name, c.email, c.phone, c.country, c.status, c.notes, c.custom_fields, c.script, nowIso(), existing.id
  );
  res.json(companyView(getCompany(existing.id)));
});

router.delete('/:id', (req, res) => {
  const existing = getCompany(req.params.id);
  q.run('DELETE FROM companies WHERE id = ?', existing.id);
  res.json({ ok: true });
});

// ---- Tokens ----------------------------------------------------------------

router.post('/:id/tokens', (req, res) => {
  const c = getCompany(req.params.id);
  const plain = newApiToken();
  const id = newId('tok');
  q.run(
    'INSERT INTO api_tokens(id, company_id, name, token_hash, token_prefix, created_at) VALUES(?,?,?,?,?,?)',
    id, c.id, String(req.body?.name || 'default').slice(0, 100), hashToken(plain), tokenPrefix(plain), nowIso()
  );
  // The plaintext token is returned exactly once
  res.status(201).json({ ...tokenView(q.one('SELECT * FROM api_tokens WHERE id = ?', id)), token: plain });
});

router.delete('/:id/tokens/:tokenId', (req, res) => {
  const c = getCompany(req.params.id);
  const t = q.one('SELECT * FROM api_tokens WHERE id = ? AND company_id = ?', req.params.tokenId, c.id);
  if (!t) throw new HttpError(404, 'Token topilmadi');
  q.run('UPDATE api_tokens SET revoked_at = ? WHERE id = ?', nowIso(), t.id);
  res.json({ ok: true });
});

// ---- Tariff & balance ------------------------------------------------------

router.post('/:id/subscriptions', (req, res) => {
  const c = getCompany(req.params.id);
  const plan = q.one('SELECT * FROM plans WHERE id = ?', req.body?.planId);
  if (!plan) throw new HttpError(404, 'Tarif topilmadi');
  if (!plan.is_active) throw new HttpError(400, 'Tarif faol emas');
  const paidAmount = req.body?.paidAmount === undefined || req.body?.paidAmount === '' ? undefined : Number(req.body.paidAmount);
  if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount < 0)) throw new HttpError(400, 'Toʻlangan summa notoʻgʻri');
  const activate = req.body?.activate !== false;
  const sub = subscribe(c, plan, { note: req.body?.note, activate, paidAmount });
  res.status(201).json({ subscription: subscriptionView(sub), account: accountState(getCompany(c.id)) });
});

// Payment confirmed: start the pending subscription and open the company
router.post('/:id/subscriptions/:subId/activate', (req, res) => {
  const c = getCompany(req.params.id);
  const s = q.one('SELECT * FROM subscriptions WHERE id = ? AND company_id = ?', req.params.subId, c.id);
  if (!s) throw new HttpError(404, 'Obuna topilmadi');
  const sub = activateSubscription(c, s, {
    amount: req.body?.amount,
    note: String(req.body?.note || '').slice(0, 300),
    method: String(req.body?.method || '').slice(0, 50),
    paidAt: req.body?.paidAt ? new Date(req.body.paidAt).toISOString() : null,
  });
  res.json({ subscription: subscriptionView(sub), company: companyView(getCompany(c.id)), account: accountState(getCompany(c.id)) });
});

router.patch('/:id/subscriptions/:subId', (req, res) => {
  const c = getCompany(req.params.id);
  const s = q.one('SELECT * FROM subscriptions WHERE id = ? AND company_id = ?', req.params.subId, c.id);
  if (!s) throw new HttpError(404, 'Obuna topilmadi');
  if (req.body?.status !== 'cancelled') throw new HttpError(400, 'Faqat status: cancelled qoʻllanadi');
  q.run("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?", s.id);
  res.json({ subscription: subscriptionView(q.one('SELECT * FROM subscriptions WHERE id = ?', s.id)), account: accountState(c) });
});

router.post('/:id/payments', (req, res) => {
  const c = getCompany(req.params.id);
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new HttpError(400, 'Summa notoʻgʻri');
  const entry = topUp(c, amount, String(req.body?.note || '').slice(0, 300), {
    method: String(req.body?.method || '').slice(0, 50),
    paidAt: req.body?.paidAt ? new Date(req.body.paidAt).toISOString() : null,
  });
  res.status(201).json({ entry: paymentView(entry), account: accountState(c) });
});

// ---- Reports ---------------------------------------------------------------

router.get('/:id/report', (req, res) => {
  const c = getCompany(req.params.id);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 29 * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const daily = q.all(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost,
            AVG(overall_score) AS avg_score
     FROM analyses WHERE company_id = ? AND status = 'done' AND created_at BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    c.id, fromIso, toIso
  );
  const monthly = q.all(
    `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost,
            AVG(overall_score) AS avg_score
     FROM analyses WHERE company_id = ? AND status = 'done' GROUP BY month ORDER BY month DESC LIMIT 12`,
    c.id
  );
  const totals = q.one(
    `SELECT COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, AVG(overall_score) AS avg_score,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, COALESCE(SUM(ai_cost_usd),0) AS ai_cost
     FROM analyses WHERE company_id = ? AND created_at BETWEEN ? AND ?`,
    c.id, fromIso, toIso
  );
  const grades = q.all(
    "SELECT overall_grade AS grade, COUNT(*) AS n FROM analyses WHERE company_id = ? AND status='done' AND created_at BETWEEN ? AND ? GROUP BY grade ORDER BY grade",
    c.id, fromIso, toIso
  );
  const fmt = (r) => ({ ...r, minutes: Math.round(r.billed / 60), avgScore: r.avg_score ? Math.round(r.avg_score) : null });
  res.json({
    from: fromIso,
    to: toIso,
    totals: { ...fmt(totals), failed: totals.failed || 0, aiCostUsd: Math.round(totals.ai_cost * 10000) / 10000, aiCostSom: Math.round(totals.ai_cost * getPricing().usdRate) },
    daily: daily.map(fmt),
    monthly: monthly.map(fmt),
    grades,
    account: accountState(c),
  });
});

// Admin runs an analysis for a company from the panel (billed exactly like an API call)
router.post(
  '/:id/analyze',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    const c = getCompany(req.params.id);
    if (!req.file) throw new HttpError(400, 'Audio fayl yuborilmadi');
    const useScript = req.body?.useScript !== 'false' && req.body?.useScript !== '0';
    const result = await analyzeForCompany({
      company: c,
      token: null,
      buffer: req.file.buffer,
      fileName: req.body?.fileName || req.file.originalname,
      mimeType: req.file.mimetype,
      externalId: req.body?.externalId || '',
      customFields: req.body?.customFields,
      context: { callDate: req.body?.callDate, notes: req.body?.notes },
      script: req.body?.script?.trim() ? req.body.script : useScript ? undefined : '',
      source: 'admin',
    });
    res.status(201).json({ ...result, account: accountState(getCompany(c.id)) });
  })
);

router.get('/:id/analyses', (req, res) => {
  const c = getCompany(req.params.id);
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  const rows = q.all('SELECT * FROM analyses WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', c.id, limit, offset);
  const total = q.one('SELECT COUNT(*) AS n FROM analyses WHERE company_id = ?', c.id).n;
  res.json({ total, items: rows.map((r) => rowToApi(r, { full: false })) });
});

export default router;
