import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './errors.js';

export const signAdminToken = (username) => jwt.sign({ sub: username, role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });

export const adminAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Kirish talab qilinadi'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') throw new Error('role');
    req.admin = { username: payload.sub };
    next();
  } catch {
    next(new HttpError(401, 'Sessiya muddati tugagan, qaytadan kiring'));
  }
};
