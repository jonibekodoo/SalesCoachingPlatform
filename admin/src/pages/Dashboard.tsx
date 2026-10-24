import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Clock, Phone, Wallet, Package, AlertTriangle, Star } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import type { Stats } from '../types';
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat, StatusBadge, Table, Td, fmtDate, fmtMoney, fmtNum } from '../components/ui';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!stats) return <Spinner />;

  const m = stats.thisMonth;
  const revenue = m.perMinuteRevenue + m.packageRevenue;
  const chart = stats.daily.map((d) => ({ ...d, label: d.day.slice(5) }));

  return (
    <>
      <PageHeader title="Boshqaruv paneli" subtitle={`Joriy oy: ${new Date().toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Daromad (oy)" value={fmtMoney(revenue)} hint={`Daqiqalik ${fmtMoney(m.perMinuteRevenue)} · paketlar ${fmtMoney(m.packageRevenue)}`} icon={<Wallet className="w-4 h-4" />} tone="dark" />
        <Stat label="Tahlillar (oy)" value={fmtNum(m.calls)} hint={m.failed ? `${m.failed} ta xato bilan` : 'Xatosiz'} icon={<Phone className="w-4 h-4" />} />
        <Stat label="Daqiqalar (oy)" value={fmtNum(m.minutes)} hint={`Jami: ${fmtNum(stats.allTime.minutes)} daqiqa`} icon={<Clock className="w-4 h-4" />} />
        <Stat label="Kompaniyalar" value={`${stats.companies.active} / ${stats.companies.total}`} hint="faol / jami" icon={<Building2 className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Soʻnggi 30 kun: daqiqalar" className="lg:col-span-2">
          {chart.length === 0 ? (
            <Empty text="Hali tahlillar yoʻq" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ left: -10, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v: any, name: any) => [name === 'minutes' ? `${v} daq` : name === 'cost' ? fmtMoney(Number(v)) : v, name === 'minutes' ? 'Daqiqa' : name === 'cost' ? 'Summa' : 'Tahlil']}
                  />
                  <Area type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Oy koʻrsatkichlari">
          <div className="space-y-3 text-sm">
            <Row icon={<Package className="w-4 h-4 text-violet-500" />} label="Sotilgan paketlar" value={`${m.packagesSold} ta`} />
            <Row icon={<Wallet className="w-4 h-4 text-emerald-500" />} label="Balans toʻldirishlar" value={fmtMoney(m.topups)} />
            <Row icon={<Star className="w-4 h-4 text-amber-500" />} label="Oʻrtacha ball" value={m.avgScore === null ? '—' : `${m.avgScore} / 100`} />
            <Row icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} label="Xato tahlillar" value={`${m.failed} ta`} />
            <Row icon={<Wallet className="w-4 h-4 text-indigo-500" />} label="Gemini tannarxi (oy)" value={`$${(m.aiCostUsd || 0).toFixed(2)} ≈ ${fmtMoney(m.aiCostSom)}`} />
            <Row icon={<Phone className="w-4 h-4 text-slate-500" />} label="Jami tahlillar (barcha vaqt)" value={fmtNum(stats.allTime.calls)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top kompaniyalar (oy)" padded={false}>
          {stats.topCompanies.length === 0 ? (
            <Empty text="Kompaniyalar yoʻq" />
          ) : (
            <Table head={['Kompaniya', 'Tahlil', 'Daqiqa', 'Summa']}>
              {stats.topCompanies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/companies/${c.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                      {c.name}
                    </Link>
                    <span className="ml-2 text-[10px] font-mono text-slate-400">{c.country}</span>
                  </Td>
                  <Td>{c.calls}</Td>
                  <Td>{c.minutes}</Td>
                  <Td>{fmtMoney(c.cost)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Soʻnggi tahlillar" padded={false}>
          {stats.recent.length === 0 ? (
            <Empty text="Hali tahlillar yoʻq" />
          ) : (
            <Table head={['Vaqt', 'Kompaniya', 'Nomi', 'Holat']}>
              {stats.recent.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(a.createdAt)}</Td>
                  <Td className="text-xs">{a.companyName}</Td>
                  <Td>
                    <Link to={`/analyses/${a.id}`} className="font-semibold text-slate-900 hover:text-indigo-700 line-clamp-1">
                      {a.title || a.fileName || a.id}
                    </Link>
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-2 text-slate-600">
      {icon}
      {label}
    </div>
    <div className="font-bold text-slate-900">{value}</div>
  </div>
);
