# Sales Coaching Platform — CRM integratsiya API

Versiya: 1.1 · 2026-10-24 · Asosiy manzil: `https://ai-coach.biznesim.uz/api/v1`

Platforma savdo qoʻngʻiroqlari audiosini qabul qiladi va JSON koʻrinishida toʻliq tahlil qaytaradi:
10 ballik baho (mezonlar bilan), soʻzlovchilarga ajratilgan transkript, qiziqish dinamikasi, kouching kartasi
(3 kuchli tomon, 3 boy berilgan imkoniyat), menejer uchun SMART topshiriqlar, CRM fieldlari qiymatlari va
(skript berilgan boʻlsa) sotuv skriptiga muvofiqlik.

| Parametr | Qiymat |
|---|---|
| Protokol | HTTPS, JSON (UTF-8); fayllar multipart/form-data yoki base64 |
| Tahlil vaqti | Sinxron, odatda 30–120 s (audio uzunligiga bogʻliq). HTTP timeout ≥ 300 s |
| Audio formatlar | mp3, wav, m4a, aac, ogg, opus, flac, webm, amr, mp4 (audio). 60 MB gacha, standart maks. 120 daqiqa |
| Hisob-kitob | Har boshlangan daqiqa toʻliq daqiqa. Xato tahlil uchun yechilmaydi |

---

## 1. Autentifikatsiya

Har kompaniyaga admin panelda API token beriladi (`sci_…`, 52 belgi). Token faqat yaratilganda bir marta
koʻrsatiladi. Tokenni server tomonda saqlang.

```
Authorization: Bearer sci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# yoki
X-API-Key: sci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Tekshirish: `GET /account` → 200 (toʻgʻri) yoki 401 (notoʻgʻri / bekor qilingan).

---

## 2. Tahlil — `POST /analyze`

### A) multipart/form-data (tavsiya etiladi)

```bash
curl -X POST https://ai-coach.biznesim.uz/api/v1/analyze \
  -H "Authorization: Bearer sci_..." \
  -F "audio=@call_2026-10-17.mp3" \
  -F "externalId=lead-10542" \
  -F "callDate=2026-10-17" \
  -F "notes=Ikkinchi qo'ng'iroq, KP yuborilgan" \
  -F "outputLanguage=ru" \
  -F 'customFields=[
        {"key":"budget","label":"Byudjet","type":"number","description":"Mijoz aytgan byudjet, so'"'"'mda"},
        {"key":"next_call","label":"Keyingi qo'"'"'ng'"'"'iroq","type":"date"},
        {"key":"stage","label":"Bosqich","type":"select","options":["Yangi","Muzokara","Yopildi","Rad"]}
      ]'
```

### B) application/json (base64)

```json
POST /api/v1/analyze
Content-Type: application/json

