import { Router } from 'express';
import { q } from '../../db.js';
import { newId, nowIso } from '../../util/ids.js';
import { HttpError } from '../../middleware/errors.js';

const router = Router();

export const planView = (p) =>
  p && {
    id: p.id,
    name: p.name,
    type: p.type,
    pricePerMinute: p.price_per_minute,
    includedMinutes: p.included_minutes,
    price: p.price,
    validityDays: p.validity_days,
    description: p.description,
    isActive: !!p.is_active,
    createdAt: p.created_at,
    subscribers: q.one("SELECT COUNT(*) AS n FROM subscriptions WHERE plan_id = ? AND status = 'active'", p.id).n,
  };

const parsePlan = (body, existing = {}) => {
  const type = body.type ?? existing.type;
  if (!['per_minute', 'package'].includes(type)) throw new HttpError(400, 'type: per_minute yoki package');
  const name = String(body.name ?? existing.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Tarif nomi kerak');
  const toInt = (v, d = 0) => (v === undefined || v === null || v === '' ? d : Math.round(Number(v)));
  const plan = {
    name,
    type,
    price_per_minute: toInt(body.pricePerMinute, existing.price_per_minute ?? 0),
    included_minutes: toInt(body.includedMinutes, existing.included_minutes ?? 0),
    price: toInt(body.price, existing.price ?? 0),
    validity_days: body.validityDays === undefined ? existing.validity_days ?? null : body.validityDays ? toInt(body.validityDays) : null,
    description: String(body.description ?? existing.description ?? '').slice(0, 1000),
    is_active: body.isActive === undefined ? existing.is_active ?? 1 : body.isActive ? 1 : 0,
  };
  if (type === 'per_minute' && plan.price_per_minute <= 0) throw new HttpError(400, 'Daqiqa narxi 0 dan katta boʻlishi kerak');
  if (type === 'package' && plan.included_minutes <= 0) throw new HttpError(400, 'Paketdagi daqiqalar 0 dan katta boʻlishi kerak');
  if (Number.isNaN(plan.price_per_minute) || Number.isNaN(plan.included_minutes) || Number.isNaN(plan.price)) {
    throw new HttpError(400, 'Raqamli qiymatlar notoʻgʻri');
  }
  return plan;
};

router.get('/', (_req, res) => {
  res.json(q.all('SELECT * FROM plans ORDER BY is_active DESC, type, price, price_per_minute').map(planView));
});

router.post('/', (req, res) => {
  const p = parsePlan(req.body || {});
  const id = newId('plan');
  q.run(
    'INSERT INTO plans(id, name, type, price_per_minute, included_minutes, price, validity_days, description, is_active, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    id, p.name, p.type, p.price_per_minute, p.included_minutes, p.price, p.validity_days, p.description, p.is_active, nowIso()
  );
  res.status(201).json(planView(q.one('SELECT * FROM plans WHERE id = ?', id)));
});

router.patch('/:id', (req, res) => {
  const existing = q.one('SELECT * FROM plans WHERE id = ?', req.params.id);
  if (!existing) throw new HttpError(404, 'Tarif topilmadi');
  const p = parsePlan(req.body || {}, existing);
  q.run(
    'UPDATE plans SET name=?, type=?, price_per_minute=?, included_minutes=?, price=?, validity_days=?, description=?, is_active=? WHERE id=?',
    p.name, p.type, p.price_per_minute, p.included_minutes, p.price, p.validity_days, p.description, p.is_active, existing.id
  );
  res.json(planView(q.one('SELECT * FROM plans WHERE id = ?', existing.id)));
});

router.delete('/:id', (req, res) => {
  const existing = q.one('SELECT * FROM plans WHERE id = ?', req.params.id);
  if (!existing) throw new HttpError(404, 'Tarif topilmadi');
  const used = q.one('SELECT COUNT(*) AS n FROM subscriptions WHERE plan_id = ?', existing.id).n;
  if (used > 0) {
    // Keep history intact: deactivate instead of deleting
    q.run('UPDATE plans SET is_active = 0 WHERE id = ?', existing.id);
    return res.json({ ok: true, deactivated: true });
  }
  q.run('DELETE FROM plans WHERE id = ?', existing.id);
  res.json({ ok: true, deleted: true });
});

export default router;
