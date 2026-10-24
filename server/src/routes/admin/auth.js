import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';
import { signAdminToken, adminAuth } from '../../middleware/adminAuth.js';
import { HttpError } from '../../middleware/errors.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/login', loginLimiter, (req, res, next) => {
  const { username, password } = req.body || {};
  if (username !== config.adminUsername || password !== config.adminPassword) {
    return next(new HttpError(401, 'Login yoki parol notoʻgʻri'));
  }
  res.json({ token: signAdminToken(username), username });
});

router.get('/me', adminAuth, (req, res) => res.json({ username: req.admin.username }));

export default router;
