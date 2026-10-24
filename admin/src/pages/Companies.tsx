import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Globe } from 'lucide-react';
import { api } from '../api';
import type { Company, CompanyListItem, Country, Plan } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate, fmtMinutes, fmtMoney, fmtNum } from '../components/ui';

export default function Companies() {
  const [items, setItems] = useState<CompanyListItem[] | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = () => api.companies().then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.meta().then((m) => setCountries(m.countries)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (items || []).filter((c) => !s || c.name.toLowerCase().includes(s) || c.contactName.toLowerCase().includes(s) || c.phone.includes(s));
  }, [items, search]);

  return (
    <>
      <PageHeader
        title="Kompaniyalar"
        subtitle="CRM integratsiyasi uchun mijoz kompaniyalar, ularning tokenlari, tariflari va hisobotlari"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
            Kompaniya qoʻshish
          </Button>
        }
      />
      <ErrorBox error={error} />

      <Card padded={false}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nomi, kontakt yoki telefon boʻyicha qidirish" className="flex-1 text-sm focus:outline-none bg-transparent" />
          <span className="text-xs text-slate-400">{filtered.length} ta</span>
        </div>
        {!items ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <Empty text={items.length === 0 ? 'Hali kompaniya qoʻshilmagan' : 'Hech narsa topilmadi'}>
            {items.length === 0 && (
              <Button variant="secondary" onClick={() => setCreating(true)} icon={<Plus className="w-4 h-4" />}>
                Birinchi kompaniyani qoʻshish
              </Button>
            )}
          </Empty>
        ) : (
          <Table head={['Kompaniya', 'Davlat / til', 'Tarif', 'Qoldiq', 'Shu oy', 'Jami', 'Holat']}>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                <Td>
                  <Link to={`/companies/${c.id}`} className="font-bold text-slate-900 hover:text-indigo-700" onClick={(e) => e.stopPropagation()}>
                    {c.name}
                  </Link>
                  <div className="text-[11px] text-slate-500">
                    {c.contactName || '—'} {c.phone && `· ${c.phone}`} · {c.tokens} token
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    {c.countryName}
                  </div>
                  <div className="text-[11px] text-slate-500">{c.language}</div>
                </Td>
                <Td>
                  {c.account.subscription ? (
                    <>
                      <div className="text-xs font-semibold">{c.account.subscription.planName}</div>
                      <Badge tone={c.account.subscription.type === 'package' ? 'violet' : 'sky'}>{c.account.subscription.type === 'package' ? 'Paket' : 'Daqiqalik'}</Badge>
                    </>
                  ) : c.account.pendingSubscription ? (
                    <>
                      <div className="text-xs font-semibold">{c.account.pendingSubscription.planName}</div>
                      <Badge tone="amber">Toʻlov kutilmoqda</Badge>
                    </>
                  ) : (
                    <Badge tone="amber">Tarif yoʻq</Badge>
                  )}
                </Td>
                <Td>
                  <div className={`text-xs font-bold ${c.account.canAnalyze ? 'text-slate-900' : 'text-rose-700'}`}>{fmtMinutes(c.account.remainingMinutes)}</div>
                  {c.account.subscription?.type === 'per_minute' && <div className="text-[11px] text-slate-500">{fmtMoney(c.account.balance)}</div>}
                </Td>
                <Td className="text-xs">
                  {c.account.thisMonth.calls} tahlil · {c.account.thisMonth.minutes} daq
                </Td>
                <Td className="text-xs">
                  <div>{c.totals.calls} tahlil · {fmtMoney(c.totals.cost)}</div>
                  <div className="text-[11px] text-slate-500">Oxirgi: {fmtDate(c.totals.lastAnalysisAt)}</div>
                </Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <CompanyForm open={creating} onClose={() => setCreating(false)} countries={countries} onSaved={(id) => navigate(`/companies/${id}`)} />
    </>
  );
}

export const CompanyForm: React.FC<{
  open: boolean;
  onClose: () => void;
  countries: Country[];
  initial?: Partial<Company>;
  onSaved: (id: string) => void;
}> = ({ open, onClose, countries, initial, onSaved }) => {
  const [form, setForm] = useState({ name: '', country: 'UZ', contactName: '', email: '', phone: '', notes: '', status: 'active' as Company['status'], planId: '' });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || '',
        country: initial?.country || 'UZ',
        contactName: initial?.contactName || '',
        email: initial?.email || '',
        phone: initial?.phone || '',
        notes: initial?.notes || '',
        status: initial?.status || 'active',
        planId: '',
      });
      setError(null);
      if (!initial?.id) api.plans().then((p) => setPlans(p.filter((x) => x.isActive))).catch(() => {});
    }
  }, [open, initial]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const country = countries.find((c) => c.code === form.country);
  const plan = plans.find((p) => p.id === form.planId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initial?.id && !form.planId) {
      setError('Tarif (paket) tanlang');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = initial?.id ? await api.updateCompany(initial.id, form) : await api.createCompany(form);
      onSaved(saved.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Kompaniyani tahrirlash' : 'Yangi kompaniya'}>
      <form onSubmit={submit} className="space-y-3" id="company-form">
        <Field label="Nomi *">
          <Input value={form.name} onChange={set('name')} required autoFocus placeholder="Masalan: Ahlan House MChJ" />
        </Field>
        <Field label="Davlat (audio va natija tili)" hint={country ? `Qoʻngʻiroqlar va tahlil natijasi: ${country.language}` : undefined}>
          <Select value={form.country} onChange={set('country')}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} — {c.language}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kontakt shaxs">
            <Input value={form.contactName} onChange={set('contactName')} />
          </Field>
          <Field label="Telefon">
            <Input value={form.phone} onChange={set('phone')} placeholder="+998" />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        {!initial?.id && (
          <Field
            label="Tarif / paket *"
            hint={
              plan
                ? plan.type === 'package'
                  ? `${fmtNum(plan.includedMinutes)} daqiqa — ${fmtMoney(plan.price)}${plan.validityDays ? `, ${plan.validityDays} kun` : ''}. Toʻlov tasdiqlangach ochiladi.`
                  : `${fmtMoney(plan.pricePerMinute)} / daqiqa. Boshlangʻich toʻlov tasdiqlangach ochiladi.`
                : 'Kompaniya toʻlov tasdiqlangunga qadar «Toʻlov kutilmoqda» holatida boʻladi, API ishlamaydi.'
            }
          >
            <Select value={form.planId} onChange={set('planId')} required>
              <option value="">Tanlang…</option>
              <optgroup label="Paketlar">
                {plans.filter((p) => p.type === 'package').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtNum(p.includedMinutes)} daq, {fmtMoney(p.price)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Daqiqalik">
                {plans.filter((p) => p.type === 'per_minute').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtMoney(p.pricePerMinute)}/daq
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        )}
        {initial?.id && (
          <Field label="Holat">
            <Select value={form.status} onChange={set('status')}>
              {initial.status === 'pending' && <option value="pending">Toʻlov kutilmoqda</option>}
              <option value="active">Faol</option>
              <option value="suspended">Toʻxtatilgan (API soʻrovlari rad etiladi)</option>
            </Select>
          </Field>
        )}
        <Field label="Izoh">
          <Textarea rows={2} value={form.notes} onChange={set('notes')} />
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
    </Modal>
  );
};
