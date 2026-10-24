import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Package } from 'lucide-react';
import { api } from '../api';
import type { Plan, PlanType } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, fmtMoney, fmtNum } from '../components/ui';

const EMPTY = { name: '', type: 'per_minute' as PlanType, pricePerMinute: 500, includedMinutes: 6000, price: 2000000, validityDays: 365 as number | null, description: '', isActive: true };

export default function Plans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null | 'new'>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => api.plans().then(setPlans).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setFormError(null);
    setEditing('new');
  };
  const openEdit = (p: Plan) => {
    setForm({ name: p.name, type: p.type, pricePerMinute: p.pricePerMinute, includedMinutes: p.includedMinutes, price: p.price, validityDays: p.validityDays, description: p.description, isActive: p.isActive });
    setFormError(null);
    setEditing(p);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') await api.createPlan(form);
      else if (editing) await api.updatePlan(editing.id, form);
      setEditing(null);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Plan) => {
    if (!confirm(`"${p.name}" tarifini oʻchirasizmi?`)) return;
    try {
      await api.deletePlan(p.id);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const perMinute = (plans || []).filter((p) => p.type === 'per_minute');
  const packages = (plans || []).filter((p) => p.type === 'package');

  return (
    <>
      <PageHeader
        title="Tariflar"
        subtitle="Kompaniya ikki turdagi tarifdan birini tanlaydi: daqiqasiga toʻlov (oldindan toʻldirilgan balansdan) yoki soatlik paket"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>
            Tarif qoʻshish
          </Button>
        }
      />
      <ErrorBox error={error} />
      {!plans ? (
        <Spinner />
      ) : plans.length === 0 ? (
        <Card>
          <Empty text="Hali tarif yoʻq. Masalan: «1 daqiqa — 500 soʻm» yoki «100 soat — 2 000 000 soʻm».">
            <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Birinchi tarifni yaratish
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlanGroup title="Daqiqalik tariflar" icon={<Clock className="w-4 h-4 text-sky-600" />} plans={perMinute} onEdit={openEdit} onDelete={remove} />
          <PlanGroup title="Paketlar" icon={<Package className="w-4 h-4 text-violet-600" />} plans={packages} onEdit={openEdit} onDelete={remove} />
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Yangi tarif' : 'Tarifni tahrirlash'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nomi *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus placeholder={form.type === 'package' ? '100 soat' : 'Standart daqiqalik'} />
          </Field>
          <Field label="Turi">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PlanType })}>
              <option value="per_minute">Daqiqasiga toʻlov (balansdan yechiladi)</option>
              <option value="package">Paket (oldindan sotib olingan daqiqalar)</option>
            </Select>
          </Field>
          {form.type === 'per_minute' ? (
            <Field label="1 daqiqa narxi (soʻm)" hint="Har boshlangan daqiqa toʻliq daqiqa sifatida hisoblanadi">
              <Input type="number" min={1} value={form.pricePerMinute} onChange={(e) => setForm({ ...form, pricePerMinute: Number(e.target.value) })} required />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Daqiqalar" hint={`= ${Math.round((form.includedMinutes / 60) * 10) / 10} soat`}>
                  <Input type="number" min={1} value={form.includedMinutes} onChange={(e) => setForm({ ...form, includedMinutes: Number(e.target.value) })} required />
                </Field>
                <Field label="Paket narxi (soʻm)" hint={form.includedMinutes > 0 ? `≈ ${fmtMoney(form.price / form.includedMinutes)} / daqiqa` : undefined}>
                  <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
                </Field>
              </div>
              <Field label="Amal qilish muddati (kun)" hint="Boʻsh qoldirilsa muddatsiz">
                <Input type="number" min={1} value={form.validityDays ?? ''} onChange={(e) => setForm({ ...form, validityDays: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </>
          )}
          <Field label="Tavsif">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Faol (kompaniyalarga biriktirish mumkin)
          </label>
          <ErrorBox error={formError} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={saving}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

const PlanGroup: React.FC<{ title: string; icon: React.ReactNode; plans: Plan[]; onEdit: (p: Plan) => void; onDelete: (p: Plan) => void }> = ({ title, icon, plans, onEdit, onDelete }) => (
  <Card
    title={
      <span className="inline-flex items-center gap-2">
        {icon}
        {title}
      </span>
    }
    padded={false}
  >
    {plans.length === 0 ? (
      <Empty text="Bu turda tarif yoʻq" />
    ) : (
      <div className="divide-y divide-slate-100">
        {plans.map((p) => (
          <div key={p.id} className={`px-5 py-4 flex items-start justify-between gap-3 ${p.isActive ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-bold text-slate-900">{p.name}</div>
                {!p.isActive && <Badge tone="slate">Nofaol</Badge>}
                {p.subscribers > 0 && <Badge tone="green">{p.subscribers} ta kompaniya</Badge>}
              </div>
              <div className="text-sm text-slate-700 mt-0.5">
                {p.type === 'per_minute' ? (
                  <>
                    <strong>{fmtMoney(p.pricePerMinute)}</strong> / daqiqa
                  </>
                ) : (
                  <>
                    <strong>{fmtNum(p.includedMinutes)} daqiqa</strong> ({Math.round((p.includedMinutes / 60) * 10) / 10} soat) — <strong>{fmtMoney(p.price)}</strong>
                    {p.validityDays && <span className="text-slate-500"> · {p.validityDays} kun</span>}
                  </>
                )}
              </div>
              {p.description && <div className="text-xs text-slate-500 mt-1">{p.description}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => onEdit(p)} />
              <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />} onClick={() => onDelete(p)} />
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
