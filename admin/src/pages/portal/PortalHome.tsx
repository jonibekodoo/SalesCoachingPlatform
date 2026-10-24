import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Package, Phone, Star, UploadCloud, Wallet, FileText, Globe } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { portal } from '../../api';
import type { AnalysisSummary, Company, PortalAccount } from '../../types';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat, StatusBadge, Table, Td, fmtDate, fmtMinutes, fmtMoney, fmtNum } from '../../components/ui';
import { AnalysisTable } from '../Analyses';

export default function PortalHome({ company }: { company: Company }) {
  const [acc, setAcc] = useState<PortalAccount | null>(null);
  const [recent, setRecent] = useState<AnalysisSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portal.account().then(setAcc).catch((e) => setError(e.message));
    portal
      .analyses({ limit: 8 })
      .then((r) => setRecent(r.items))
      .catch(() => setRecent([]));
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!acc) return <Spinner />;
  const a = acc.account;
  const sub = a.subscription;
  const chart = acc.daily.map((d) => ({ ...d, label: d.day.slice(5) }));

  return (
    <>
      <PageHeader
        title={company.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={company.status} />
            <Badge tone="indigo">
              <Globe className="w-3 h-3" /> {company.countryName} · {company.language}
              {company.outputLanguage && company.outputLanguageName !== company.language && <span> → {company.outputLanguageName}</span>}
            </Badge>
            {company.hasScript && (
              <Badge tone="green">
                <FileText className="w-3 h-3" /> Skript bor
              </Badge>
            )}
          </span>
        }
        actions={
          <Link to="/portal/analyze">
            <Button icon={<UploadCloud className="w-4 h-4" />}>Audio yuklash</Button>
          </Link>
        }
      />

      {company.status === 'pending' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-6 text-sm text-amber-900">
          <strong>Toʻlov kutilmoqda.</strong> {a.pendingSubscription ? `Tanlangan tarif: ${a.pendingSubscription.planName}. ` : ''}Toʻlov tasdiqlangach hisob ochiladi va tahlil qilish mumkin boʻladi.
        </div>
      )}
      {company.status === 'active' && !a.canAnalyze && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 mb-6 text-sm text-rose-900">
          <strong>Tahlil qilib boʻlmaydi:</strong> {!sub ? 'tarif biriktirilmagan.' : sub.type === 'package' ? 'paket daqiqalari tugagan.' : 'balans yetarli emas.'} Administrator bilan bogʻlaning.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Tarif"
          value={sub ? sub.planName : a.pendingSubscription ? a.pendingSubscription.planName : 'Yoʻq'}
          hint={sub ? (sub.type === 'package' ? `Paket · ${sub.expiresAt ? `${fmtDate(sub.expiresAt, false)} gacha` : 'muddatsiz'}` : `${fmtMoney(sub.pricePerMinute)} / daqiqa`) : a.pendingSubscription ? 'toʻlov kutilmoqda' : ''}
          tone="dark"
          icon={sub?.type === 'package' ? <Package className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        />
        <Stat
          label="Qoldiq"
          value={<span className={a.canAnalyze ? '' : 'text-rose-600'}>{fmtMinutes(a.remainingMinutes)}</span>}
          hint={sub?.type === 'package' ? `${fmtNum(sub.usedMinutes)} / ${fmtNum(sub.includedMinutes)} daqiqa ishlatilgan` : `Balans: ${fmtMoney(a.balance)}`}
          icon={<Wallet className="w-4 h-4" />}
        />
        <Stat label="Shu oy" value={`${a.thisMonth.calls} tahlil`} hint={`${a.thisMonth.minutes} daqiqa${sub?.type === 'per_minute' ? ` · ${fmtMoney(a.thisMonth.cost)}` : ''}`} icon={<Phone className="w-4 h-4" />} />
        <Stat
          label="Oʻrtacha baho"
          value={acc.totals.avgRating === null ? '—' : `${acc.totals.avgRating.toFixed(1)} / 10`}
          hint={`${acc.totals.avgScore !== null ? `${acc.totals.avgScore}/100` : ''}${acc.totals.avgScriptScore !== null ? ` · skript ${acc.totals.avgScriptScore}%` : ''} · jami ${acc.totals.calls} tahlil`}
          icon={<Star className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Soʻnggi 30 kun: daqiqalar" className="lg:col-span-2">
          {chart.length === 0 ? (
            <Empty text="Hali tahlillar yoʻq" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ left: -10, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="pg1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any, n: any) => [n === 'minutes' ? `${v} daq` : v, n === 'minutes' ? 'Daqiqa' : 'Tahlil']} />
                  <Area type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2} fill="url(#pg1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Oylar boʻyicha" padded={false}>
          {acc.monthly.length === 0 ? (
            <Empty text="Maʼlumot yoʻq" />
          ) : (
            <Table head={['Oy', 'Tahlil', 'Daq', 'Ball']}>
              {acc.monthly.map((m) => (
                <tr key={m.month}>
                  <Td mono>{m.month}</Td>
                  <Td>{m.calls}</Td>
                  <Td>{m.minutes}</Td>
                  <Td>{m.avgScore ?? '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card
        title="Soʻnggi tahlillar"
        padded={false}
        actions={
          <Link to="/portal/analyses" className="text-xs font-semibold text-indigo-700 hover:underline">
            Barchasi →
          </Link>
        }
      >
        {!recent ? <Spinner /> : recent.length === 0 ? <Empty text="Hali tahlil yoʻq. Birinchi audioni yuklang." /> : <AnalysisTable items={recent} linkBase="/portal/analyses" />}
      </Card>
    </>
  );
}
