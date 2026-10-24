import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { portal } from '../../api';
import { Button, Card, ErrorBox, PageHeader, Spinner, Textarea } from '../../components/ui';

export default function PortalScript() {
  const [script, setScript] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portal
      .script()
      .then((r) => {
        setScript(r.script);
        setSaved(r.script);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (script === null) return error ? <ErrorBox error={error} /> : <Spinner />;
  const dirty = script !== saved;

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      await portal.saveScript(script);
      setSaved(script);
      setOk(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Sotuv skripti"
        subtitle="Menejerlaringiz amal qilishi kerak boʻlgan skript. AI har qoʻngʻiroqni shu skript bilan solishtiradi."
        actions={
          <>
            {ok && !dirty && <span className="text-xs text-emerald-700 font-semibold">Saqlandi</span>}
            <Button icon={<Save className="w-4 h-4" />} loading={saving} disabled={!dirty} onClick={save}>
              Saqlash
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <Textarea
            rows={22}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="font-mono !text-[12px] leading-relaxed"
            placeholder={`1. Salomlashish: "Assalomu alaykum, men [Ism], [Kompaniya] kompaniyasidanman..."\n2. Ehtiyojni aniqlash: kamida 3 ta savol\n3. Taklif: narxni faqat qiymatdan keyin aytish\n4. E'tirozlar: ...\n5. Yakunlash: keyingi qadam va sana\n\nMajburiy iboralar: ...`}
          />
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>{script.length.toLocaleString()} / 20 000 belgi</span>
            {dirty && <span className="text-amber-700 font-semibold">Saqlanmagan oʻzgarishlar</span>}
          </div>
          <div className="mt-3">
            <ErrorBox error={error} />
          </div>
        </Card>
        <Card title="Maslahatlar">
          <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
            <li>Bosqichlarni tartib bilan raqamlang: salomlashish, ehtiyojni aniqlash, taklif, eʼtirozlar, yakunlash.</li>
            <li>Majburiy iboralar va taqiqlangan harakatlarni alohida yozing («narxni afzalliklardan oldin aytmaslik»).</li>
            <li>Har tahlilda bosqichlar «bajarildi / qisman / oʻtkazib yuborildi» deb belgilanadi, umumiy muvofiqlik foizi chiqadi.</li>
            <li>Boʻsh qoldirsangiz tahlil skriptsiz, oddiy rejimda boʻladi.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
