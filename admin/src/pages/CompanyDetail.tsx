import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, KeyRound, Plus, Copy, Check, Ban, Wallet, Package, Clock, Globe, ListChecks, BarChart3, Braces, Save, X, BadgeCheck, FileText, UploadCloud, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import type { Account, CompanyDetail, Country, FieldDef, FieldType, Plan, Report, AnalysisSummary, Subscription } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, StatusBadge, Table, Td, Textarea, cx, fmtDate, fmtMinutes, fmtMoney, fmtNum } from '../components/ui';
import { CompanyForm } from './Companies';
import { AnalysisTable } from './Analyses';

type Tab = 'overview' | 'tokens' | 'billing' | 'fields' | 'script' | 'analyses';
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Hisobot', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'billing', label: 'Tarif va balans', icon: <Wallet className="w-4 h-4" /> },
  { key: 'tokens', label: 'API tokenlar', icon: <KeyRound className="w-4 h-4" /> },
  { key: 'fields', label: 'CRM fieldlar', icon: <Braces className="w-4 h-4" /> },
  { key: 'script', label: 'Sotuv skripti', icon: <FileText className="w-4 h-4" /> },
  { key: 'analyses', label: 'Tahlillar', icon: <ListChecks className="w-4 h-4" /> },
];

export default function CompanyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [countries, setCountries] = useState<Country[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => api.company(id).then(setC).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    load();
    api.meta().then((m) => setCountries(m.countries)).catch(() => {});
  }, [load]);

  const remove = async () => {
    if (!c) return;
    if (!confirm(`"${c.name}" kompaniyasini barcha tokenlari, tahlillari va hisoblari bilan oʻchirasizmi? Bu qaytarib boʻlmaydi.`)) return;
    await api.deleteCompany(c.id);
    navigate('/companies');
  };

  if (error) return <ErrorBox error={error} />;
  if (!c) return <Spinner />;
  const acc = c.account;

  return (
    <>
      <PageHeader
        back={
          <Link to="/companies" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Kompaniyalar
          </Link>
        }
        title={c.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <Badge tone="indigo">
              <Globe className="w-3 h-3" /> {c.countryName} · {c.language}
            </Badge>
            {c.contactName && <span>{c.contactName}</span>}
            {c.phone && <span>· {c.phone}</span>}
            {c.email && <span>· {c.email}</span>}
            <span className="text-slate-400">· {fmtDate(c.createdAt, false)} dan</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditing(true)}>
              Tahrirlash
            </Button>
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>
              Oʻchirish
            </Button>
          </>
        }
      />

      {acc.pendingSubscription && <ActivationCard c={c} sub={acc.pendingSubscription} onChange={load} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Tarif"
          value={acc.subscription ? acc.subscription.planName : 'Yoʻq'}
          hint={acc.subscription ? (acc.subscription.type === 'package' ? `Paket · ${acc.subscription.expiresAt ? `${fmtDate(acc.subscription.expiresAt, false)} gacha` : 'muddatsiz'}` : `${fmtMoney(acc.subscription.pricePerMinute)} / daqiqa`) : 'Tarif va balans boʻlimida biriktiring'}
          tone="dark"
          icon={acc.subscription?.type === 'package' ? <Package className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        />
        <Stat
          label="Qoldiq"
          value={<span className={acc.canAnalyze ? '' : 'text-rose-600'}>{fmtMinutes(acc.remainingMinutes)}</span>}
          hint={acc.subscription?.type === 'package' ? `${fmtNum(acc.subscription.usedMinutes)} / ${fmtNum(acc.subscription.includedMinutes)} daqiqa ishlatilgan` : `Balans: ${fmtMoney(acc.balance)}`}
        />
        <Stat label="Shu oy" value={`${acc.thisMonth.calls} tahlil`} hint={`${acc.thisMonth.minutes} daqiqa · ${fmtMoney(acc.thisMonth.cost)}`} />
        <Stat
          label="API holati"
          value={acc.canAnalyze ? <span className="text-emerald-600">Tayyor</span> : <span className="text-rose-600">Bloklangan</span>}
          hint={
            acc.canAnalyze
              ? `${c.tokens.filter((t) => !t.revokedAt).length} ta faol token`
              : c.status === 'pending'
                ? 'Toʻlov tasdiqlanishi kutilmoqda'
                : c.status !== 'active'
                  ? 'Kompaniya toʻxtatilgan'
                  : !acc.subscription
                    ? 'Tarif yoʻq'
                    : 'Limit yoki balans tugagan'
          }
        />
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 overflow-x-auto thin-scroll">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {t.icon}
            {t.label}
            {t.key === 'fields' && c.customFields.length > 0 && <span className="text-[10px] bg-slate-200 rounded-full px-1.5">{c.customFields.length}</span>}
            {t.key === 'script' && c.hasScript && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Skript kiritilgan" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab companyId={c.id} />}
      {tab === 'billing' && <BillingTab c={c} onChange={load} />}
      {tab === 'tokens' && <TokensTab c={c} onChange={load} />}
      {tab === 'fields' && <FieldsTab c={c} onChange={load} />}
      {tab === 'script' && <ScriptTab c={c} onChange={load} />}
      {tab === 'analyses' && <AnalysesTab c={c} onChange={load} />}

      <CompanyForm open={editing} onClose={() => setEditing(false)} countries={countries} initial={c} onSaved={() => load()} />
    </>
  );
}

// ---------------------------------------------------------------------------

// Shown while the chosen plan waits for its payment: confirming opens the company
const ActivationCard: React.FC<{ c: CompanyDetail; sub: Subscription; onChange: () => Promise<void> | void }> = ({ c, sub, onChange }) => {
  const [amount, setAmount] = useState<string>(sub.type === 'package' ? String(sub.price) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.activateSubscription(c.id, sub.id, { amount: amount === '' ? undefined : Number(amount), note });
      await onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 mb-6 fade-up">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Toʻlov kutilmoqda</div>
          <div className="text-lg font-extrabold text-slate-900 mt-0.5">
            {sub.planName}{' '}
            <span className="text-sm font-semibold text-slate-600">
              {sub.type === 'package' ? `— ${fmtNum(sub.includedMinutes)} daqiqa, ${fmtMoney(sub.price)}` : `— ${fmtMoney(sub.pricePerMinute)} / daqiqa`}
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            {sub.type === 'package'
              ? 'Kompaniya paket pulini toʻlagach «Tasdiqlash» tugmasini bosing: paket shu kundan boshlanadi, kompaniya ochiladi va API tokenlari ishlay boshlaydi.'
              : 'Kompaniya boshlangʻich toʻlovni qilgach summani kiriting va tasdiqlang: summa balansga tushadi, kompaniya ochiladi.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 lg:w-[520px]">
          <Field label={sub.type === 'package' ? 'Toʻlangan summa (soʻm)' : 'Boshlangʻich toʻlov (soʻm)'} className="flex-1">
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={sub.type === 'package' ? String(sub.price) : '1000000'} />
          </Field>
          <Field label="Izoh" className="flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Toʻlov №, sana" />
          </Field>
          <div className="flex items-end">
            <Button variant="success" loading={busy} icon={<BadgeCheck className="w-4 h-4" />} onClick={confirm} className="w-full sm:w-auto whitespace-nowrap">
              Toʻlovni tasdiqlash va ochish
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox error={error} />
        </div>
      )}
    </div>
  );
};

