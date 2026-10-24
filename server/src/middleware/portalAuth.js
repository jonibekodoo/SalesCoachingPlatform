import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { q } from '../db.js';
import { HttpError } from './errors.js';

/** Company portal session: a JWT with role "company" and the company id as subject */
export const signPortalToken = (companyId) => jwt.sign({ sub: companyId, role: 'company' }, config.jwtSecret, { expiresIn: '7d' });

export const portalAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Kirish talab qilinadi'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'company') throw new Error('role');
    const company = q.one('SELECT * FROM companies WHERE id = ?', payload.sub);
    if (!company) throw new Error('company');
    if (!company.portal_password_hash) throw new Error('portal disabled');
    req.company = company;
    next();
  } catch {
    next(new HttpError(401, 'Sessiya muddati tugagan, qaytadan kiring'));
  }
};
