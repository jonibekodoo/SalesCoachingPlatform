import React, { useEffect, useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { api, portal as portalApi } from '../api';
import type { Country, Language } from '../types';
import { Badge, Button, Card, PageHeader, Table, Td } from '../components/ui';

const Code: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-[11.5px] font-mono overflow-x-auto thin-scroll leading-relaxed whitespace-pre">{children}</pre>
);

const Row = ({ cells, mono = [0] }: { cells: React.ReactNode[]; mono?: number[] }) => (
  <tr>
    {cells.map((c, i) => (
      <Td key={i} mono={mono.includes(i)} className={mono.includes(i) ? 'whitespace-nowrap' : 'text-xs'}>
        {c}
      </Td>
    ))}
  </tr>
);

const SECTIONS = [
  ['overview', '1. Umumiy'],
  ['auth', '2. Autentifikatsiya'],
  ['analyze', '3. Tahlil — POST /analyze'],
  ['fields', '4. Custom fieldlar'],
  ['script', '5. Sotuv skripti'],
  ['lang', '6. Tillar'],
  ['response', '7. Javob tuzilmasi'],
  ['other', '8. Boshqa endpointlar'],
  ['errors', '9. Xato kodlari va limitlar'],
  ['billing', '10. Hisob-kitob'],
  ['examples', '11. Kod misollari'],
  ['tips', '12. Integratsiya maslahatlari'],
];

export default function Docs({ portal: isPortal = false }: { portal?: boolean }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (isPortal) {
      // the portal has no admin meta endpoint; the language list comes from /me
      portalApi
        .me()
        .then((m) => setLanguages(m.languages))
        .catch(() => {});
      return;
    }
    api
      .meta()
      .then((m) => {
        setCountries(m.countries);
        setLanguages(m.languages || []);
      })
      .catch(() => {});
  }, [isPortal]);
  const base = `${window.location.origin}/api/v1`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/docs/API.md`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <PageHeader
        title="API hujjatlari"
        subtitle="CRM va boshqa tizimlar uchun integratsiya qoʻllanmasi. Markdown nusxasi repo'da: docs/API.md"
        actions={
          <>
            <Button variant="secondary" icon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} onClick={copyLink}>
              {copied ? 'Nusxalandi' : 'Hujjat havolasi'}
            </Button>
            <a href="/docs/API.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
              <ExternalLink className="w-4 h-4" /> API.md
            </a>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
            {label}
          </a>
        ))}
      </div>

      <div className="space-y-6 max-w-4xl">
        <Card title={<span id="overview">1. Umumiy maʼlumot</span>}>
          <p className="text-sm text-slate-700">
            Sales Coaching Platform savdo qoʻngʻiroqlari audiosini qabul qiladi va JSON koʻrinishida toʻliq tahlil qaytaradi: soʻzlovchilarga ajratilgan transkript, qiziqish dinamikasi, umumiy ball va baho, kouching
            kartasi (3 kuchli tomon, 3 boy berilgan imkoniyat), menejer uchun SMART topshiriqlar, CRM'ning oʻz fieldlari qiymatlari va (skript berilgan boʻlsa) sotuv skriptiga muvofiqlik.
          </p>
          <Table head={['Parametr', 'Qiymat']}>
            <Row cells={['Asosiy manzil', <code className="font-mono">{base}</code>]} mono={[]} />
            <Row cells={['Protokol', 'HTTPS, JSON (UTF-8). Fayllar multipart/form-data yoki base64']} mono={[]} />
            <Row cells={['Tahlil vaqti', 'Sinxron; odatda 30–90 soniya (audio uzunligiga bogʻliq). HTTP timeout kamida 300 s qoʻying']} mono={[]} />
            <Row cells={['Audio formatlar', 'mp3, wav, m4a, aac, ogg, opus, flac, webm, amr, mp4 (audio). 60 MB gacha, standart maks. 120 daqiqa']} mono={[]} />
            <Row cells={['Hisob-kitob', 'Har boshlangan daqiqa toʻliq daqiqa. Xato tahlil uchun yechilmaydi']} mono={[]} />
          </Table>
        </Card>

        <Card title={<span id="auth">2. Autentifikatsiya</span>}>
          <p className="text-sm text-slate-700 mb-3">
            Har kompaniyaga admin panelda API token beriladi (<code className="font-mono">sci_…</code>, 52 belgi). Token faqat yaratilganda bir marta koʻrsatiladi; yoʻqolsa yangisi yaratiladi, eskisi bekor qilinadi. Tokenni
            server tomonda saqlang, brauzer/mobil ilovaga bermang.
          </p>
          <Code>{`Authorization: Bearer sci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# yoki