{
  "audioBase64": "<base64>",
  "mimeType": "audio/mpeg",
  "fileName": "call.mp3",
  "externalId": "lead-10542",
  "callDate": "2026-10-17",
  "notes": "Ikkinchi qo'ng'iroq",
  "outputLanguage": "ru",
  "script": "1. Salomlashish ...",
  "customFields": [ { "key": "budget", "type": "number", "label": "Byudjet" } ]
}
```

### Parametrlar

| Parametr | Majburiy | Tavsif |
|---|---|---|
| `audio` / `audioBase64` | ha | Audio fayl (multipart `audio`) yoki base64 satr (`data:…;base64,` prefiksi boʻlsa ham boʻladi). 60 MB gacha |
| `mimeType` | yoʻq | JSON variantida MIME turi; berilmasa kengaytmadan aniqlanadi |
| `fileName` | yoʻq | Fayl nomi (hisobotlarda koʻrinadi) |
| `externalId` | yoʻq | CRM dagi lead/deal/call ID (≤200 belgi). `GET /analyses?externalId=` bilan topiladi |
| `callDate` | yoʻq | Qoʻngʻiroq sanasi `YYYY-MM-DD` — nisbiy sanalarni (`date` fieldlar) hisoblash uchun |
| `notes` | yoʻq | CRM dan kontekst: mahsulot, bosqich, mijoz haqida qisqa maʼlumot |
| `customFields` | yoʻq | CRM fieldlari taʼrifi (JSON massiv, ≤40). Kompaniyaning standart fieldlariga qoʻshiladi; bir xil `key` boʻlsa soʻrovdagisi ustun |
| `script` | yoʻq | Shu qoʻngʻiroq uchun sotuv skripti (≤20 000 belgi). Berilmasa kompaniya skripti; `""` yuborilsa skriptsiz tahlil |
| `outputLanguage` | yoʻq | Natija matnlari tili (`ru`, `en`, `uz`, `uz-Cyrl`, …). Berilmasa kompaniya sozlamasi, u ham boʻlmasa davlat tili |

---

## 3. Custom fieldlar

Taʼrif: `{ key, label?, type?, description?, options? }`. `key` harf bilan boshlanadi, faqat harf/raqam/_ (≤64).

| type | Qaytadi | Misol | Izoh |
|---|---|---|---|
| `text` | string | `"Toshkent, Chilonzor"` | qisqa matn, natija tilida |
| `number` | number | `1500000` | birliksiz |
| `boolean` | true/false | `true` | |
| `date` | `"YYYY-MM-DD"` | `"2026-10-24"` | `callDate` bilan nisbiy sanalar hisoblanadi |
| `select` | options dan bittasi | `"Muzokara"` | options ≥2, qiymat aynan nusxalanadi |
| `list` | string[] | `["Narx","Muddat"]` | |

Audioda maʼlumot boʻlmasa qiymat `null` — AI hech narsa oʻylab topmaydi. `description` AI ga nimani qidirishni
aytadi («Mijoz aytgan oylik byudjet, soʻmda; aytilmasa null»). Tekshirish (bepul): `POST /custom-fields/validate`
`{ "customFields": [...] }` → `{ ok, fields }`.

---

## 4. Sotuv skripti

```
GET /script              → { "script": "...", "updatedAt": "..." }
PUT /script              { "script": "1. Salomlashish: ...\n2. Ehtiyoj: ...\n..." }   ("" = oʻchirish)
```

Skript boʻlsa javobda `result.scriptAdherence` va `scriptScore` (0–100) qaytadi, **baho (`rating`) esa skript
bosqichlari boʻyicha hisoblanadi**:

```json
"scriptAdherence": {
  "score": 52,
  "summary": "...",
  "steps": [ { "id": "step-1", "step": "Salomlashish", "required": true, "status": "done|partial|missed",
               "evidence": "aytilgan so'z", "timestamp": "00:05", "comment": "..." } ],
  "deviations": [ { "timestamp": "02:10", "whatHappened": "...", "scriptExpected": "...", "impact": "..." } ],
  "recommendations": [ "..." ],
  "script": "tahlilda ishlatilgan skript"
}
```

---

## 5. Tillar

- **Davlat** (admin panelda) — qoʻngʻiroq tili. **Natija tili** — tahlil matnlari tili; kompaniya darajasida
  sozlanadi, har soʻrovda `outputLanguage` bilan oʻzgartiriladi. Transkript va iqtiboslar aytilgan tilda qoladi.
- Javobda `result.language = { country, language, code, outputLanguage, outputCode }`.
- Kodlar: `uz` Uzbek (lotin), `uz-Cyrl` Uzbek (kirill), `ru`, `kk`, `ky`, `tg`, `tk`, `az`, `tr`, `en`, `de`, `fr`,
  `es`, `it`, `pl`, `uk`, `ar`, `hi`, `ur`, `zh`, `ja`, `ko`, `id`, `pt`. Toʻliq roʻyxat `GET /account` → `languages`.

---

## 6. Javob tuzilmasi (201)

```jsonc
{
  "id": "an_mvc3cn4e8a9348ed24",
  "externalId": "lead-10542",
  "status": "done",
  "createdAt": "2026-10-17T07:45:00.000Z",
  "fileName": "call.mp3",
  "title": "Narx bo'yicha muzokara",
  "rating": { "scale": 10, "score": 7.4, "basis": "script", "label": "good" },   // ASOSIY BAHO
  "overallScore": 72,                       // 0..100, umumiy sifat
  "overallGrade": "B",
  "scriptScore": 52,                        // 0..100 yoki null
  "durationSeconds": 412.5,
  "billing": { "billedMinutes": 7, "cost": 3500, "type": "per_minute" },
  "customFields": { "budget": 1500000, "next_call": "2026-10-24", "stage": "Muzokara" },
  "model": "gemini-3.8-flash",
  "processingMs": 52000,
  "ai": { "inputTokens": 5378, "outputTokens": 7217, "thoughtTokens": 1766, "costUsd": 0.0377 },
  "result": {
    "language": { "country": "UZ", "language": "Uzbek", "code": "uz", "outputLanguage": "Russian", "outputCode": "ru" },
    "rating": {
      "scale": 10, "score": 7.4, "basis": "script|general", "label": "excellent|good|average|weak|poor",
      "verdict": "Bir jumlali xulosa",
      "criteria": [ { "name": "Salomlashish", "score": 9, "required": true, "comment": "..." } ]
    },
    "callSummary": {
      "title": "...", "duration": "06:52", "durationSeconds": 412.5,
      "speakerA": { "name": "...", "role": "Sales Rep", "talkTimePercent": 58, "wordsSpoken": 640 },
      "speakerB": { "name": "...", "role": "Prospect",  "talkTimePercent": 42, "wordsSpoken": 410 },
      "overallScore": 72, "talkRatio": { "speakerA": 58, "speakerB": 42 },
      "callOutcome": "...", "keyStrengthsSummary": "...", "primaryRiskSummary": "..."
    },
    "transcript": [
      { "id": "t1", "timestamp": "00:03", "timeSeconds": 3, "speaker": "Speaker A", "speakerName": "...",
        "role": "Sales Rep", "text": "...", "sentiment": "positive|neutral|negative", "engagementScore": 70,
        "keyMoment": "...", "coachingFlag": "well|missed" }
    ],
    "sentimentTimeline": [ { "time": "01:00", "timeSeconds": 60, "speakerAEngagement": 70, "speakerBEngagement": 55, "overallEngagement": 62, "phase": "...", "event": "..." } ],
    "coachingCard": {
      "repName": "...", "overallGrade": "B", "summaryAdvice": "...",
      "threeThingsDoneWell":      [ { "id", "title", "quote", "timestamp", "analysis", "category", "impact" } ],
      "threeMissedOpportunities": [ { "id", "title", "quote", "timestamp", "analysis", "category", "recommendation", "alternativeScript" } ],
      "nextActionItems": [ "..." ],
      "tasks": [ { "id": "task-1", "title": "...", "description": "...", "why": "...", "priority": "high|medium|low",
                   "deadline": "...", "category": "...", "successCriteria": "...", "relatedTimestamp": "03:45", "status": "todo" } ]
    },
    "customFields": { },
    "scriptAdherence": { },
    "source": "api|admin|portal"
  },
  "account": { "balance": 996500, "remainingMinutes": 1993, "subscription": { }, "canAnalyze": true }
}
```

**Baho (`rating`)** — asosiy koʻrsatkich, 10 ballik, bir oʻnlik aniqlikda. Skript berilgan boʻlsa mezonlar =
skript bosqichlari (majburiylari ikki karra vazn), aks holda 6 standart mezon (salomlashish, ehtiyojni aniqlash,
taklif, eʼtirozlar, yakunlash, muloqot). Shkala: 9–10 aʼlo, 7–8.9 yaxshi, 5–6.9 oʻrtacha, 3–4.9 zaif, <3 yomon.

Mashina oʻqiydigan qiymatlar har doim inglizcha va oʻzgarmas: `speaker`, `role`, `sentiment`, `coachingFlag`,
`priority`, `status`, `rating.label`, `rating.basis`. Qolgan matnlar natija tilida.

---

## 7. Boshqa endpointlar

| Metod | Yoʻl | Tavsif |
|---|---|---|
| GET | `/account` | Tarif, qoldiq daqiqalar/balans, shu oy statistikasi, standart customFields, hasScript, outputLanguage, languages |
| GET | `/analyses?limit=20&offset=0&externalId=` | Tahlillar roʻyxati (result siz): `{ total, limit, offset, items }` |
| GET | `/analyses/:id` | Toʻliq tahlil (bepul) |
| GET | `/script` | Standart sotuv skripti |
| PUT | `/script` | Skriptni oʻrnatish / oʻchirish |
| POST | `/custom-fields/validate` | Field taʼriflarini tekshirish (bepul) |

---

## 8. Xato kodlari va limitlar

Xato javobi: `{ "error": "matn", "code": "KOD", ...qoʻshimcha }`. Logikani `code` boʻyicha quring.

| HTTP | code | Maʼnosi |
|---|---|---|
| 400 | `NO_AUDIO` | Audio yuborilmadi |
| 400 | `INVALID_CUSTOM_FIELDS` | customFields taʼrifi notoʻgʻri |
| 400 | `INVALID_LANGUAGE` | outputLanguage kodi roʻyxatda yoʻq |
| 400 | `INVALID_SCRIPT` | PUT /script: script matn emas |
| 401 | `NO_TOKEN` / `INVALID_TOKEN` | Token yoʻq / notoʻgʻri / bekor qilingan |
| 402 | `NO_PLAN` | Tarif biriktirilmagan |
| 402 | `LIMIT_EXCEEDED` | Paket daqiqalari tugadi (`remainingMinutes`, `requiredMinutes`) |
| 402 | `INSUFFICIENT_BALANCE` | Balans yetmaydi (`balance`, `requiredAmount`) |
| 403 | `COMPANY_PENDING` | Toʻlov tasdiqlanmagan |
| 403 | `COMPANY_SUSPENDED` | Kompaniya toʻxtatilgan |
| 404 | `NOT_FOUND` | Tahlil topilmadi |
| 413 | `FILE_TOO_LARGE` | Fayl > 60 MB |
| 422 | `AUDIO_TOO_LONG` | Audio maksimal uzunlikdan uzun |
| 429 | `RATE_LIMITED` | > 30 /analyze soʻrov/daqiqa — `Retry-After` dan keyin |
| 502 | `AI_ERROR` | AI soʻrovni rad etdi |
| 503 | `AI_UNAVAILABLE` | AI band — 30–60 s dan keyin qayta |
| 503 | `GEMINI_NOT_CONFIGURED` | Server sozlanmagan — administrator |

Limitlar: 30 /analyze soʻrov/daqiqa/kompaniya; fayl 60 MB; audio 120 daqiqa; customFields 40 ta; script 20 000 belgi.

---

## 9. Hisob-kitob

- Davomiylik fayl sarlavhasidan aniqlanadi (AI ga yuborishdan oldin), har boshlangan daqiqa toʻliq daqiqa.
- Daqiqalik tarif: `daqiqa × narx` balansdan; Paket: N daqiqa limiti. Holat — `GET /account` yoki javobdagi `account`.
- Xato tahlil uchun yechilmaydi. Bir xil fayl ikki marta yuborilsa ikki marta yechiladi — avval `GET /analyses?externalId=` tekshiring.

---

## 10. Kod misollari

### Node.js 18+

```js
import fs from 'node:fs';

