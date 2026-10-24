import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Wallet, Package, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { CompanyDetail, CompanyListItem, LedgerEntry, PaymentTotals, Subscription } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Td, cx, fmtDate, fmtMoney } from '../components/ui';

const KIND_LABEL: Record<string, string> = { topup: 'Balans toʻldirish', package: 'Paket toʻlovi', adjustment: 'Tuzatish' };
const KIND_TONE: Record<string, 'green' | 'violet' | 'amber'> = { topup: 'green', package: 'violet', adjustment: 'amber' };
const METHODS = ['Naqd', 'Karta', 'Bank oʻtkazmasi', 'Payme', 'Click'];

const toInputDate = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [items, setItems] = useState<LedgerEntry[] | null>(null);
  const [totals, setTotals] = useState<PaymentTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);

  const companyId = params.get('companyId') || '';
  const kind = params.get('kind') || '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setItems(null);
    api
      .payments({ companyId, kind, from, to, limit: 300 })
      .then((r) => {
        setItems(r.items);
        setTotals(r.totals);
      })
      .catch((e) => setError(e.message));
  }, [companyId, kind, from, to]);

  useEffect(() => {
    api.companies().then(setCompanies).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (p: LedgerEntry) => {
    const warn =
      p.kind === 'package'
        ? 'Paket toʻlovini oʻchirasizmi? Obuna faol qoladi; kerak boʻlsa uni kompaniya sahifasida bekor qiling.'
        : `Toʻlovni oʻchirasizmi? Kompaniya balansi ${fmtMoney(p.amount)} ga kamayadi.`;
    if (!confirm(warn)) return;
    try {
      await api.deletePayment(p.id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Toʻlovlar"
        subtitle="Kompaniyalardan kelib tushgan toʻlovlar: balans toʻldirish va paket toʻlovlari"
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={load} />
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
              Toʻlov qoʻshish
            </Button>
          </>
        }
      />
      <ErrorBox error={error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Jami kelib tushdi" value={fmtMoney(totals?.paid)} hint={`${totals?.n ?? 0} ta toʻlov (filtr boʻyicha)`} tone="dark" icon={<Wallet className="w-4 h-4" />} />
        <Stat label="Paket toʻlovlari" value={fmtMoney(totals?.packages)} icon={<Package className="w-4 h-4" />} />
        <Stat label="Balans toʻldirishlar" value={fmtMoney(totals?.topups)} icon={<Wallet className="w-4 h-4" />} />
        <Stat label="Tuzatishlar" value={fmtMoney(totals?.adjustments)} hint="balansdan qoʻlda yechilgan" />
      </div>

      <Card padded={false}>
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end gap-2">
          <Field label="Kompaniya" className="min-w-[220px]">
            <Select value={companyId} onChange={(e) => setFilter('companyId', e.target.value)}>
              <option value="">Barchasi</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Turi">
            <Select value={kind} onChange={(e) => setFilter('kind', e.target.value)} className="!w-44">
              <option value="">Barchasi</option>
              <option value="topup">Balans toʻldirish</option>
              <option value="package">Paket toʻlovi</option>
              <option value="adjustment">Tuzatish</option>
            </Select>
          </Field>
          <Field label="Dan">
            <Input type="date" value={from} onChange={(e) => setFilter('from', e.target.value)} className="!w-40" />
          </Field>
          <Field label="Gacha">
            <Input type="date" value={to} onChange={(e) => setFilter('to', e.target.value)} className="!w-40" />
          </Field>
          <div className="flex gap-1 pb-0.5">
            <Button variant="ghost" size="sm" onClick={() => { setFilter('from', monthStart()); setFilter('to', ''); }}>
              Shu oy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Tozalash
            </Button>
          </div>
        </div>

        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty text="Toʻlovlar topilmadi">
            <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
              Toʻlov qoʻshish
            </Button>
          </Empty>
        ) : (
          <Table head={['Sana', 'Kompaniya', 'Turi', 'Summa', 'Usul', 'Izoh', '']}>
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(p.paidAt, false)}</Td>
                <Td>
                  <Link to={`/companies/${p.companyId}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                    {p.companyName}
                  </Link>
                  {p.subscriptionName && <div className="text-[11px] text-slate-500">{p.subscriptionName}</div>}
                </Td>
                <Td>
                  <Badge tone={KIND_TONE[p.kind] || 'amber'}>{KIND_LABEL[p.kind] || p.kind}</Badge>
                </Td>
                <Td className={cx('font-mono text-sm font-bold whitespace-nowrap', p.kind === 'adjustment' ? 'text-rose-700' : 'text-slate-900')}>
                  {p.kind === 'adjustment' ? fmtMoney(p.amount) : fmtMoney(p.paid)}
                </Td>
                <Td className="text-xs text-slate-600">{p.method || '—'}</Td>
                <Td className="text-xs text-slate-600 max-w-[260px] truncate" title={p.note}>
                  {p.note || '—'}
                </Td>
                <Td>
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(p)} title="Tahrirlash" />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />} onClick={() => remove(p)} title="Oʻchirish" />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <PaymentForm open={creating} onClose={() => setCreating(false)} companies={companies} defaultCompanyId={companyId} onSaved={load} />
      <EditPaymentForm payment={editing} onClose={() => setEditing(null)} onSaved={load} />
    </>
  );
}

// ---------------------------------------------------------------------------

const PaymentForm: React.FC<{ open: boolean; onClose: () => void; companies: CompanyListItem[]; defaultCompanyId: string; onSaved: () => void }> = ({
  open,
  onClose,
  companies,
  defaultCompanyId,
  onSaved,
}) => {
  const [companyId, setCompanyId] = useState('');
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [kind, setKind] = useState<'topup' | 'package'>('topup');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [paidAt, setPaidAt] = useState(toInputDate());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(defaultCompanyId);
    setKind('topup');
    setSubscriptionId('');
    setAmount('');
    setMethod('');
    setPaidAt(toInputDate());
    setNote('');
    setError(null);
  }, [open, defaultCompanyId]);

  useEffect(() => {
    if (!companyId) {
      setDetail(null);
      return;
    }
    api
      .company(companyId)
      .then((d) => {
        setDetail(d);
        // A company waiting for its package payment: preselect that package
        const pending = d.account.pendingSubscription;
        if (pending && pending.type === 'package') {
          setKind('package');
          setSubscriptionId(pending.id);
          setAmount(String(pending.price));
        } else if (pending && pending.type === 'per_minute') {
          setKind('topup');
        }
      })
      .catch(() => setDetail(null));
  }, [companyId]);

  const packageSubs = useMemo(() => (detail?.subscriptions || []).filter((s) => s.type === 'package' && ['pending', 'active', 'exhausted'].includes(s.status)), [detail]);
  const selectedSub: Subscription | undefined = packageSubs.find((s) => s.id === subscriptionId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createPayment({
        companyId,
        kind,
        amount: Number(amount),
        subscriptionId: kind === 'package' ? subscriptionId : undefined,
        method,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        note,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Yangi toʻlov">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Kompaniya *">
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required autoFocus>
            <option value="">Tanlang…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === 'pending' ? ' — toʻlov kutilmoqda' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Turi">
          <Select value={kind} onChange={(e) => setKind(e.target.value as 'topup' | 'package')}>
            <option value="topup">Balans toʻldirish (daqiqalik tarif)</option>
            <option value="package">Paket toʻlovi</option>
          </Select>
        </Field>
        {kind === 'package' && (
          <Field
            label="Paket (obuna) *"
            hint={
              selectedSub?.status === 'pending'
                ? 'Toʻlov kutayotgan paket: saqlangach paket boshlanadi va kompaniya ochiladi.'
                : packageSubs.length === 0
                  ? 'Bu kompaniyada paket obunasi yoʻq. Avval kompaniya sahifasida paketni biriktiring.'
                  : undefined
            }
          >
            <Select value={subscriptionId} onChange={(e) => { setSubscriptionId(e.target.value); const s = packageSubs.find((x) => x.id === e.target.value); if (s) setAmount(String(s.price)); }} required>
              <option value="">Tanlang…</option>
              {packageSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.planName} — {fmtMoney(s.price)} ({{ pending: 'toʻlov kutilmoqda', active: 'faol', exhausted: 'tugagan' }[s.status as 'pending' | 'active' | 'exhausted']})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Summa (soʻm) *">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="1000000" />
          </Field>
          <Field label="Sana">
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Toʻlov usuli">
          <Input list="pay-methods" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Naqd, karta, oʻtkazma…" />
          <datalist id="pay-methods">
            {METHODS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Izoh">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Toʻlov №, hujjat…" />
        </Field>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={saving} disabled={!companyId || !amount}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const EditPaymentForm: React.FC<{ payment: LedgerEntry | null; onClose: () => void; onSaved: () => void }> = ({ payment, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.kind === 'adjustment' ? payment.amount : payment.paid));
    setMethod(payment.method || '');
    setPaidAt(toInputDate(payment.paidAt));
    setNote(payment.note || '');
    setError(null);
  }, [payment]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    setSaving(true);
    setError(null);
    try {
      await api.updatePayment(payment.id, { amount: Number(amount), method, paidAt: paidAt ? new Date(paidAt).toISOString() : undefined, note });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!payment} onClose={onClose} title="Toʻlovni tahrirlash">
      {payment && (
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm">
            <span className="font-bold">{payment.companyName}</span> · <Badge tone={KIND_TONE[payment.kind] || 'amber'}>{KIND_LABEL[payment.kind] || payment.kind}</Badge>
            {payment.subscriptionName && <span className="text-slate-500"> · {payment.subscriptionName}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Summa (soʻm)" hint={payment.kind === 'package' ? 'Obunadagi paket narxi ham yangilanadi' : 'Balans shu summaga mos oʻzgaradi'}>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label="Sana">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Toʻlov usuli">
            <Input list="pay-methods-edit" value={method} onChange={(e) => setMethod(e.target.value)} />
            <datalist id="pay-methods-edit">
              {METHODS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Izoh">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={saving}>
              Saqlash
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
