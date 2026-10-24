import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { q } from '../db.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { portalAuth, signPortalToken } from '../middleware/portalAuth.js';
import { verifyPassword, hashPassword } from '../util/password.js';
import { accountState, subscriptionView, listPayments } from '../services/billing.service.js';
import { analyzeForCompany, rowToApi } from '../services/analysis.service.js';
import { findCountry, findLanguage, LANGUAGES } from '../util/countries.js';
import { nowIso } from '../util/ids.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxAudioBytes, files: 1 } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

const companyView = (c) => {
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
    outputLanguage: c.output_language || '',
    outputLanguageName: c.output_language ? findLanguage(c.output_language)?.language || c.output_language : country?.language || '',
    status: c.status,
    customFields: JSON.parse(c.custom_fields || '[]'),
    hasScript: !!(c.script && c.script.trim()),
    portalEmail: c.portal_email || '',
    createdAt: c.created_at,
  };
};

// ---- Auth ---------------------------------------------------------------------

router.post('/auth/login', loginLimiter, (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const company = email ? q.one('SELECT * FROM companies WHERE lower(portal_email) = ?', email) : null;
  if (!company || !company.portal_password_hash || !verifyPassword(password, company.portal_password_hash)) {
    return next(new HttpError(401, 'Email yoki parol notoʻgʻri'));
  }
  res.json({ token: signPortalToken(company.id), company: companyView(company) });
});

router.use(portalAuth);

router.get('/me', (req, res) => {
  const c = req.company;
  res.json({
    company: companyView(c),
    account: accountState(c),
    tokens: q.one('SELECT COUNT(*) AS n FROM api_tokens WHERE company_id = ? AND revoked_at IS NULL', c.id).n,
    languages: LANGUAGES.map((l) => ({ code: l.code, language: l.language, name: l.name })),
  });
});

router.post(
  '/auth/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPassword(String(currentPassword || ''), req.company.portal_password_hash)) throw new HttpError(400, 'Joriy parol notoʻgʻri');
    if (String(newPassword || '').length < 8) throw new HttpError(400, 'Yangi parol kamida 8 belgi boʻlsin');
    q.run('UPDATE companies SET portal_password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(newPassword), nowIso(), req.company.id);
    res.json({ ok: true });
  })
);

// ---- Account, payments ----------------------------------------------------------

router.get('/account', (req, res) => {
  const c = req.company;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthly = q.all(
    `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, AVG(overall_score) AS avg_score
     FROM analyses WHERE company_id = ? AND status = 'done' GROUP BY month ORDER BY month DESC LIMIT 12`,
    c.id
  );
  const daily = q.all(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost
     FROM analyses WHERE company_id = ? AND status = 'done' AND created_at >= ? GROUP BY day ORDER BY day`,
    c.id,
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
  );
  const totals = q.one(
    "SELECT COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, AVG(overall_score) AS avg_score, AVG(script_score) AS avg_script, AVG(rating_score) AS avg_rating FROM analyses WHERE company_id = ? AND status='done'",
    c.id
  );
  res.json({
    account: accountState(c),
    subscriptions: q.all('SELECT * FROM subscriptions WHERE company_id = ? ORDER BY created_at DESC', c.id).map(subscriptionView),
    totals: {
      calls: totals.calls,
      minutes: Math.round(totals.billed / 60),
      cost: totals.cost,
      avgScore: totals.avg_score ? Math.round(totals.avg_score) : null,
      avgScriptScore: totals.avg_script ? Math.round(totals.avg_script) : null,
      avgRating: totals.avg_rating ? Math.round(totals.avg_rating * 10) / 10 : null,
    },
    monthly: monthly.map((m) => ({ month: m.month, calls: m.calls, minutes: Math.round(m.billed / 60), cost: m.cost, avgScore: m.avg_score ? Math.round(m.avg_score) : null })),
    daily: daily.map((d) => ({ day: d.day, calls: d.calls, minutes: Math.round(d.billed / 60), cost: d.cost })),
  });
});

router.get('/payments', (req, res) => {
  const { items, totals } = listPayments({ companyId: req.company.id, limit: 300 });
  const charges = q
    .all("SELECT l.* FROM ledger l WHERE l.company_id = ? AND l.kind = 'charge' ORDER BY l.created_at DESC LIMIT 200", req.company.id)
    .map((l) => ({ id: l.id, amount: l.amount, note: l.note, analysisId: l.analysis_id, createdAt: l.created_at }));
  res.json({ payments: items, totals, charges, balance: accountState(req.company).balance });
});

// ---- Analyses -------------------------------------------------------------------

router.get('/analyses', (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  const params = [req.company.id];
  let where = 'company_id = ?';
  if (req.query.q) {
    where += ' AND (title LIKE ? OR file_name LIKE ? OR external_id LIKE ?)';
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  const rows = q.all(`SELECT * FROM analyses WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = q.one(`SELECT COUNT(*) AS n FROM analyses WHERE ${where}`, ...params).n;
  res.json({ total, items: rows.map((r) => rowToApi(r, { full: false })) });
});

router.get('/analyses/:id', (req, res) => {
  const r = q.one('SELECT * FROM analyses WHERE id = ? AND company_id = ?', req.params.id, req.company.id);
  if (!r) throw new HttpError(404, 'Tahlil topilmadi');
  res.json({ ...rowToApi(r), companyId: req.company.id, companyName: req.company.name, country: req.company.country });
});

router.post(
  '/analyze',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Audio fayl yuborilmadi', { code: 'NO_AUDIO' });
    const useScript = req.body?.useScript !== 'false' && req.body?.useScript !== '0';
    const result = await analyzeForCompany({
      company: req.company,
      token: null,
      buffer: req.file.buffer,
      fileName: req.body?.fileName || req.file.originalname,
      mimeType: req.file.mimetype,
      externalId: req.body?.externalId || '',
      customFields: req.body?.customFields,
      context: { callDate: req.body?.callDate, notes: req.body?.notes },
      script: useScript ? undefined : '',
      outputLanguage: req.body?.outputLanguage || undefined,
      source: 'portal',
    });
    res.status(201).json({ ...result, account: accountState(q.one('SELECT * FROM companies WHERE id = ?', req.company.id)) });
  })
);

// ---- Script & settings the company may edit itself -------------------------------

router.get('/script', (req, res) => res.json({ script: req.company.script || '' }));

router.put('/script', (req, res) => {
  const script = typeof req.body?.script === 'string' ? req.body.script.slice(0, 20000) : null;
  if (script === null) throw new HttpError(400, 'script matn boʻlishi kerak');
  q.run('UPDATE companies SET script = ?, updated_at = ? WHERE id = ?', script, nowIso(), req.company.id);
  res.json({ ok: true, script });
});

router.put('/settings', (req, res) => {
  const code = String(req.body?.outputLanguage ?? '').trim();
  if (code && !findLanguage(code)) throw new HttpError(400, 'Natija tili qoʻllanmaydi');
  q.run('UPDATE companies SET output_language = ?, updated_at = ? WHERE id = ?', code, nowIso(), req.company.id);
  res.json({ ok: true, company: companyView(q.one('SELECT * FROM companies WHERE id = ?', req.company.id)) });
});

router.get('/tokens', (req, res) => {
  res.json(
    q.all('SELECT * FROM api_tokens WHERE company_id = ? ORDER BY created_at DESC', req.company.id).map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.token_prefix,
      createdAt: t.created_at,
      lastUsedAt: t.last_used_at,
      revokedAt: t.revoked_at,
    }))
  );
});

export default router;
