import { q } from '../db.js';
import { hashToken, nowIso } from '../util/ids.js';
import { HttpError } from './errors.js';

/** CRM authentication: `Authorization: Bearer sci_...` or `X-API-Key: sci_...` */
export const apiAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : String(req.headers['x-api-key'] || '').trim();
  if (!raw) return next(new HttpError(401, 'API token yuborilmadi', { code: 'NO_TOKEN' }));

  const token = q.one('SELECT * FROM api_tokens WHERE token_hash = ?', hashToken(raw));
  if (!token || token.revoked_at) return next(new HttpError(401, 'API token notoʻgʻri yoki bekor qilingan', { code: 'INVALID_TOKEN' }));

  const company = q.one('SELECT * FROM companies WHERE id = ?', token.company_id);
  if (!company) return next(new HttpError(401, 'Kompaniya topilmadi', { code: 'INVALID_TOKEN' }));

  q.run('UPDATE api_tokens SET last_used_at = ? WHERE id = ?', nowIso(), token.id);
  req.company = company;
  req.apiToken = token;
  next();
};