X-API-Key: sci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="text-xs text-slate-600 mt-2">
            Tekshirish: <code className="font-mono">GET {base}/account</code> — 200 qaytsa token toʻgʻri, 401 boʻlsa notoʻgʻri/bekor qilingan.
          </p>
        </Card>

        <Card title={<span id="analyze">3. Tahlil — POST /analyze</span>}>
          <p className="text-sm text-slate-700 mb-3">Audio yuboriladi, javobda (201) toʻliq tahlil qaytadi. Ikki format qoʻllanadi.</p>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">A) multipart/form-data (tavsiya etiladi)</div>
          <Code>{`curl -X POST ${base}/analyze \\
  -H "Authorization: Bearer sci_..." \\
  -F "audio=@call_2026-10-17.mp3" \\
  -F "externalId=lead-10542" \\
  -F "callDate=2026-10-17" \\
  -F "notes=Ikkinchi qo'ng'iroq, KP yuborilgan" \\
  -F "outputLanguage=ru" \\
  -F 'customFields=[
        {"key":"budget","label":"Byudjet","type":"number","description":"Mijoz aytgan byudjet, so'mda"},
        {"key":"next_call","label":"Keyingi qo'ng'iroq","type":"date"},
        {"key":"stage","label":"Bosqich","type":"select","options":["Yangi","Muzokara","Yopildi","Rad"]}
      ]'`}</Code>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 mt-4">B) application/json (base64)</div>
          <Code>{`POST ${base}/analyze
Content-Type: application/json

{
  "audioBase64": "<base64>",            // data:audio/...;base64, prefiksi bo'lsa ham bo'ladi
  "mimeType": "audio/mpeg",
  "fileName": "call.mp3",
  "externalId": "lead-10542",
  "callDate": "2026-10-17",
  "notes": "Ikkinchi qo'ng'iroq",
  "outputLanguage": "ru",
  "script": "1. Salomlashish ...",       // ixtiyoriy, shu qo'ng'iroq uchun
  "customFields": [ { "key": "budget", "type": "number", "label": "Byudjet" } ]
}`}</Code>
          <Table head={['Parametr', 'Majburiy', 'Tavsif']}>
            <Row cells={['audio / audioBase64', 'ha', 'Audio fayl (multipart "audio" maydoni) yoki base64 satr. 60 MB gacha.']} />
            <Row cells={['mimeType', 'yoʻq', 'JSON variantida MIME turi; berilmasa fayl kengaytmasidan aniqlanadi.']} />
            <Row cells={['fileName', 'yoʻq', 'Fayl nomi (hisobotlarda koʻrinadi).']} />
            <Row cells={['externalId', 'yoʻq', 'CRM dagi lead/deal/call ID (200 belgigacha). Keyin GET /analyses?externalId= bilan topiladi.']} />
            <Row cells={['callDate', 'yoʻq', 'Qoʻngʻiroq sanasi YYYY-MM-DD. "Keyingi haftada" kabi nisbiy sanalarni date fieldlarda hisoblash uchun.']} />
            <Row cells={['notes', 'yoʻq', 'CRM dan kontekst: mahsulot, oldingi bosqich, mijoz haqida qisqa maʼlumot. AI aniqroq ishlaydi.']} />
            <Row cells={['customFields', 'yoʻq', 'CRM fieldlari taʼrifi (JSON massiv, 40 tagacha). Kompaniyaning admin paneldagi standart fieldlariga qoʻshiladi; bir xil key boʻlsa soʻrovdagisi ustun. 4-boʻlim.']} />
            <Row cells={['script', 'yoʻq', 'Shu qoʻngʻiroq uchun sotuv skripti (20 000 belgigacha). Berilmasa kompaniya skripti; boʻsh satr "" yuborilsa skriptsiz tahlil. 5-boʻlim.']} />
            <Row cells={['outputLanguage', 'yoʻq', 'Natija matnlari tili (kod, masalan "ru", "en", "uz-Cyrl"). Berilmasa kompaniya sozlamasi, u ham boʻlmasa davlat tili. 6-boʻlim.']} />
          </Table>
        </Card>

        <Card title={<span id="fields">4. Custom fieldlar</span>}>
          <p className="text-sm text-slate-700 mb-3">
            CRM oʻz kartochkasidagi maydonlarni taʼriflab yuboradi, AI ularni audiodan toʻldiradi va javobdagi <code className="font-mono">customFields</code> obyektida qaytaradi. Har taʼrif:{' '}
            <code className="font-mono">{`{ key, label?, type?, description?, options? }`}</code>. <code className="font-mono">key</code> harf bilan boshlanadi, faqat harf/raqam/_ (64 belgigacha).
          </p>
          <Table head={['type', 'Qaytadi', 'Misol', 'Izoh']}>
            <Row cells={['text', 'string', '"Toshkent, Chilonzor"', 'Qisqa aniq matn, natija tilida']} mono={[0, 2]} />
            <Row cells={['number', 'number', '1500000', 'Birliksiz, ming ajratgichsiz']} mono={[0, 2]} />
            <Row cells={['boolean', 'true / false', 'true', 'Ha/yoʻq savollar']} mono={[0, 2]} />
            <Row cells={['date', '"YYYY-MM-DD"', '"2026-10-24"', 'callDate berilsa nisbiy sanalar hisoblanadi']} mono={[0, 2]} />
            <Row cells={['select', 'options dan bittasi', '"Muzokara"', 'options kamida 2 ta, qiymat aynan nusxalanadi']} mono={[0, 2]} />
            <Row cells={['list', 'string[]', '["Narx", "Muddat"]', 'Bir nechta qisqa element']} mono={[0, 2]} />
          </Table>
          <p className="text-xs text-slate-600 mt-3">
            Audioda maʼlumot boʻlmasa qiymat <code className="font-mono">null</code> — AI hech narsa oʻylab topmaydi. <code className="font-mono">description</code> AI ga nimani qidirishni aytadi: qanchalik aniq boʻlsa, natija shunchalik
            yaxshi («Mijoz aytgan oylik byudjet, soʻmda; aytilmasa null»). Taʼriflarni pul sarflamasdan tekshirish: <code className="font-mono">POST /custom-fields/validate</code>.
          </p>
        </Card>

        <Card title={<span id="script">5. Sotuv skripti</span>}>
          <p className="text-sm text-slate-700 mb-3">
            Kompaniyaning standart skripti admin panelda yoki API orqali oʻrnatiladi. Skript boʻlsa AI har qoʻngʻiroqni bosqichma-bosqich skript bilan solishtiradi va javobda{' '}
            <code className="font-mono">result.scriptAdherence</code> + <code className="font-mono">scriptScore</code> (0–100) qaytaradi.
          </p>
          <Code>{`GET ${base}/script              → { "script": "...", "updatedAt": "..." }
PUT ${base}/script              { "script": "1. Salomlashish: ...\\n2. Ehtiyoj: ...\\n3. Taklif: ...\\n4. E'tirozlar: ...\\n5. Yakunlash: ..." }
                                 (bo'sh satr "" skriptni o'chiradi)

// result.scriptAdherence
{
  "score": 72,
  "summary": "...",
  "steps": [ { "id": "step-1", "step": "Salomlashish", "required": true, "status": "done|partial|missed",
               "evidence": "aytilgan so'z", "timestamp": "00:05", "comment": "..." } ],
  "deviations": [ { "timestamp": "02:10", "whatHappened": "...", "scriptExpected": "...", "impact": "..." } ],
  "recommendations": [ "..." ],
  "script": "tahlilda ishlatilgan skript matni"
}`}</Code>
          <p className="text-xs text-slate-600 mt-2">Skriptni bosqichlar va majburiy iboralar koʻrinishida yozing. Maqsadga erishgan oqilona improvizatsiya jazolanmaydi.</p>
        </Card>

        <Card title={<span id="lang">6. Tillar</span>}>
          <p className="text-sm text-slate-700 mb-3">
            <strong>Davlat</strong> (admin panelda) qoʻngʻiroq qaysi tilda ekanini bildiradi. <strong>Natija tili</strong> esa tahlil matnlari (xulosa, topshiriqlar, custom field matnlari, skript izohlari) qaysi tilda yozilishini —
            kompaniya darajasida sozlanadi va har soʻrovda <code className="font-mono">outputLanguage</code> bilan oʻzgartiriladi. Transkript va iqtiboslar har doim aytilgan tilda qoladi. Javobda{' '}
            <code className="font-mono">result.language</code>: <code className="font-mono">{`{ country, language, code, outputLanguage, outputCode }`}</code>.
          </p>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">outputLanguage kodlari</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {languages.map((l) => (
              <Badge key={l.code} tone="indigo" title={l.note}>
                {l.code} — {l.language}
              </Badge>
            ))}
          </div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Davlatlar (audio tili)</div>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((c) => (
              <Badge key={c.code} tone="slate" title={c.note}>
                {c.code} · {c.name} — {c.language}
              </Badge>
            ))}
          </div>
        </Card>

        <Card title={<span id="response">7. Javob tuzilmasi (201)</span>}>
          <Code>{`{
  "id": "an_mvc3cn4e8a9348ed24",         // tahlil ID (GET /analyses/:id)
  "externalId": "lead-10542",
  "status": "done",
  "createdAt": "2026-10-17T07:45:00.000Z",
  "fileName": "call.mp3",
  "title": "Narx bo'yicha muzokara",       // AI bergan sarlavha
  "overallScore": 72,                      // 0..100 (umumiy sifat balli)
  "overallGrade": "B",                     // A+ … F
  "rating": { "scale": 10, "score": 7.4, "basis": "script", "label": "good" },   // 10 ballik BAHO (quyida)
  "scriptScore": 45,                       // 0..100 yoki null (skript bo'lmasa)
  "durationSeconds": 412.5,
  "billing": { "billedMinutes": 7, "cost": 3500, "type": "per_minute" },   // package bo'lsa cost 0
  "customFields": { "budget": 1500000, "next_call": "2026-10-24", "stage": "Muzokara" },
  "model": "gemini-3.8-flash",
  "processingMs": 52000,
  "ai": { "inputTokens": 5378, "outputTokens": 7217, "thoughtTokens": 1766, "costUsd": 0.0377 },
  "result": {
    "language": { "country": "UZ", "language": "Uzbek", "code": "uz", "outputLanguage": "Russian", "outputCode": "ru" },
    "callSummary": {
      "title": "...", "duration": "06:52", "durationSeconds": 412.5,
      "speakerA": { "name": "...", "role": "Sales Rep", "talkTimePercent": 58, "wordsSpoken": 640 },
      "speakerB": { "name": "...", "role": "Prospect",  "talkTimePercent": 42, "wordsSpoken": 410 },
      "overallScore": 72, "talkRatio": { "speakerA": 58, "speakerB": 42 },   // foizlarda
      "callOutcome": "...", "keyStrengthsSummary": "...", "primaryRiskSummary": "..."
    },
    "transcript": [
      { "id": "t1", "timestamp": "00:03", "timeSeconds": 3, "speaker": "Speaker A", "speakerName": "...",
        "role": "Sales Rep", "text": "...", "sentiment": "positive|neutral|negative", "engagementScore": 70,
        "keyMoment": "Tanishuv",            // ixtiyoriy
        "coachingFlag": "well|missed" }     // ixtiyoriy
    ],
    "sentimentTimeline": [
      { "time": "01:00", "timeSeconds": 60, "speakerAEngagement": 70, "speakerBEngagement": 55,
        "overallEngagement": 62, "phase": "...", "event": "..." }
    ],
    "coachingCard": {
      "repName": "...", "overallGrade": "B", "summaryAdvice": "...",
      "threeThingsDoneWell":      [ { "id", "title", "quote", "timestamp", "analysis", "category", "impact" } ],
      "threeMissedOpportunities": [ { "id", "title", "quote", "timestamp", "analysis", "category", "recommendation", "alternativeScript" } ],
      "nextActionItems": [ "..." ],
      "tasks": [ { "id": "task-1", "title": "...", "description": "...", "why": "...", "priority": "high|medium|low",
                   "deadline": "...", "category": "...", "successCriteria": "...", "relatedTimestamp": "03:45", "status": "todo" } ]
    },
    "customFields": { ... },                // yuqoridagi bilan bir xil
    "scriptAdherence": { ... },             // faqat skript bo'lsa (5-bo'lim)
    "rating": {                             // 10 ballik baho, mezonlar bilan
      "scale": 10, "score": 7.4, "basis": "script|general", "label": "excellent|good|average|weak|poor",
      "verdict": "Bir jumlali xulosa",
      "criteria": [ { "name": "Salomlashish", "score": 9, "required": true, "comment": "..." }, ... ]
    },
    "source": "api"
  },
  "account": { "balance": 996500, "remainingMinutes": 1993, "subscription": { ... }, "canAnalyze": true }
}`}</Code>
          <p className="text-xs text-slate-600 mt-2">
            <strong>Baho (rating)</strong> — asosiy koʻrsatkich: 10 ballik, bir oʻnlik aniqlikda. Skript berilgan boʻlsa mezonlar = skript bosqichlari (majburiylari ikki karra vazn bilan), aks holda 6 ta standart mezon (salomlashish,
            ehtiyojni aniqlash, taklif, eʼtirozlar, yakunlash, muloqot). Shkala: 9–10 aʼlo, 7–8.9 yaxshi, 5–6.9 oʻrtacha, 3–4.9 zaif, &lt;3 yomon. <code className="font-mono">overallScore</code> (0–100) va{' '}
            <code className="font-mono">overallGrade</code> qoʻshimcha umumiy sifat koʻrsatkichlari.
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Mashina oʻqiydigan qiymatlar har doim inglizcha va oʻzgarmas: <code className="font-mono">speaker</code> (Speaker A/B), <code className="font-mono">role</code> (Sales Rep/Prospect), <code className="font-mono">sentiment</code>,{' '}
            <code className="font-mono">coachingFlag</code>, <code className="font-mono">priority</code>, <code className="font-mono">status</code>. Qolgan matnlar natija tilida.
          </p>
        </Card>

        <Card title={<span id="other">8. Boshqa endpointlar</span>}>
          <Table head={['Metod', 'Yoʻl', 'Tavsif']}>
            <Row cells={['GET', '/account', 'Kompaniya, tarif (subscription), qoldiq daqiqalar/balans, shu oy statistikasi, standart customFields, hasScript, outputLanguage, languages']} mono={[0, 1]} />
            <Row cells={['GET', '/analyses?limit=20&offset=0&externalId=', 'Tahlillar roʻyxati (result siz), yangilari birinchi. total, limit, offset, items']} mono={[0, 1]} />
            <Row cells={['GET', '/analyses/:id', 'Toʻliq tahlil (result bilan). Avval olingan natijani qayta yuklash uchun — bepul']} mono={[0, 1]} />
            <Row cells={['GET', '/script', 'Kompaniyaning standart sotuv skripti']} mono={[0, 1]} />
            <Row cells={['PUT', '/script', 'Standart skriptni oʻrnatish/oʻchirish { script }']} mono={[0, 1]} />
            <Row cells={['POST', '/custom-fields/validate', 'Field taʼriflarini tekshirish { customFields } → { ok, fields } (pul sarflanmaydi)']} mono={[0, 1]} />
          </Table>
          <Code>{`// GET ${base}/account
{
  "companyId": "co_...", "companyName": "...", "country": "UZ", "status": "active",
  "subscription": { "planName": "100 soat", "type": "package", "includedMinutes": 6000, "usedMinutes": 412, "remainingMinutes": 5588, "expiresAt": "2027-10-17T..." },
  "pendingSubscription": null,
  "balance": 0, "remainingMinutes": 5588,
  "thisMonth": { "calls": 12, "minutes": 48, "cost": 0 },
  "canAnalyze": true,
  "customFields": [ ... ], "hasScript": true, "outputLanguage": "uz", "languages": [ { "code": "uz", "language": "Uzbek" }, ... ]
}`}</Code>
        </Card>

        <Card title={<span id="errors">9. Xato kodlari va limitlar</span>}>
          <p className="text-sm text-slate-700 mb-2">
            Xato javobi: <code className="font-mono">{`{ "error": "odam o'qiydigan matn", "code": "MASHINA_KODI", ...qo'shimcha }`}</code>. Logikani <code className="font-mono">code</code> boʻyicha quring, matn oʻzgarishi mumkin.
          </p>
          <Table head={['HTTP', 'code', 'Maʼnosi / nima qilish kerak']}>
            {[
              ['400', 'NO_AUDIO', 'Audio yuborilmadi (multipart "audio" yoki JSON "audioBase64")'],
              ['400', 'INVALID_CUSTOM_FIELDS', 'customFields taʼrifi notoʻgʻri (key, type, options). /custom-fields/validate bilan tekshiring'],
              ['400', 'INVALID_LANGUAGE', 'outputLanguage kodi roʻyxatda yoʻq'],
              ['400', 'INVALID_SCRIPT', 'PUT /script: "script" matn emas'],
              ['401', 'NO_TOKEN / INVALID_TOKEN', 'Token yoʻq, notoʻgʻri yoki bekor qilingan — foydalanuvchiga xabar, qayta urinmang'],
              ['402', 'NO_PLAN', 'Kompaniyaga tarif biriktirilmagan — administrator bilan bogʻlaning'],
              ['402', 'LIMIT_EXCEEDED', 'Paket daqiqalari tugadi. Javobda remainingMinutes, requiredMinutes'],
              ['402', 'INSUFFICIENT_BALANCE', 'Daqiqalik tarifda balans yetmaydi. Javobda balance, requiredAmount'],
              ['403', 'COMPANY_PENDING', 'Toʻlov tasdiqlanmagan, kompaniya hali ochilmagan'],
              ['403', 'COMPANY_SUSPENDED', 'Kompaniya toʻxtatilgan'],
              ['404', 'NOT_FOUND', 'Tahlil topilmadi (boshqa kompaniyaniki boʻlishi ham mumkin)'],
              ['413', 'FILE_TOO_LARGE', 'Fayl 60 MB dan katta — siqib yuboring (mp3 64 kbps yetarli)'],
              ['422', 'AUDIO_TOO_LONG', 'Audio ruxsat etilgan maksimal uzunlikdan uzun (standart 120 daqiqa)'],
              ['429', 'RATE_LIMITED', 'Bir daqiqada 30 tadan koʻp /analyze soʻrovi — Retry-After dan keyin qayta yuboring'],
              ['502', 'AI_ERROR', 'AI xizmati soʻrovni rad etdi (masalan, buzilgan audio)'],
              ['503', 'AI_UNAVAILABLE', 'AI band (ichki qayta urinishlar tugadi) — 30–60 s dan keyin qayta yuboring'],
              ['503', 'GEMINI_NOT_CONFIGURED', 'Serverda AI kaliti sozlanmagan — administrator'],
            ].map(([h, c, d]) => (
              <Row key={c} cells={[h, c, d]} mono={[0, 1]} />
            ))}
          </Table>
          <p className="text-xs text-slate-600 mt-3">
            Limitlar: /analyze — 30 soʻrov/daqiqa/kompaniya; fayl 60 MB; audio 120 daqiqa (sozlanadi); customFields 40 ta; script 20 000 belgi; externalId 200 belgi. 402/403/413/422 xatolarida qayta urinish foydasiz — avval sababni bartaraf eting.
          </p>
        </Card>

        <Card title={<span id="billing">10. Hisob-kitob</span>}>
          <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5">
            <li>Davomiylik fayl sarlavhasidan aniqlanadi (Gemini'ga yuborishdan oldin), har boshlangan daqiqa toʻliq daqiqa (0:30 → 1 daq, 4:01 → 5 daq).</li>
            <li>
              <strong>Daqiqalik tarif</strong>: <code className="font-mono">daqiqa × narx</code> oldindan toʻldirilgan balansdan yechiladi. <strong>Paket</strong>: N daqiqa limiti, ixtiyoriy amal muddati. Holatni{' '}
              <code className="font-mono">GET /account</code> yoki har javobdagi <code className="font-mono">account</code> dan kuzating.
            </li>
            <li>Xato bilan tugagan tahlil uchun hech narsa yechilmaydi. Bir xil faylni ikki marta yuborsangiz ikki marta yechiladi — idempotentlik uchun externalId boʻyicha avval GET /analyses?externalId= qiling.</li>
            <li>Limit oldindan tekshiriladi: yetmasa 402 qaytadi va AI'ga soʻrov ketmaydi.</li>
          </ul>
        </Card>

        <Card title={<span id="examples">11. Kod misollari</span>}>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Node.js 18+</div>
          <Code>{`import fs from 'node:fs';

const fd = new FormData();
fd.append('audio', new Blob([fs.readFileSync('call.mp3')], { type: 'audio/mpeg' }), 'call.mp3');
fd.append('externalId', 'lead-10542');
fd.append('outputLanguage', 'ru');
fd.append('customFields', JSON.stringify([
  { key: 'budget', label: 'Byudjet', type: 'number' },
  { key: 'interested', label: 'Qiziqdi', type: 'boolean' },
]));

const res = await fetch('${base}/analyze', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.SCI_TOKEN },
  body: fd,
  signal: AbortSignal.timeout(300_000),
});
const data = await res.json();
if (!res.ok) throw new Error(data.code + ': ' + data.error);

console.log(data.overallScore, data.customFields, data.result.coachingCard.tasks);`}</Code>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 mt-4">Python 3 (requests)</div>
          <Code>{`import json, requests

r = requests.post(
    "${base}/analyze",
    headers={"Authorization": "Bearer sci_..."},
    files={"audio": ("call.mp3", open("call.mp3", "rb"), "audio/mpeg")},
    data={
        "externalId": "lead-10542",
        "callDate": "2026-10-17",
        "customFields": json.dumps([{"key": "budget", "label": "Byudjet", "type": "number"}]),
    },
    timeout=300,
)
data = r.json()
if r.status_code != 201:
    raise RuntimeError(f"{data.get('code')}: {data.get('error')}")
print(data["overallScore"], data["customFields"], [t["title"] for t in data["result"]["coachingCard"]["tasks"]])`}</Code>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 mt-4">PHP 8 (cURL)</div>
          <Code>{`$ch = curl_init("${base}/analyze");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 300,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer sci_..."],
  CURLOPT_POSTFIELDS => [
    "audio" => new CURLFile("call.mp3", "audio/mpeg", "call.mp3"),
    "externalId" => "lead-10542",
    "customFields" => json_encode([["key" => "budget", "label" => "Byudjet", "type" => "number"]]),
  ],
]);
$data = json_decode(curl_exec($ch), true);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($status !== 201) throw new Exception($data["code"] . ": " . $data["error"]);
echo $data["overallScore"], PHP_EOL;`}</Code>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 mt-4">Oldingi natijani olish</div>
          <Code>{`GET ${base}/analyses?externalId=lead-10542   → items[0].id
GET ${base}/analyses/an_...                   → to'liq result`}</Code>
        </Card>

        <Card title={<span id="tips">12. Integratsiya maslahatlari</span>}>
          <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5">
            <li>
              <strong>Fon rejimida yuboring.</strong> Tahlil 30–90 s davom etadi: CRM'da qoʻngʻiroq tugagach navbatga (job/queue) qoʻying, javob kelgach kartochkani yangilang. Foydalanuvchini kutdirmang.
            </li>
            <li>
              <strong>externalId har doim yuboring</strong> — qayta yuborishlarni oldini oladi va tahlilni CRM yozuvi bilan bogʻlaydi.
            </li>
            <li>
              <strong>Natijani oʻzingizda saqlang</strong> (kamida id, overallScore, customFields, tasks). Toʻliq JSON keyin ham GET /analyses/:id bilan olinadi.
            </li>
            <li>
              <strong>Custom field description</strong> ga aniq koʻrsatma yozing («soʻmda», «faqat shahar nomi»). select variantlarini CRM'dagi qiymatlar bilan aynan bir xil qiling.
            </li>
            <li>
              <strong>Xatolarni code boʻyicha ajrating:</strong> 402 → administratorga toʻlov haqida xabar; 503 → 1 daqiqadan keyin qayta; 4xx qolganlari → soʻrovni toʻgʻrilash.
            </li>
            <li>
              <strong>Audio sifati:</strong> mono 16 kHz+ yetarli, mp3 64 kbps hajmni kichraytiradi. Juda qisqa (10 s dan kam) yozuvlar ham 1 daqiqa deb hisoblanadi.
            </li>
            <li>
              <strong>Tasks → CRM vazifalar.</strong> Har task'da title, description, deadline, priority bor — bevosita CRM "Vazifa" obyektiga aylantirsa boʻladi; relatedTimestamp audioning kerakli joyiga havola uchun.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