const fd = new FormData();
fd.append('audio', new Blob([fs.readFileSync('call.mp3')], { type: 'audio/mpeg' }), 'call.mp3');
fd.append('externalId', 'lead-10542');
fd.append('outputLanguage', 'ru');
fd.append('customFields', JSON.stringify([
  { key: 'budget', label: 'Byudjet', type: 'number' },
  { key: 'interested', label: 'Qiziqdi', type: 'boolean' },
]));

const res = await fetch('https://ai-coach.biznesim.uz/api/v1/analyze', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.SCI_TOKEN },
  body: fd,
  signal: AbortSignal.timeout(300_000),
});
const data = await res.json();
if (!res.ok) throw new Error(data.code + ': ' + data.error);
console.log(data.rating.score, data.customFields, data.result.coachingCard.tasks);
```

### Python 3

```python
import json, requests

r = requests.post(
    "https://ai-coach.biznesim.uz/api/v1/analyze",
    headers={"Authorization": "Bearer sci_..."},
    files={"audio": ("call.mp3", open("call.mp3", "rb"), "audio/mpeg")},
    data={"externalId": "lead-10542", "callDate": "2026-10-17",
          "customFields": json.dumps([{"key": "budget", "label": "Byudjet", "type": "number"}])},
    timeout=300,
)
data = r.json()
if r.status_code != 201:
    raise RuntimeError(f"{data.get('code')}: {data.get('error')}")
