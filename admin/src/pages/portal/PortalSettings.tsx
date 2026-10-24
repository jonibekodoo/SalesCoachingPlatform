import React, { useEffect, useState } from 'react';
import { KeyRound, Save, Braces } from 'lucide-react';
import { portal } from '../../api';
import type { ApiToken, Company, Language } from '../../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Table, Td, fmtDate } from '../../components/ui';

export default function PortalSettings({ company, onCompany }: { company: Company; onCompany: (c: Company) => void }) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [outputLanguage, setOutputLanguage] = useState(company.outputLanguage || '');
  const [savingLang, setSavingLang] = useState(false);
  const [langOk, setLangOk] = useState(false);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [cur, setCur] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    portal.me().then((m) => setLanguages(m.languages)).catch(() => {});
    portal.tokens().then(setTokens).catch(() => {});
  }, []);

  const saveLang = async () => {
    setSavingLang(true);
    setError(null);
    setLangOk(false);
    try {
      const r = await portal.saveSettings({ outputLanguage });
      onCompany(r.company);
      setLangOk(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingLang(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (pw1 !== pw2) {
      setPwError('Yangi parollar mos emas');
      return;
    }
    setSavingPw(true);
    try {
      await portal.changePassword(cur, pw1);
      setPwOk(true);
      setCur('');
      setPw1('');
      setPw2('');
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Natija tili, parol va API tokenlaringiz" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Natija tili">
          <p className="text-xs text-slate-600 mb-3">
            Qoʻngʻiroqlar tili: <strong>{company.language}</strong> ({company.countryName}). Tahlil matnlari (xulosa, topshiriqlar, kouching) quyidagi tilda yoziladi:
          </p>
          <Field label="Natija tili">
            <Select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)}>
              <option value="">Qoʻngʻiroq tili bilan bir xil ({company.language})</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-3 mt-3">
            <Button icon={<Save className="w-4 h-4" />} loading={savingLang} disabled={outputLanguage === (company.outputLanguage || '')} onClick={saveLang}>
              Saqlash
            </Button>
            {langOk && <span className="text-xs text-emerald-700 font-semibold">Saqlandi</span>}
          </div>
          <ErrorBox error={error} />
        </Card>

        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" /> Parolni oʻzgartirish
            </span>
          }
        >
          <form onSubmit={changePw} className="space-y-3">
            <Field label="Joriy parol">
              <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Yangi parol" hint="kamida 8 belgi">
                <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required minLength={8} autoComplete="new-password" />
              </Field>
              <Field label="Takrorlang">
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" />
              </Field>
            </div>
            <ErrorBox error={pwError} />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={savingPw}>
                Oʻzgartirish
              </Button>
              {pwOk && <span className="text-xs text-emerald-700 font-semibold">Parol yangilandi</span>}
            </div>
          </form>
        </Card>

        <Card
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-2">
              <Braces className="w-4 h-4 text-violet-600" /> API tokenlar
            </span>
          }
          padded={false}
        >
          {tokens.length === 0 ? (
            <Empty text="Token yaratilmagan. Tokenni administrator yaratib beradi." />
          ) : (
            <Table head={['Nomi', 'Prefiks', 'Yaratilgan', 'Oxirgi ishlatilgan', 'Holat']}>
              {tokens.map((t) => (
                <tr key={t.id} className={t.revokedAt ? 'opacity-50' : ''}>
                  <Td className="font-semibold">{t.name}</Td>
                  <Td mono>{t.prefix}…</Td>
                  <Td className="text-xs whitespace-nowrap">{fmtDate(t.createdAt)}</Td>
                  <Td className="text-xs whitespace-nowrap">{fmtDate(t.lastUsedAt)}</Td>
                  <Td>{t.revokedAt ? <Badge tone="red">Bekor qilingan</Badge> : <Badge tone="green">Faol</Badge>}</Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="px-5 py-3 text-[11px] text-slate-500 border-t border-slate-100">Tokenning toʻliq qiymati faqat yaratilganda koʻrsatiladi. Yoʻqolgan boʻlsa administratordan yangisini soʻrang.</p>
        </Card>
      </div>
    </>
  );
}
