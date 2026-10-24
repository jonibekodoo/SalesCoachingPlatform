import { Router } from 'express';
import { q } from '../../db.js';
import { rowToApi } from '../../services/analysis.service.js';
import { getPricing } from '../../services/settings.service.js';

const router = Router();

router.get('/', (_req, res) => {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const since30 = new Date(Date.now() - 29 * 86400000);
  since30.setUTCHours(0, 0, 0, 0);

  const companies = q.one("SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM companies");
  const all = q.one("SELECT COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost FROM analyses WHERE status='done'");
  const month = q.one(
    "SELECT COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, AVG(overall_score) AS avg_score, AVG(rating_score) AS avg_rating, AVG(script_score) AS avg_script, COALESCE(SUM(ai_cost_usd),0) AS ai_cost FROM analyses WHERE status='done' AND created_at >= ?",
    monthStart.toISOString()
  );
  const failedMonth = q.one("SELECT COUNT(*) AS n FROM analyses WHERE status='failed' AND created_at >= ?", monthStart.toISOString()).n;
  const packagesMonth = q.one(
    "SELECT COUNT(*) AS n, COALESCE(SUM(paid),0) AS revenue FROM ledger WHERE kind='package' AND COALESCE(paid_at, created_at) >= ?",
    monthStart.toISOString()
  );
  const topupsMonth = q.one("SELECT COALESCE(SUM(paid),0) AS amount FROM ledger WHERE kind='topup' AND COALESCE(paid_at, created_at) >= ?", monthStart.toISOString()).amount;
  const daily = q.all(
    `SELECT substr(created_at,1,10) AS day, COUNT(*) AS calls, COALESCE(SUM(billed_seconds),0) AS billed, COALESCE(SUM(cost),0) AS cost, AVG(rating_score) AS avg_rating
     FROM analyses WHERE status='done' AND created_at >= ? GROUP BY day ORDER BY day`,
    since30.toISOString()
  );
  const pendingCompanies = q.one("SELECT COUNT(*) AS n FROM companies WHERE status='pending'").n;
  const lowBalance = q.all(
    `SELECT c.id, c.name, s.type, s.included_seconds, s.used_seconds,
            (SELECT COALESCE(SUM(amount),0) FROM ledger l WHERE l.company_id = c.id) AS balance, s.price_per_minute
     FROM companies c JOIN subscriptions s ON s.company_id = c.id AND s.status = 'active'
     WHERE c.status = 'active'`
  )
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      remainingMinutes: r.type === 'package' ? Math.max(0, (r.included_seconds - r.used_seconds) / 60) : r.price_per_minute > 0 ? Math.floor(r.balance / r.price_per_minute) : null,
    }))
    .filter((r) => r.remainingMinutes !== null && r.remainingMinutes < 30)
    .sort((a, b) => a.remainingMinutes - b.remainingMinutes)
    .slice(0, 5);
  const topCompanies = q.all(
    `SELECT c.id, c.name, c.country, COUNT(a.id) AS calls, COALESCE(SUM(a.billed_seconds),0) AS billed, COALESCE(SUM(a.cost),0) AS cost
     FROM companies c LEFT JOIN analyses a ON a.company_id = c.id AND a.status='done' AND a.created_at >= ?
     GROUP BY c.id ORDER BY billed DESC LIMIT 8`,
    monthStart.toISOString()
  );
  const recent = q.all(
    'SELECT a.*, c.name AS company_name FROM analyses a JOIN companies c ON c.id = a.company_id ORDER BY a.created_at DESC LIMIT 10'
  );

  res.json({
    companies: { total: companies.total, active: companies.active || 0, pending: pendingCompanies },
    lowBalance,
    allTime: { calls: all.calls, minutes: Math.round(all.billed / 60), cost: all.cost },
    thisMonth: {
      calls: month.calls,
      minutes: Math.round(month.billed / 60),
      perMinuteRevenue: month.cost,
      packageRevenue: packagesMonth.revenue,
      packagesSold: packagesMonth.n,
      topups: topupsMonth,
      avgScore: month.avg_score ? Math.round(month.avg_score) : null,
      avgRating: month.avg_rating ? Math.round(month.avg_rating * 10) / 10 : null,
      avgScriptScore: month.avg_script ? Math.round(month.avg_script) : null,
      failed: failedMonth,
      aiCostUsd: Math.round(month.ai_cost * 10000) / 10000,
      aiCostSom: Math.round(month.ai_cost * getPricing().usdRate),
    },
    daily: daily.map((d) => ({ day: d.day, calls: d.calls, minutes: Math.round(d.billed / 60), cost: d.cost, avgRating: d.avg_rating ? Math.round(d.avg_rating * 10) / 10 : null })),
    topCompanies: topCompanies.map((t) => ({ id: t.id, name: t.name, country: t.country, calls: t.calls, minutes: Math.round(t.billed / 60), cost: t.cost })),
    recent: recent.map((r) => ({ ...rowToApi(r, { full: false }), companyId: r.company_id, companyName: r.company_name })),
  });
});

export default router;
