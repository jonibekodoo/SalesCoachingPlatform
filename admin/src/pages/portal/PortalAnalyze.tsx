import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2 } from 'lucide-react';
import { portal } from '../../api';
import type { Company, Language } from '../../types';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Textarea, cx } from '../../components/ui';

export default function PortalAnalyze({ company }: { company: Company }) {
  const navigate = useNavigate();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [canAnalyze, setCanAnalyze] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [externalId, setExternalId] = useState('');
  const [callDate, setCallDate] = useState('');
  const [notes, setNotes] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('');
  const [useScript, setUseScript] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portal
      .me()
      .then((m) => {
        setLanguages(m.languages);
        setCanAnalyze(m.account.canAnalyze);
      })
      .catch(() => {});
  }, []);

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
      if (outputLanguage) fd.append('outputLanguage', outputLanguage);
      fd.append('useScript', useScript ? 'true' : 'false');
      const r = await portal.analyze(fd);
      navigate(`/portal/analyses/${r.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader title="Audio yuklash va tahlil qilish" subtitle="Qoʻngʻiroq yozuvini yuklang: 30–90 soniyada toʻliq tahlil, topshiriqlar va baho tayyor boʻladi" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <form onSubmit={run} className="space-y-4">
            <Field label="Audio fayl *" hint="mp3, wav, m4a, ogg, aac, flac, webm, amr · 60 MB gacha">
              <label
                className={cx(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 cursor-pointer transition',
                  file ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
                )}
              >
                <UploadCloud className="w-8 h-8 text-indigo-500" />
                <div className="text-sm font-semibold text-slate-800">{file ? file.name : 'Faylni tanlang yoki shu yerga tashlang'}</div>
                {file && <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</div>}
                <input type="file" accept="audio/*,video/mp4,video/webm,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.amr" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="CRM ID / mijoz" hint="ixtiyoriy">
                <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="lead-123" />
              </Field>
              <Field label="Qoʻngʻiroq sanasi">
                <Input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} />
              </Field>
              <Field label="Natija tili">
                <Select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)}>
                  <option value="">Standart ({company.outputLanguageName || company.language})</option>
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Kontekst" hint="Mahsulot, mijoz, oldingi bosqich — AI aniqroq ishlaydi">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <label className={cx('inline-flex items-center gap-2 text-sm text-slate-700', !company.hasScript && 'opacity-50')}>
              <input type="checkbox" checked={useScript && company.hasScript} disabled={!company.hasScript} onChange={(e) => setUseScript(e.target.checked)} />
              Sotuv skripti boʻyicha ham baholash{!company.hasScript && ' (skript kiritilmagan)'}
            </label>
            <ErrorBox error={error} />
            <Button type="submit" disabled={!file || !canAnalyze} loading={running} icon={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} className="w-full md:w-auto">
              {running ? 'Tahlil qilinmoqda, kuting…' : 'Tahlil qilish'}
            </Button>
            {!canAnalyze && <p className="text-xs text-rose-700 font-semibold">Hisobingizda tahlil uchun limit yoʻq. Administrator bilan bogʻlaning.</p>}
          </form>
        </Card>
        <Card title="Nima olasiz">
          <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
            <li>Soʻzlovchilarga ajratilgan transkript va qiziqish dinamikasi</li>
            <li>Umumiy ball (0–100) va baho, qoʻngʻiroq natijasi</li>
            <li>3 ta kuchli tomon va 3 ta boy berilgan imkoniyat — iqtibos va vaqt bilan</li>
            <li>Menejer uchun aniq topshiriqlar (muddat, muhimlik, bajarilish mezoni)</li>
            <li>CRM fieldlaringiz qiymatlari va (skript boʻlsa) skriptga muvofiqlik</li>
            <li>HTML hisobot va JSON yuklab olish</li>
          </ul>
          <p className="text-[11px] text-slate-500 mt-3">Har boshlangan daqiqa toʻliq daqiqa sifatida hisoblanadi. Xato boʻlsa hech narsa yechilmaydi.</p>
        </Card>
      </div>
    </>
  );
}