print(data["rating"]["score"], data["customFields"])
```

### PHP 8

```php
$ch = curl_init("https://ai-coach.biznesim.uz/api/v1/analyze");
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 300,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer sci_..."],
  CURLOPT_POSTFIELDS => [
    "audio" => new CURLFile("call.mp3", "audio/mpeg", "call.mp3"),
    "externalId" => "lead-10542",
    "customFields" => json_encode([["key" => "budget", "label" => "Byudjet", "type" => "number"]]),
  ],
]);
$data = json_decode(curl_exec($ch), true);
if (curl_getinfo($ch, CURLINFO_HTTP_CODE) !== 201) throw new Exception($data["code"] . ": " . $data["error"]);
echo $data["rating"]["score"];
```

---

## 11. Integratsiya maslahatlari

1. **Fon rejimida yuboring** — tahlil 30–120 s: qoʻngʻiroq tugagach navbatga qoʻying, javob kelgach kartochkani yangilang.
2. **externalId har doim yuboring** — takrorlashni oldini oladi, tahlilni CRM yozuvi bilan bogʻlaydi.
3. **Natijani oʻzingizda saqlang** (id, rating, customFields, tasks); toʻliq JSON keyin ham `GET /analyses/:id`.
4. **description** ga aniq koʻrsatma yozing; `select` variantlarini CRM qiymatlari bilan bir xil qiling.
5. **Xatolarni code boʻyicha ajrating:** 402 → toʻlov; 503 → 1 daqiqadan keyin qayta; boshqa 4xx → soʻrovni toʻgʻrilash.
6. **Audio:** mono 16 kHz+, mp3 64 kbps yetarli.
7. **tasks → CRM vazifalar:** title, description, deadline, priority tayyor; relatedTimestamp audioning kerakli joyiga havola.

---

## Oʻzgarishlar

- **1.1 (2026-10-24):** `rating` (10 ballik, mezonlar), `outputLanguage`, `source`, `uz-Cyrl`; kompaniya portali.
- **1.0 (2026-10-17):** birinchi versiya: analyze, account, analyses, custom fields, script.
