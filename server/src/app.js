import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { adminAuth } from './middleware/adminAuth.js';
import { errorHandler } from './middleware/errors.js';
import authRouter from './routes/admin/auth.js';
import companiesRouter from './routes/admin/companies.js';
import plansRouter from './routes/admin/plans.js';
import analysesRouter from './routes/admin/analyses.js';
import settingsRouter from './routes/admin/settings.js';
import statsRouter from './routes/admin/stats.js';
import paymentsRouter from './routes/admin/payments.js';
import v1Router from './routes/v1/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '80mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // CRM integration API (token auth)
  app.use('/api/v1', v1Router);

  // Admin panel API (JWT auth)
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/companies', adminAuth, companiesRouter);
  app.use('/api/admin/plans', adminAuth, plansRouter);
  app.use('/api/admin/analyses', adminAuth, analysesRouter);
  app.use('/api/admin/settings', adminAuth, settingsRouter);
  app.use('/api/admin/stats', adminAuth, statsRouter);
  app.use('/api/admin/payments', adminAuth, paymentsRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Built admin panel (admin/dist) in production
  const dist = process.env.ADMIN_DIST || path.resolve(process.cwd(), '../admin/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
