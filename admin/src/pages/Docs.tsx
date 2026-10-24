import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { Country } from '../types';
import { Badge, Card, PageHeader, Table, Td } from '../components/ui';

const Code: React.FC<{ children: string; lang?: string }> = ({ children }) => (
  <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-[11.5px] font-mono overflow-x-auto thin-scroll leading-relaxed">{children}</pre>
);

export default function Docs() {
  const [countries, setCountries] = useState<Country[]>([]);
  useEffect(() => {
    api.meta().then((m) => setCountries(m.countries)).catch(() => {});
  }, []);
  const base = `${window.location.origin}/api/v1`;

  return (
    <>
      <PageHeader title="API hujjatlari" subtitle="CRM tizimlari uchun integratsiya qoʻllanmasi. Shu matnni kompaniyaga yuborish mumkin." />

      <div className="space-y-6 max-w-4xl">
        <Card title="1. Autentifikatsiya">
          <p className="text-sm text-slate-700 mb-3">
            Har bir kompaniyaga admin panelda token beriladi. Barcha soʻrovlarda sarlavha yuboriladi:
          </p>
          <Code>{`Authorization: Bearer sci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="text-xs text-slate-500 mt-2">
            Asosiy manzil: <code className="font-mono">{base}</code>
          </p>
        </Card>

        <Card title="2. Audio tahlil — POST /analyze">
          <p className="text-sm text-slate-700 mb-3">
            Audio fayl yuboriladi, javobda toʻliq tahlil JSON koʻrinishida qaytadi (sinxron, odatda 30–90 soniya). Davomiylik faylning oʻzidan aniqlanadi va tarif limiti tekshiriladi; har boshlangan daqiqa toʻliq daqiqa sifatida hisoblanadi.
          </p>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">multipart/form-data</div>
          <Code>{`curl -X POST ${base}/analyze \\
  -H "Authorization: Bearer sci_..." \\
  -F "audio=@call_2026-10-17.mp3" \\
  -F "externalId=lead-10542" \\
  -F "callDate=2026-10-17" \\
  -F 'customFields=[
        {"key":"budget","label":"Byudjet","type":"number","description":"Mijoz aytgan byudjet, so\\u02bbmda"},
        {"key":"next_call","label":"Keyingi qo\\u02bbng\\u02bbiroq","type":"date"},
        {"key":"stage","label":"Bosqich","type":"select","options":["Yangi","Muzokara","Yopildi","Rad"]}
      ]'`}</Code>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 mt-4">application/json (base64)</div>
          <Code>{`POST ${base}/analyze
Content-Type: application/json

{
  "audioBase64": "<base64>",
  "mimeType": "audio/mpeg",
  "fileName": "call.mp3",
  "externalId": "lead-10542",
  "callDate": "2026-10-17",
  "notes": "Ikkinchi qo\\u02bbng\\u02bbiroq, oldin KP yuborilgan",
  "customFields": [ { "key": "budget", "type": "number", "label": "Byudjet" } ]
}`}</Code>
          <div className="mt-4 text-sm text-slate-700">
            <strong>Parametrlar:</strong>
          </div>
          <Table head={['Nomi', 'Majburiy', 'Tavsif']}>
            <tr>
              <Td mono>audio / audioBase64</Td>
              <Td>ha</Td>
              <Td className="text-xs">mp3, wav, m4a, aac, ogg, opus, flac, webm, amr. 60 MB gacha.</Td>
            </tr>
            <tr>
              <Td mono>externalId</Td>
              <Td>yoʻq</Td>
              <Td className="text-xs">CRM'dagi lead/deal/call ID. Keyin GET /analyses?externalId= bilan topiladi.</Td>
            </tr>
            <tr>
              <Td mono>customFields</Td>
              <Td>yoʻq</Td>
              <Td className="text-xs">CRM fieldlari (JSON massiv). Kompaniya uchun admin panelda saqlangan standart fieldlarga qoʻshiladi.</Td>
            </tr>
            <tr>
              <Td mono>callDate</Td>
              <Td>yoʻq</Td>
              <Td className="text-xs">Qoʻngʻiroq sanasi (YYYY-MM-DD). «Keyingi haftada» kabi nisbiy sanalarni hisoblash uchun.</Td>
            </tr>
            <tr>
              <Td mono>notes</Td>
              <Td>yoʻq</Td>
              <Td className="text-xs">CRM'dan kontekst (mahsulot, oldingi bosqich). AI'ga yordam beradi.</Td>
            </tr>
            <tr>
              <Td mono>script</Td>
              <Td>yoʻq</Td>
              <Td className="text-xs">
                Shu qoʻngʻiroq uchun sotuv skripti (matn). Yuborilmasa kompaniyaning standart skripti ishlatiladi; boʻsh satr yuborilsa shu qoʻngʻiroq skriptsiz tahlil qilinadi. Natijada{' '}
                <code className="font-mono">result.scriptAdherence</code> va <code className="font-mono">scriptScore</code> qaytadi.
              </Td>
            </tr>
          </Table>
        </Card>

        <Card title="2a. Sotuv skripti — GET / PUT /script">
          <p className="text-sm text-slate-700 mb-3">
            Kompaniyaning standart skripti admin panelda yoki CRM'dan oʻrnatiladi. AI har qoʻngʻiroqni skript bosqichlari boʻyicha baholaydi: bajarildi / qisman / oʻtkazib yuborildi, iqtibos va vaqt bilan, umumiy ball 0–100.
          </p>
          <Code>{`PUT ${base}/script
Content-Type: application/json

{ "script": "1. Salomlashish: ...\\n2. Ehtiyojni aniqlash: ...\\n3. Taklif: ...\\n4. E'tirozlar: ...\\n5. Yakunlash: ..." }

// Javobdagi scriptAdherence:
{
  "score": 72,
  "summary": "...",
  "steps": [ { "step": "Salomlashish", "status": "done", "evidence": "...", "timestamp": "00:05", "comment": "..." }, ... ],
  "deviations": [ { "timestamp": "02:10", "whatHappened": "...", "scriptExpected": "...", "impact": "..." } ],
  "recommendations": [ "..." ]
}`}</Code>
        </Card>

        <Card title="3. Custom field turlari">
          <Table head={['type', 'Qaytadi', 'Misol']}>
            {[
              ['text', 'string', '"Toshkent, Chilonzor"'],
              ['number', 'number (birliksiz)', '1500000'],
              ['boolean', 'true / false', 'true'],
              ['date', 'YYYY-MM-DD', '"2026-10-24"'],
              ['select', 'options ichidan bittasi (aynan)', '"Muzokara"'],
              ['list', 'string[]', '["Narx", "Yetkazib berish"]'],
            ].map(([t, r, e]) => (
              <tr key={t}>
                <Td mono>{t}</Td>
                <Td className="text-xs">{r}</Td>
                <Td mono>{e}</Td>
              </tr>
            ))}
          </Table>
          <p className="text-xs text-slate-600 mt-3">
            Audio ichida maʼlumot boʻlmasa qiymat <code className="font-mono">null</code> boʻladi. <code className="font-mono">description</code> maydoni AI'ga nimani qidirishni tushuntiradi — qanchalik aniq boʻlsa, natija shunchalik yaxshi. Field key: harf bilan boshlanadi, harf/raqam/_ .
          </p>
        </Card>

        <Card title="4. Javob (201)">
          <Code>{`{
  "id": "an_mvc3cn4e8a9348ed24",
  "externalId": "lead-10542",
  "status": "done",
  "createdAt": "2026-10-17T07:45:00.000Z",
  "title": "Narx bo\\u02bbyicha muzokara",
  "overallScore": 72,
  "overallGrade": "B",
  "durationSeconds": 412.5,
  "billing": { "billedMinutes": 7, "cost": 3500, "type": "per_minute" },
  "customFields": { "budget": 1500000, "next_call": "2026-10-24", "stage": "Muzokara" },
  "result": {
    "language": { "country": "UZ", "language": "Uzbek", "code": "uz" },
    "callSummary":  { "title", "duration", "durationSeconds", "speakerA", "speakerB", "overallScore", "talkRatio", "callOutcome", "keyStrengthsSummary", "primaryRiskSummary" },
    "transcript":   [ { "timestamp", "speaker", "speakerName", "role", "text", "sentiment", "engagementScore", "keyMoment?", "coachingFlag?" } ],
    "sentimentTimeline": [ { "time", "speakerAEngagement", "speakerBEngagement", "overallEngagement", "phase", "event" } ],
    "coachingCard": {
      "repName", "overallGrade", "summaryAdvice",
      "threeThingsDoneWell":      [ { "title", "quote", "timestamp", "analysis", "category", "impact" } ],
      "threeMissedOpportunities": [ { "title", "quote", "timestamp", "analysis", "category", "recommendation", "alternativeScript" } ],
      "nextActionItems": [ "..." ],
      "tasks": [ { "id", "title", "description", "why", "priority", "deadline", "category", "successCriteria", "relatedTimestamp" } ]
    },
    "customFields": { ... }
  },
  "account": { "balance": 996500, "remainingMinutes": 1993, "subscription": { ... } }
}`}</Code>
        </Card>

        <Card title="5. Boshqa endpointlar">
          <Table head={['Metod', 'Yoʻl', 'Tavsif']}>
            <tr>
              <Td mono>GET</Td>
              <Td mono>/account</Td>
              <Td className="text-xs">Tarif, qoldiq daqiqalar / balans, shu oy statistikasi, standart custom fieldlar</Td>
            </tr>
            <tr>
              <Td mono>GET</Td>
              <Td mono>/analyses?limit=20&offset=0&externalId=</Td>
              <Td className="text-xs">Tahlillar roʻyxati (qisqa koʻrinish)</Td>
            </tr>
            <tr>
              <Td mono>GET</Td>
              <Td mono>/analyses/:id</Td>
              <Td className="text-xs">Toʻliq tahlil (result bilan)</Td>
            </tr>
            <tr>
              <Td mono>POST</Td>
              <Td mono>/custom-fields/validate</Td>
              <Td className="text-xs">Field taʼriflarini tekshirish (daqiqa sarflanmaydi)</Td>
            </tr>
          </Table>
        </Card>

        <Card title="6. Xato kodlari">
          <Table head={['HTTP', 'code', 'Maʼnosi']}>
            {[
              ['401', 'NO_TOKEN / INVALID_TOKEN', 'Token yoʻq, notoʻgʻri yoki bekor qilingan'],
              ['402', 'NO_PLAN', 'Kompaniyaga tarif biriktirilmagan'],
              ['402', 'LIMIT_EXCEEDED', 'Paketdagi daqiqalar tugadi (remainingMinutes, requiredMinutes qaytadi)'],
              ['402', 'INSUFFICIENT_BALANCE', 'Daqiqalik tarifda balans yetmaydi (balance, requiredAmount qaytadi)'],
              ['403', 'COMPANY_SUSPENDED', 'Kompaniya toʻxtatilgan'],
              ['403', 'COMPANY_PENDING', 'Toʻlov hali tasdiqlanmagan, kompaniya ochilmagan'],
              ['400', 'NO_AUDIO / INVALID_CUSTOM_FIELDS', 'Soʻrov notoʻgʻri'],
              ['413', 'FILE_TOO_LARGE', 'Fayl 60 MB dan katta'],
              ['422', 'AUDIO_TOO_LONG', 'Audio ruxsat etilgan maksimal uzunlikdan uzun'],
              ['429', 'RATE_LIMITED', 'Bir daqiqada 30 tadan koʻp soʻrov'],
              ['503', 'AI_UNAVAILABLE / GEMINI_NOT_CONFIGURED', 'AI xizmati band yoki kalit sozlanmagan — keyinroq qayta urinish'],
            ].map(([h, c, d]) => (
              <tr key={c}>
                <Td mono>{h}</Td>
                <Td mono>{c}</Td>
                <Td className="text-xs">{d}</Td>
              </tr>
            ))}
          </Table>
          <p className="text-xs text-slate-600 mt-3">
            Xato javobi: <code className="font-mono">{`{ "error": "...", "code": "..." }`}</code>. Xato boʻlganda hisobdan hech narsa yechilmaydi.
          </p>
        </Card>

        <Card title="7. Davlat va til">
          <p className="text-sm text-slate-700 mb-3">
            Kompaniyaga admin panelda davlat tanlanadi. Audio shu davlat tilida deb qabul qilinadi va barcha natija matnlari (xulosa, topshiriqlar, custom field matnlari) shu tilda qaytadi. Transkript esa aynan aytilgan tilda qoladi.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((c) => (
              <Badge key={c.code} tone="slate" title={c.note}>
                {c.code} · {c.name} — {c.language}
              </Badge>
            ))}
          </div>
        </Card>

        <Card title="8. Node.js misoli">
          <Code>{`import fs from 'node:fs';

const fd = new FormData();
fd.append('audio', new Blob([fs.readFileSync('call.mp3')], { type: 'audio/mpeg' }), 'call.mp3');
fd.append('externalId', 'lead-10542');
fd.append('customFields', JSON.stringify([
  { key: 'budget', label: 'Byudjet', type: 'number' },
  { key: 'interested', label: 'Qiziqdi', type: 'boolean' },
]));

const res = await fetch('${base}/analyze', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.SCI_TOKEN },
  body: fd,
});
const data = await res.json();
if (!res.ok) throw new Error(data.code + ': ' + data.error);

console.log(data.overallScore, data.customFields, data.result.coachingCard.tasks);`}</Code>
        </Card>
      </div>
    </>
  );
}
