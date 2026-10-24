import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Clock, Phone, Wallet, Package, AlertTriangle, Star, ArrowUpRight, Sparkles, TrendingUp, Cpu, BadgeCheck, Hourglass, ChevronRight } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import type { Stats } from '../types';
import { Badge, Card, Empty, ErrorBox, RatingBadge, Spinner, StatusBadge, cx, fmtDate, fmtMoney, fmtNum } from '../components/ui';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
type Metric = 'minutes' | 'calls';

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px rgba(15,23,42,.08)' };

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('minutes');

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  // Fill the last 30 days so quiet days show as zero instead of disappearing
  const series = useMemo(() => {
    if (!stats) return [];
    const byDay = new Map(stats.daily.map((d) => [d.day, d]));
    const out: { day: string; label: string; minutes: number; calls: number; cost: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const row = byDay.get(key);
      out.push({ day: key, label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, minutes: row?.minutes || 0, calls: row?.calls || 0, cost: row?.cost || 0 });
    }
    return out;
  }, [stats]);

  if (error) return <ErrorBox error={error} />;
  if (!stats) return <Spinner />;

  const m = stats.thisMonth;
  const revenue = m.perMinuteRevenue + m.packageRevenue + m.topups;
  const margin = revenue > 0 ? Math.round(((revenue - m.aiCostSom) / revenue) * 100) : null;
  const last7 = series.slice(-7).reduce((a, d) => a + d.minutes, 0);
  const prev7 = series.slice(-14, -7).reduce((a, d) => a + d.minutes, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const now = new Date();
  const maxCompanyMinutes = Math.max(1, ...stats.topCompanies.map((c) => c.minutes));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-6 md:p-8 ring-1 ring-white/10 fade-up">
        <div className="pointer-events-none absolute -top-24 -left-10 w-80 h-80 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-10 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
              <Sparkles className="w-3 h-3" /> Boshqaruv paneli · {MONTHS[now.getMonth()]} {now.getFullYear()}
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">{fmtMoney(revenue)}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Shu oyda kelib tushgan toʻlovlar · paketlar {fmtMoney(m.packageRevenue)} · balans {fmtMoney(m.topups)}
              {m.perMinuteRevenue > 0 && ` · daqiqalik yechimlar ${fmtMoney(m.perMinuteRevenue)}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroPill icon={<Cpu className="w-3.5 h-3.5" />} label="Gemini tannarxi" value={`$${m.aiCostUsd.toFixed(2)} ≈ ${fmtMoney(m.aiCostSom)}`} />
              <HeroPill icon={<TrendingUp className="w-3.5 h-3.5" />} label="Marja" value={margin === null ? '—' : `${margin}%`} tone={margin !== null && margin < 30 ? 'warn' : 'ok'} />
              <HeroPill icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Xato tahlillar" value={`${m.failed} ta`} tone={m.failed > 0 ? 'warn' : 'ok'} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[460px] shrink-0">
            <HeroKpi icon={<Phone className="w-4 h-4" />} label="Tahlillar" value={fmtNum(m.calls)} hint="shu oy" />
            <HeroKpi icon={<Clock className="w-4 h-4" />} label="Daqiqalar" value={fmtNum(m.minutes)} hint={trend === null ? 'shu oy' : `7 kun: ${trend > 0 ? '+' : ''}${trend}%`} />
            <HeroKpi icon={<Star className="w-4 h-4" />} label="Oʻrtacha baho" value={m.avgRating === null ? '—' : `${m.avgRating.toFixed(1)}`} hint={m.avgRating === null ? 'hali yoʻq' : '/ 10'} />
          </div>
        </div>
      </div>

      {/* Secondary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          icon={<Building2 className="w-4 h-4 text-indigo-600" />}
          label="Kompaniyalar"
          value={`${stats.companies.active}`}
          hint={`jami ${stats.companies.total}${stats.companies.pending ? ` · ${stats.companies.pending} ta toʻlov kutmoqda` : ''}`}
          to="/companies"
          alert={stats.companies.pending > 0}
        />
        <Tile icon={<Package className="w-4 h-4 text-violet-600" />} label="Sotilgan paketlar" value={`${m.packagesSold} ta`} hint={fmtMoney(m.packageRevenue)} to="/payments" />
        <Tile icon={<Wallet className="w-4 h-4 text-emerald-600" />} label="Balans toʻldirishlar" value={fmtMoney(m.topups)} hint="shu oy" to="/payments?kind=topup" />
        <Tile icon={<BadgeCheck className="w-4 h-4 text-sky-600" />} label="Barcha vaqt" value={fmtNum(stats.allTime.calls)} hint={`${fmtNum(stats.allTime.minutes)} daqiqa tahlil qilindi`} to="/analyses" />
      </div>

      {/* Chart + side column */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card
          className="xl:col-span-2"
          title="Soʻnggi 30 kun"
          actions={
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              {(['minutes', 'calls'] as Metric[]).map((k) => (
                <button key={k} onClick={() => setMetric(k)} className={cx('px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition', metric === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800')}>
                  {k === 'minutes' ? 'Daqiqalar' : 'Tahlillar'}
                </button>
              ))}
            </div>
          }
        >
          {stats.allTime.calls === 0 ? (
            <Empty text="Hali tahlillar yoʻq. Birinchi kompaniyani qoʻshib token bering." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {metric === 'minutes' ? (
                  <AreaChart data={series} margin={{ left: -14, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} daq`, 'Daqiqa']} labelFormatter={(l) => `Kun: ${l}`} />
                    <Area type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2} fill="url(#dashArea)" dot={{ r: 2.5, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                ) : (
                  <BarChart data={series} margin={{ left: -14, right: 8, top: 8 }} barCategoryGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any) => [`${v} ta`, 'Tahlil']} labelFormatter={(l) => `Kun: ${l}`} />
                    <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Sifat (shu oy)">
            <div className="space-y-3">
              <Meter label="Oʻrtacha baho" value={m.avgRating} max={10} fmt={(v) => `${v.toFixed(1)} / 10`} />
              <Meter label="Umumiy ball" value={m.avgScore} max={100} fmt={(v) => `${Math.round(v)} / 100`} />
              <Meter label="Skriptga muvofiqlik" value={m.avgScriptScore} max={100} fmt={(v) => `${Math.round(v)}%`} />
            </div>
          </Card>

          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-amber-500" /> Eʼtibor kerak
              </span>
            }
            padded={false}
          >
            {stats.lowBalance.length === 0 && stats.companies.pending === 0 ? (
              <div className="px-5 py-6 text-xs text-slate-500 text-center">Hammasi joyida: limit tugayotgan yoki toʻlov kutayotgan kompaniya yoʻq.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.companies.pending > 0 && (
                  <Link to="/companies" className="flex items-center justify-between px-5 py-3 text-xs hover:bg-slate-50">
                    <span className="font-semibold text-slate-800">Toʻlov kutayotgan kompaniyalar</span>
                    <Badge tone="amber">{stats.companies.pending} ta</Badge>
                  </Link>
                )}
                {stats.lowBalance.map((c) => (
                  <Link key={c.id} to={`/companies/${c.id}`} className="flex items-center justify-between px-5 py-3 text-xs hover:bg-slate-50">
                    <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                    <Badge tone={c.remainingMinutes < 10 ? 'red' : 'amber'}>{Math.round(c.remainingMinutes)} daq qoldi</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          title="Top kompaniyalar (shu oy)"
          padded={false}
          actions={
            <Link to="/companies" className="text-xs font-semibold text-indigo-700 hover:underline inline-flex items-center gap-0.5">
              Barchasi <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {stats.topCompanies.filter((c) => c.calls > 0).length === 0 ? (
            <Empty text="Bu oyda faol kompaniya yoʻq" />
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.topCompanies
                .filter((c) => c.calls > 0)
                .map((c, i) => (
                  <Link key={c.id} to={`/companies/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {c.name} <span className="ml-1 text-[10px] font-mono text-slate-400">{c.country}</span>
                        </span>
                        <span className="text-xs text-slate-600 whitespace-nowrap">
                          {c.calls} tahlil · {c.minutes} daq{c.cost > 0 && ` · ${fmtMoney(c.cost)}`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(4, (c.minutes / maxCompanyMinutes) * 100)}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </Card>

        <Card
          title="Soʻnggi tahlillar"
          padded={false}
          actions={
            <Link to="/analyses" className="text-xs font-semibold text-indigo-700 hover:underline inline-flex items-center gap-0.5">
              Barchasi <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {stats.recent.length === 0 ? (
            <Empty text="Hali tahlillar yoʻq" />
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent.map((a) => (
                <Link key={a.id} to={`/analyses/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{a.title || a.fileName || a.id}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {a.companyName} · {fmtDate(a.createdAt)}
                      {a.externalId && ` · ${a.externalId}`}
                    </div>
                  </div>
                  {a.status === 'done' ? <RatingBadge rating={a.rating} compact /> : <StatusBadge status={a.status} />}
                  <ArrowUpRight className="w-4 h-4 text-slate-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const HeroKpi = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur px-4 py-3 min-w-0">
    <div className="flex items-center justify-between text-slate-400">
      <span className="text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
      <span className="text-indigo-300">{icon}</span>
    </div>
    <div className="text-2xl font-extrabold mt-1 truncate">{value}</div>
    {hint && <div className="text-[11px] text-slate-400 truncate">{hint}</div>}
  </div>
);

const HeroPill = ({ icon, label, value, tone = 'ok' }: { icon: React.ReactNode; label: string; value: string; tone?: 'ok' | 'warn' }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs', tone === 'warn' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-200')}>
    {icon}
    <span className="text-slate-400">{label}:</span>
    <span className="font-bold">{value}</span>
  </span>
);

const Tile = ({ icon, label, value, hint, to, alert }: { icon: React.ReactNode; label: string; value: string; hint?: string; to: string; alert?: boolean }) => (
  <Link to={to} className={cx('group rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 fade-up', alert ? 'border-amber-300' : 'border-slate-200')}>
    <div className="flex items-center justify-between">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">{icon}</div>
      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition" />
    </div>
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-3">{label}</div>
    <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{value}</div>
    {hint && <div className={cx('text-xs mt-0.5', alert ? 'text-amber-700 font-semibold' : 'text-slate-500')}>{hint}</div>}
  </Link>
);

const Meter = ({ label, value, max, fmt }: { label: string; value: number | null; max: number; fmt: (v: number) => string }) => {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const color = value === null ? '#cbd5e1' : pct >= 80 ? '#10b981' : pct >= 60 ? '#0ea5e9' : pct >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value === null ? '—' : fmt(value)}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};