const OverviewTab: React.FC<{ companyId: string }> = ({ companyId }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [range, setRange] = useState<30 | 90 | 365>(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    const to = new Date();
    const from = new Date(Date.now() - (range - 1) * 86400000);
    api.report(companyId, from.toISOString(), to.toISOString()).then(setReport).catch((e) => setError(e.message));
  }, [companyId, range]);

  if (error) return <ErrorBox error={error} />;
  if (!report) return <Spinner />;
  const data = report.daily.map((d) => ({ ...d, label: d.day.slice(5) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card
        className="lg:col-span-2"
        title={`Kunlik foydalanish (${range} kun)`}
        actions={
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
            {([30, 90, 365] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cx('px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer', range === r ? 'bg-white shadow-sm' : 'text-slate-500')}>
                {r} kun
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
          <Mini label="Tahlillar" value={fmtNum(report.totals.calls)} />
          <Mini label="Daqiqalar" value={fmtNum(report.totals.minutes)} />
          <Mini label="Summa" value={fmtMoney(report.totals.cost)} />
          <Mini label="Gemini tannarxi" value={`$${(report.totals.aiCostUsd || 0).toFixed(2)}`} />
        </div>
        {data.length === 0 ? (
          <Empty text="Bu davrda tahlillar yoʻq" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -10, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any, n: any) => [n === 'minutes' ? `${v} daq` : v, n === 'minutes' ? 'Daqiqa' : 'Tahlil']} />
                <Bar dataKey="minutes" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="space-y-6">
        <Card title="Oylar boʻyicha" padded={false}>
          {report.monthly.length === 0 ? (
            <Empty text="Maʼlumot yoʻq" />
          ) : (
            <Table head={['Oy', 'Tahlil', 'Daq', 'Summa', 'Ball']}>
              {report.monthly.map((m) => (
                <tr key={m.month}>
                  <Td mono>{m.month}</Td>
                  <Td>{m.calls}</Td>
                  <Td>{m.minutes}</Td>
                  <Td className="text-xs whitespace-nowrap">{fmtMoney(m.cost)}</Td>
                  <Td>{m.avgScore ?? '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Baholar taqsimoti">
          {report.grades.length === 0 ? (
            <Empty text="Maʼlumot yoʻq" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.grades.map((g) => (
                <Badge key={g.grade} tone={g.grade.startsWith('A') ? 'green' : g.grade.startsWith('B') ? 'sky' : g.grade.startsWith('C') ? 'amber' : 'red'}>
                  {g.grade || '—'} × {g.n}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const Mini = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 py-2">
    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</div>
    <div className="text-base font-extrabold text-slate-900">{value}</div>
  </div>
);

// ---------------------------------------------------------------------------

const BillingTab: React.FC<{ c: CompanyDetail; onChange: () => Promise<void> | void }> = ({ c, onChange }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [paid, setPaid] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans().then((p) => setPlans(p.filter((x) => x.isActive))).catch(() => {});
  }, []);
  const plan = plans.find((p) => p.id === planId);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-6">
        <Card title="Tarif biriktirish">
          <div className="space-y-3">
            <Field label="Tarif">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Tanlang…</option>
                <optgroup label="Daqiqalik">
                  {plans.filter((p) => p.type === 'per_minute').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmtMoney(p.pricePerMinute)}/daq
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Paketlar">
                  {plans.filter((p) => p.type === 'package').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmtNum(p.includedMinutes)} daq, {fmtMoney(p.price)}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            {plan && (
              <>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {plan.type === 'package'
                    ? `${fmtNum(plan.includedMinutes)} daqiqa (${Math.round((plan.includedMinutes / 60) * 10) / 10} soat) limit${plan.validityDays ? `, ${plan.validityDays} kun amal qiladi` : ''}. Toʻlov qilingan boʻlsa summani kiritib darhol oching, aks holda «Toʻlov kutish» bilan biriktiring.`
                    : `Har tahlil uchun ${fmtMoney(plan.pricePerMinute)} × daqiqa balansdan yechiladi. Boshlangʻich toʻlov summasi balansga tushadi.`}
                </p>
                <Field label={plan.type === 'package' ? 'Toʻlangan summa (soʻm)' : 'Boshlangʻich toʻlov (soʻm)'}>
                  <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={plan.type === 'package' ? String(plan.price) : '0'} />
                </Field>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!planId}
                loading={busy === 'sub'}
                icon={<BadgeCheck className="w-4 h-4" />}
                onClick={() =>
                  run('sub', async () => {
                    await api.subscribe(c.id, planId, { paidAmount: paid === '' ? undefined : Number(paid) });
                    setPaid('');
                  })
                }
              >
                Toʻlangan, ochish
              </Button>
              <Button
                variant="secondary"
                disabled={!planId}
                loading={busy === 'subp'}
                icon={<Clock className="w-4 h-4" />}
                onClick={() => run('subp', () => api.subscribe(c.id, planId, { activate: false }))}
              >
                Toʻlov kutish
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Balansni toʻldirish">
          <div className="space-y-3">
            <Field label="Summa (soʻm)" hint="Manfiy summa — tuzatish (balansdan yechish)">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000000" />
            </Field>
            <Field label="Izoh">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Toʻlov №, sana…" />
            </Field>
            <Button
              variant="success"
              disabled={!amount || Number(amount) === 0}
              loading={busy === 'top'}
              icon={<Wallet className="w-4 h-4" />}
              className="w-full"
              onClick={() =>
                run('top', async () => {
                  await api.topUp(c.id, Number(amount), note);
                  setAmount('');
                  setNote('');
                })
              }
            >
              Toʻldirish
            </Button>
            <div className="text-xs text-slate-600 text-center">
              Joriy balans: <strong>{fmtMoney(c.account.balance)}</strong>
            </div>
          </div>
        </Card>
        <ErrorBox error={error} />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card title="Obunalar / paketlar" padded={false}>
          {c.subscriptions.length === 0 ? (
            <Empty text="Hali tarif biriktirilmagan" />
          ) : (
            <Table head={['Tarif', 'Turi', 'Ishlatilgan', 'Narx', 'Boshlangan', 'Muddat', 'Holat', '']}>
              {c.subscriptions.map((s) => (
                <tr key={s.id} className={s.status !== 'active' ? 'opacity-60' : ''}>
                  <Td className="font-semibold">{s.planName}</Td>
                  <Td>
                    <Badge tone={s.type === 'package' ? 'violet' : 'sky'}>{s.type === 'package' ? 'Paket' : 'Daqiqalik'}</Badge>
                  </Td>
                  <Td className="text-xs">
                    {s.type === 'package' ? (
                      <div>
                        <div>
                          {fmtNum(s.usedMinutes)} / {fmtNum(s.includedMinutes)} daq
                        </div>
                        <div className="h-1.5 w-28 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (s.usedMinutes / Math.max(1, s.includedMinutes)) * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      `${fmtNum(s.usedMinutes)} daq`
                    )}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{s.type === 'package' ? fmtMoney(s.price) : `${fmtMoney(s.pricePerMinute)}/daq`}</Td>
                  <Td className="text-xs whitespace-nowrap">{fmtDate(s.startedAt, false)}</Td>
                  <Td className="text-xs whitespace-nowrap">{s.expiresAt ? fmtDate(s.expiresAt, false) : '—'}</Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td>
                    {(s.status === 'active' || s.status === 'pending') && (
                      <Button variant="ghost" size="sm" title="Bekor qilish" icon={<Ban className="w-3.5 h-3.5 text-rose-600" />} loading={busy === s.id} onClick={() => confirm('Obunani bekor qilasizmi?') && run(s.id, () => api.cancelSubscription(c.id, s.id))} />
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Hisob harakati (soʻnggi 100)"
          padded={false}
          actions={
            <Link to={`/payments?companyId=${c.id}`} className="text-xs font-semibold text-indigo-700 hover:underline">
              Toʻlovlarni boshqarish →
            </Link>
          }
        >
          {c.ledger.length === 0 ? (
            <Empty text="Harakatlar yoʻq" />
          ) : (
            <Table head={['Sana', 'Turi', 'Izoh', 'Toʻlangan', 'Balansga']}>
              {c.ledger.map((l) => (
                <tr key={l.id}>
                  <Td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(l.paidAt || l.createdAt)}</Td>
                  <Td>
                    <Badge tone={l.kind === 'topup' ? 'green' : l.kind === 'charge' ? 'slate' : l.kind === 'package' ? 'violet' : 'amber'}>
                      {{ topup: 'Toʻldirish', charge: 'Yechim', adjustment: 'Tuzatish', package: 'Paket' }[l.kind]}
                    </Badge>
                  </Td>
                  <Td className="text-xs">
                    {l.note}
                    {l.subscriptionName && <span className="ml-1 text-slate-400">· {l.subscriptionName}</span>}
                    {l.method && <span className="ml-1 text-slate-400">· {l.method}</span>}
                    {l.analysisId && (
                      <Link to={`/analyses/${l.analysisId}`} className="ml-1 text-indigo-600 hover:underline font-mono text-[11px]">
                        {l.analysisId}
                      </Link>
                    )}
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap text-slate-800">{l.paid > 0 ? fmtMoney(l.paid) : '—'}</Td>
                  <Td className={cx('font-mono text-xs whitespace-nowrap', l.amount > 0 ? 'text-emerald-700' : l.amount < 0 ? 'text-rose-700' : 'text-slate-400')}>
                    {l.amount > 0 ? '+' : ''}
                    {l.amount === 0 ? '—' : fmtMoney(l.amount)}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const TokensTab: React.FC<{ c: CompanyDetail; onChange: () => Promise<void> | void }> = ({ c, onChange }) => {
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await api.createToken(c.id, name.trim() || 'default');
      setCreated(t.token);
      setName('');
      await onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Tokenni bekor qilasizmi? CRM shu token bilan boshqa soʻrov yubora olmaydi.')) return;
    await api.revokeToken(c.id, id);
    await onChange();
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Yangi token">
        <div className="space-y-3">
          <Field label="Nomi" hint="Masalan: AmoCRM prod, Bitrix test">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="default" />
          </Field>
          <Button loading={busy} icon={<KeyRound className="w-4 h-4" />} onClick={create} className="w-full">
            Token yaratish
          </Button>
          <ErrorBox error={error} />
          <p className="text-[11px] text-slate-500">
            CRM soʻrovlarda <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> sarlavhasini yuboradi. Token faqat bir marta koʻrsatiladi, bazada xeshi saqlanadi.
          </p>
        </div>
      </Card>

      <Card title="Tokenlar" className="lg:col-span-2" padded={false}>
        {c.tokens.length === 0 ? (
          <Empty text="Token yaratilmagan" />
        ) : (
          <Table head={['Nomi', 'Prefiks', 'Yaratilgan', 'Oxirgi ishlatilgan', 'Holat', '']}>
            {c.tokens.map((t) => (
              <tr key={t.id} className={t.revokedAt ? 'opacity-50' : ''}>
                <Td className="font-semibold">{t.name}</Td>
                <Td mono>{t.prefix}…</Td>
                <Td className="text-xs whitespace-nowrap">{fmtDate(t.createdAt)}</Td>
                <Td className="text-xs whitespace-nowrap">{fmtDate(t.lastUsedAt)}</Td>
                <Td>{t.revokedAt ? <Badge tone="red">Bekor qilingan</Badge> : <Badge tone="green">Faol</Badge>}</Td>
                <Td>{!t.revokedAt && <Button variant="ghost" size="sm" icon={<Ban className="w-3.5 h-3.5 text-rose-600" />} onClick={() => revoke(t.id)} title="Bekor qilish" />}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Token yaratildi — hozir nusxalab oling">
        <p className="text-sm text-slate-600 mb-3">Bu token boshqa koʻrsatilmaydi. Uni CRM sozlamalariga joylashtiring.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs bg-slate-900 text-emerald-300 rounded-lg px-3 py-2.5 break-all">{created}</code>
          <Button variant="secondary" icon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} onClick={copy}>
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </Button>
        </div>
        <div className="mt-4 text-xs text-slate-600">
          Tekshirish:
          <pre className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto thin-scroll text-[11px] font-mono">{`curl ${window.location.origin}/api/v1/account \\\n  -H "Authorization: Bearer ${created}"`}</pre>
        </div>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Matn',
  number: 'Raqam',
  boolean: 'Ha / yoʻq',
  date: 'Sana (YYYY-MM-DD)',
  select: 'Tanlov (variantlar)',
  list: 'Roʻyxat',
};

type FieldRow = FieldDef & { optionsText?: string };

const FieldsTab: React.FC<{ c: CompanyDetail; onChange: () => Promise<void> | void }> = ({ c, onChange }) => {
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(c.customFields.map((f) => ({ ...f, optionsText: (f.options || []).join(', ') })));
    setDirty(false);
  }, [c]);

  const update = (i: number, patch: Partial<FieldRow>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setDirty(true);
  };
  const add = () => {
    setRows((r) => [...r, { key: '', label: '', type: 'text', description: '', optionsText: '' }]);
    setDirty(true);
  };
  const remove = (i: number) => {
    setRows((r) => r.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const customFields: FieldDef[] = rows.map((r) => ({
        key: r.key.trim(),
        label: r.label.trim() || r.key.trim(),
        type: r.type,
        description: r.description?.trim() || '',
        ...(r.type === 'select' ? { options: (r.optionsText || '').split(',').map((s) => s.trim()).filter(Boolean) } : {}),
      }));
      await api.updateCompany(c.id, { customFields });
      await onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const example = useMemo(() => {
    const obj: Record<string, unknown> = {};
    rows.forEach((r) => {
      obj[r.key || 'key'] = r.type === 'number' ? 1500000 : r.type === 'boolean' ? true : r.type === 'date' ? '2026-10-20' : r.type === 'list' ? ['…', '…'] : r.type === 'select' ? (r.optionsText || '').split(',')[0]?.trim() || '…' : '…';
    });
    return JSON.stringify(obj, null, 2);
  }, [rows]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card
        className="lg:col-span-2"
        title="Standart CRM fieldlar"
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={add}>
              Field qoʻshish
            </Button>
            <Button size="sm" icon={<Save className="w-3.5 h-3.5" />} loading={saving} disabled={!dirty} onClick={save}>
              Saqlash
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 mb-4">
          Bu fieldlar shu kompaniyaning har bir tahlilida avtomatik toʻldiriladi. CRM soʻrov bilan qoʻshimcha <code className="font-mono">customFields</code> yuborsa, ular bu roʻyxatga qoʻshiladi (bir xil key boʻlsa soʻrovdagisi ustun).
        </p>
        {rows.length === 0 ? (
          <Empty text="Field yoʻq. CRM har soʻrovda oʻzi yuborishi ham mumkin." />
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-slate-50/50">
                <Field label="Key *" className="md:col-span-3">
                  <Input value={r.key} onChange={(e) => update(i, { key: e.target.value })} placeholder="budget" className="font-mono" />
                </Field>
                <Field label="Nomi" className="md:col-span-3">
                  <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Byudjet" />
                </Field>
                <Field label="Turi" className="md:col-span-3">
                  <Select value={r.type} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
                    {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => (
                      <option key={t} value={t}>
                        {FIELD_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="md:col-span-3 flex items-end justify-end h-full pt-5">
                  <Button variant="ghost" size="sm" icon={<X className="w-4 h-4 text-rose-600" />} onClick={() => remove(i)} />
                </div>
                <Field label="Tavsif (AI uchun koʻrsatma)" className="md:col-span-12">
                  <Input value={r.description || ''} onChange={(e) => update(i, { description: e.target.value })} placeholder="Mijoz aytgan byudjet, soʻmda; aytilmasa null" />
                </Field>
                {r.type === 'select' && (
                  <Field label="Variantlar (vergul bilan)" className="md:col-span-12">
                    <Input value={r.optionsText || ''} onChange={(e) => update(i, { optionsText: e.target.value })} placeholder="Yangi, Muzokara, Yopildi, Rad" />
                  </Field>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <ErrorBox error={error} />
        </div>
      </Card>
      <Card title="Natijada qaytadi">
        <p className="text-xs text-slate-600 mb-2">
          Javobdagi <code className="font-mono">customFields</code> obyekti (misol):
        </p>
        <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 text-[11px] font-mono overflow-x-auto thin-scroll">{rows.length ? example : '{}'}</pre>
        <p className="text-[11px] text-slate-500 mt-2">Audio ichida maʼlumot boʻlmasa qiymat <code className="font-mono">null</code> boʻladi. AI hech narsa oʻylab topmaydi.</p>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------

const ScriptTab: React.FC<{ c: CompanyDetail; onChange: () => Promise<void> | void }> = ({ c, onChange }) => {
  const [script, setScript] = useState(c.script || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setScript(c.script || ''), [c]);
  const dirty = script !== (c.script || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateCompany(c.id, { script });
      await onChange();
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card
        className="lg:col-span-2"
        title="Sotuv skripti"
        actions={
          <>
            {saved && !dirty && <span className="text-xs text-emerald-700 font-semibold">Saqlandi</span>}
            <Button size="sm" icon={<Save className="w-3.5 h-3.5" />} loading={saving} disabled={!dirty} onClick={save}>
              Saqlash
            </Button>
          </>
        }
      >
        <Textarea
          rows={22}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          className="font-mono !text-[12px] leading-relaxed"
          placeholder={`1. Salomlashish: "Assalomu alaykum, men [Ism], [Kompaniya] kompaniyasidanman..."\n2. Ehtiyojni aniqlash: kamida 3 ta savol (hozirgi yechim, muammo, muddat)\n3. Taklif: narxni faqat qiymat tushuntirilgandan keyin aytish\n4. E'tirozlar: "qimmat" -> bo'lib to'lash variantini taklif qilish\n5. Yakunlash: keyingi uchrashuv sanasini kelishib olish\n\nMajburiy iboralar: ...`}
        />
        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
          <span>{script.length.toLocaleString()} / 20 000 belgi</span>
          {dirty && <span className="text-amber-700 font-semibold">Saqlanmagan oʻzgarishlar</span>}
        </div>
        <div className="mt-3">
          <ErrorBox error={error} />
        </div>
      </Card>
      <Card title="Qanday ishlaydi">
        <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
          <li>Skript bosqichlar (salomlashish, savollar, taklif, eʼtirozlar, yakunlash) va majburiy iboralar koʻrinishida yoziladi. Qanchalik aniq boʻlsa, baho shunchalik toʻgʻri.</li>
          <li>Har tahlilda AI qoʻngʻiroqni shu skript bilan solishtiradi: har bosqich «bajarildi / qisman / oʻtkazib yuborildi», iqtibos va vaqt bilan, umumiy muvofiqlik bali 0–100.</li>
          <li>CRM soʻrovda oʻz <code className="font-mono">script</code> matnini yuborsa, shu qoʻngʻiroq uchun u ustun turadi. CRM <code className="font-mono">PUT /api/v1/script</code> orqali shu standart skriptni ham yangilay oladi.</li>
          <li>Skript boʻsh boʻlsa tahlil oddiy rejimda, muvofiqlik boʻlimisiz qilinadi.</li>
        </ul>
      </Card>
    </div>
  );
};

const AnalysesTab: React.FC<{ c: CompanyDetail; onChange: () => Promise<void> | void }> = ({ c, onChange }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [externalId, setExternalId] = useState('');
  const [callDate, setCallDate] = useState('');
  const [notes, setNotes] = useState('');
  const [useScript, setUseScript] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.companyAnalyses(c.id, 100).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  }, [c.id]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('audio', file, file.name);
      if (externalId) fd.append('externalId', externalId);
      if (callDate) fd.append('callDate', callDate);
      if (notes) fd.append('notes', notes);
      fd.append('useScript', useScript ? 'true' : 'false');
      const r = await api.adminAnalyze(c.id, fd);
      await onChange();
      navigate(`/analyses/${r.id}`);
    } catch (err: any) {
      setError(err.message);
      load();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-indigo-600" /> Admin paneldan tahlil qilish
          </span>
        }
      >
        <form onSubmit={run} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <Field label="Audio fayl *" className="md:col-span-4">
            <input
              type="file"
              accept="audio/*,video/mp4,video/webm,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.amr"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:text-xs file:font-semibold file:cursor-pointer"
            />
          </Field>
          <Field label="CRM ID" className="md:col-span-2">
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="lead-123" />
          </Field>
          <Field label="Qoʻngʻiroq sanasi" className="md:col-span-2">
            <Input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} />
          </Field>
          <Field label="Kontekst / izoh" className="md:col-span-4">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mahsulot, oldingi bosqich…" />
          </Field>
          <div className="md:col-span-8 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className={cx('inline-flex items-center gap-2', !c.hasScript && 'opacity-50')}>
              <input type="checkbox" checked={useScript && c.hasScript} disabled={!c.hasScript} onChange={(e) => setUseScript(e.target.checked)} />
              Sotuv skripti boʻyicha ham baholash{!c.hasScript && ' (skript kiritilmagan)'}
            </label>
            <span className="text-slate-400">Tahlil API orqali kelgandek hisoblanadi: {c.account.subscription ? (c.account.subscription.type === 'package' ? 'paketdan daqiqa yechiladi' : `${fmtMoney(c.account.subscription.pricePerMinute)} / daqiqa balansdan`) : 'tarif yoʻq — tahlil rad etiladi'}.</span>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button type="submit" disabled={!file || !c.account.canAnalyze} loading={running} icon={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} className="w-full md:w-auto">
              {running ? 'Tahlil qilinmoqda (30–90 s)…' : 'Tahlil qilish'}
            </Button>
          </div>
        </form>
        {error && (
          <div className="mt-3">
            <ErrorBox error={error} />
          </div>
        )}
      </Card>

      <Card title={`Tahlillar (${total})`} padded={false}>
        {!items ? <Spinner /> : items.length === 0 ? <Empty text="Bu kompaniya uchun hali tahlil yoʻq" /> : <AnalysisTable items={items} />}
      </Card>
    </div>
  );
};

export type { Account };
