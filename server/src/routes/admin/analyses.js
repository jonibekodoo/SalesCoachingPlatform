import { Router } from 'express';
import { q } from '../../db.js';
import { HttpError } from '../../middleware/errors.js';
import { rowToApi } from '../../services/analysis.service.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  const where = [];
  const params = [];
  if (req.query.companyId) {
    where.push('a.company_id = ?');
    params.push(String(req.query.companyId));
  }
  if (req.query.status) {
    where.push('a.status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.q) {
    where.push('(a.title LIKE ? OR a.file_name LIKE ? OR a.external_id LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = q.all(
    `SELECT a.*, c.name AS company_name FROM analyses a JOIN companies c ON c.id = a.company_id ${sqlWhere}
     ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );
  const total = q.one(`SELECT COUNT(*) AS n FROM analyses a ${sqlWhere}`, ...params).n;
  res.json({
    total,
    items: rows.map((r) => ({ ...rowToApi(r, { full: false }), companyId: r.company_id, companyName: r.company_name })),
  });
});

router.get('/:id', (req, res) => {
  const r = q.one('SELECT a.*, c.name AS company_name, c.country FROM analyses a JOIN companies c ON c.id = a.company_id WHERE a.id = ?', req.params.id);
  if (!r) throw new HttpError(404, 'Tahlil topilmadi');
  res.json({ ...rowToApi(r), companyId: r.company_id, companyName: r.company_name, country: r.country });
});

router.delete('/:id', (req, res) => {
  const r = q.one('SELECT id FROM analyses WHERE id = ?', req.params.id);
  if (!r) throw new HttpError(404, 'Tahlil topilmadi');
  q.run('DELETE FROM analyses WHERE id = ?', r.id);
  res.json({ ok: true });
});

export default router;
