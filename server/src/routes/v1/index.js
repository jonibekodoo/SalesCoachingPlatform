import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';
import { q } from '../../db.js';
import { apiAuth } from '../../middleware/apiAuth.js';
import { asyncHandler, HttpError } from '../../middleware/errors.js';
import { analyzeForCompany, rowToApi } from '../../services/analysis.service.js';
import { accountState } from '../../services/billing.service.js';
import { normalizeFieldDefs } from '../../services/customFields.js';
import { LANGUAGES, findCountry } from '../../util/countries.js';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxAudioBytes, files: 1 } });

// Per-company limiter for the expensive endpoint
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `company:${req.company.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda koʻp soʻrov, bir daqiqadan keyin qayta urinib koʻring', code: 'RATE_LIMITED' },
});

router.use(apiAuth);

/**
 * POST /api/v1/analyze
 * multipart/form-data: audio=<file>, externalId?, customFields? (JSON), callDate?, notes?
 * or application/json: { audioBase64, mimeType, fileName, externalId?, customFields?, callDate?, notes? }
 */
router.post(
  '/analyze',
  analyzeLimiter,
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    let buffer;
    let fileName;
    let mimeType;
    if (req.file) {
      buffer = req.file.buffer;
      fileName = req.body.fileName || req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body?.audioBase64) {
      const b64 = String(req.body.audioBase64).replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
      fileName = req.body.fileName || 'sales_call.audio';
      mimeType = req.body.mimeType;
    } else {
      throw new HttpError(400, 'Audio yuborilmadi: multipart "audio" fayli yoki JSON "audioBase64" kerak', { code: 'NO_AUDIO' });
    }
    if (buffer.length > config.maxAudioBytes) throw new HttpError(413, 'Fayl hajmi juda katta', { code: 'FILE_TOO_LARGE' });

    const result = await analyzeForCompany({
      company: req.company,
      token: req.apiToken,
      buffer,
      fileName,
      mimeType,
      externalId: req.body?.externalId || req.body?.external_id || '',
      customFields: req.body?.customFields ?? req.body?.custom_fields,
      context: { callDate: req.body?.callDate || req.body?.call_date, notes: req.body?.notes },
      // Per-call script overrides the company script; an explicit empty string disables it for this call
      script: req.body?.script ?? undefined,
      // Result language for this call (e.g. "ru"); defaults to the company setting, then the country language
      outputLanguage: req.body?.outputLanguage || req.body?.output_language || undefined,
      source: 'api',
    });
    res.status(201).json({ ...result, account: accountState(q.one('SELECT * FROM companies WHERE id = ?', req.company.id)) });
  })
);

/** Validate custom field definitions without spending any minutes */
router.post('/custom-fields/validate', (req, res) => {
  const fields = normalizeFieldDefs(req.body?.customFields ?? req.body);
  res.json({ ok: true, fields });
});

/** The company's default sales script (used for every call that does not send its own) */
router.get('/script', (req, res) => {
  const company = q.one('SELECT script, updated_at FROM companies WHERE id = ?', req.company.id);
  res.json({ script: company.script || '', updatedAt: company.updated_at });
});

router.put('/script', (req, res) => {
  const script = typeof req.body?.script === 'string' ? req.body.script.slice(0, 20000) : null;
  if (script === null) throw new HttpError(400, '"script" matn boʻlishi kerak (boʻsh matn skriptni oʻchiradi)', { code: 'INVALID_SCRIPT' });
  q.run('UPDATE companies SET script = ?, updated_at = ? WHERE id = ?', script, new Date().toISOString(), req.company.id);
  res.json({ ok: true, script, length: script.length });
});

router.get('/account', (req, res) => {
  const company = q.one('SELECT * FROM companies WHERE id = ?', req.company.id);
  res.json({
    ...accountState(company),
    customFields: JSON.parse(company.custom_fields || '[]'),
    hasScript: !!(company.script && company.script.trim()),
    outputLanguage: company.output_language || findCountry(company.country)?.languageCode || 'uz',
    languages: LANGUAGES.map((l) => ({ code: l.code, language: l.language })),
  });
});

router.get('/analyses', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = Number(req.query.offset) || 0;
  const params = [req.company.id];
  let where = 'company_id = ?';
  if (req.query.externalId) {
    where += ' AND external_id = ?';
    params.push(String(req.query.externalId));
  }
  const rows = q.all(`SELECT * FROM analyses WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = q.one(`SELECT COUNT(*) AS n FROM analyses WHERE ${where}`, ...params).n;
  res.json({ total, limit, offset, items: rows.map((r) => rowToApi(r, { full: false })) });
});

router.get('/analyses/:id', (req, res) => {
  const r = q.one('SELECT * FROM analyses WHERE id = ? AND company_id = ?', req.params.id, req.company.id);
  if (!r) throw new HttpError(404, 'Tahlil topilmadi', { code: 'NOT_FOUND' });
  res.json(rowToApi(r));
});

export default router;
