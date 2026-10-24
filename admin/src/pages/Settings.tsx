import React, { useEffect, useState } from 'react';
import { KeyRound, Save, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { api } from '../api';
import type { Settings } from '../types';
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Spinner } from '../components/ui';

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [analyzeModel, setAnalyzeModel] = useState('');
  const [fallbackModels, setFallbackModels] = useState('');
  const [maxMinutes, setMaxMinutes] = useState(120);
  const [inPrice, setInPrice] = useState(0.75);
  const [outPrice, setOutPrice] = useState(3.75);
  const [usdRate, setUsdRate] = useState(12800);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; model?: string; reply?: string; ms?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const apply = (v: Settings) => {
    setS(v);
    setAnalyzeModel(v.analyzeModel);
    setFallbackModels(v.fallbackModels);
    setMaxMinutes(v.maxAudioMinutes);
    setInPrice(v.geminiInputPrice);
    setOutPrice(v.geminiOutputPrice);
    setUsdRate(v.usdRate);
    setKey('');
  };
  useEffect(() => {
    api.settings().then(apply).catch((e) => setError(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = { analyzeModel, fallbackModels, maxAudioMinutes: maxMinutes, geminiInputPrice: inPrice, geminiOutputPrice: outPrice, usdRate };
      if (key.trim()) body.geminiApiKey = key.trim();
      apply(await api.saveSettings(body));
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!confirm('Saqlangan Gemini kalitini oʻchirasizmi?')) return;
    apply(await api.saveSettings({ geminiApiKey: '' }));
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api.testGemini());
    } catch (err: any) {
      setTest({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (!s) return <Spinner />;

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Gemini API kaliti va tahlil modellari" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={save} className="lg:col-span-2 space-y-6">
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" /> Gemini API kaliti
              </span>
            }
          >
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="text-slate-600">Joriy kalit:</span>
              {s.geminiApiKeyMasked ? (
                <>
                  <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{s.geminiApiKeyMasked}</code>
                  <Badge tone={s.geminiKeySource === 'settings' ? 'green' : 'sky'}>{s.geminiKeySource === 'settings' ? 'Admin paneldan' : '.env faylidan'}</Badge>
                  {s.geminiKeySource === 'settings' && (
                    <button type="button" onClick={clearKey} className="text-xs text-rose-700 hover:underline cursor-pointer">
                      oʻchirish
                    </button>
                  )}
                </>
              ) : (
                <Badge tone="red">Kiritilmagan</Badge>
              )}
            </div>
            <Field label="Yangi kalit" hint="Google AI Studio'dan olingan kalit. Boʻsh qoldirilsa joriy kalit saqlanib qoladi.">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza… yoki AQ.…" className="font-mono" autoComplete="off" />
            </Field>
          </Card>

          <Card title="Modellar va limitlar">
            <div className="space-y-3">
              <Field label="Asosiy model">
                <Input value={analyzeModel} onChange={(e) => setAnalyzeModel(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Zaxira modellar (vergul bilan)" hint="Asosiy model band (503) yoki limitga yetganda (429) navbat bilan sinab koʻriladi">
                <Input value={fallbackModels} onChange={(e) => setFallbackModels(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Maksimal audio uzunligi (daqiqa)" hint="Undan uzun audiolar 422 xatosi bilan rad etiladi">
                <Input type="number" min={1} max={600} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} className="!w-40" />
              </Field>
            </div>
          </Card>

          <Card title="Gemini narxlari (tannarxni hisoblash uchun)">
            <p className="text-xs text-slate-600 mb-3">
              Har tahlildan keyin Gemini qaytargan token soni shu narxlar bilan koʻpaytirilib, tahlil tannarxi saqlanadi. Narxlar{' '}
              <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                ai.google.dev/gemini-api/docs/pricing
              </a>{' '}
              sahifasidan (Paid tier, 1M token uchun USD).
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Input, $ / 1M token" hint="Audio + prompt">
                <Input type="number" step="0.01" min={0} value={inPrice} onChange={(e) => setInPrice(Number(e.target.value))} />
              </Field>
              <Field label="Output, $ / 1M token" hint="Javob + thinking">
                <Input type="number" step="0.01" min={0} value={outPrice} onChange={(e) => setOutPrice(Number(e.target.value))} />
              </Field>
              <Field label="1 USD kursi (soʻm)" hint="Soʻmda koʻrsatish uchun">
                <Input type="number" step="1" min={0} value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value))} />
              </Field>
            </div>
          </Card>

          <ErrorBox error={error} />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>
              Saqlash
            </Button>
            {saved && (
              <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saqlandi
              </span>
            )}
          </div>
        </form>

        <Card title="Ulanishni tekshirish">
          <p className="text-xs text-slate-600 mb-3">Saqlangan kalit bilan Gemini'ga qisqa soʻrov yuboriladi (bepulga yaqin).</p>
          <Button variant="secondary" loading={testing} icon={<Zap className="w-4 h-4" />} onClick={runTest}>
            Kalitni tekshirish
          </Button>
          {test && (
            <div className={`mt-4 rounded-xl border p-3 text-xs ${test.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                {test.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {test.ok ? 'Ishlayapti' : 'Xato'}
              </div>
              {test.ok ? (
                <div>
                  Model: <code className="font-mono">{test.model}</code> · javob: «{test.reply}» · {test.ms} ms
                </div>
              ) : (
                <div>{test.error}</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
