# Sales Coaching Platform

CRM tizimlari uchun qoʻngʻiroq tahlili xizmati: admin panel + token asosidagi API.

- **Admin panel** (`admin/`): kompaniyalar, API tokenlar, tariflar (daqiqalik / paket), balans, hisobotlar, CRM custom fieldlar, Gemini kaliti.
- **API** (`server/`): CRM audio yuboradi → davomiylik va tarif limiti tekshiriladi → Gemini tahlil qiladi → JSON qaytadi (transkript, ball, kouching kartasi, SMART topshiriqlar, CRM fieldlari).
- Har kompaniya uchun **davlat** tanlanadi: audio shu davlat tilida deb olinadi va natija matnlari shu tilda qaytadi.

## Ishga tushirish

```bash
# 1. Server
cd server
cp .env.example .env        # ADMIN_PASSWORD, JWT_SECRET ni oʻzgartiring
npm install
npm run dev                 # http://localhost:4000

# 2. Admin panel (dev)
cd ../admin
npm install
npm run dev                 # http://localhost:3003  (API /api → 4000 ga proxy)
```

Gemini kalitini admin panel → **Sozlamalar** boʻlimida kiriting (yoki `.env` dagi `GEMINI_API_KEY` zaxira sifatida ishlatiladi).

### Production (Docker)

```bash
cp .env.example .env               # ADMIN_PASSWORD, JWT_SECRET, GEMINI_API_KEY
docker compose up -d --build       # 127.0.0.1:4010 → admin panel + /api, baza ./data/
```

Prod: `ai-coach.biznesim.uz` (server 31.40.29.195, `/opt/ai-coach`), nginx vhost `deploy/nginx-ai-coach.conf`, yangilash `deploy/deploy.sh` (git pull + build + up).

Dockersiz: `cd admin && npm run build`, keyin `cd ../server && NODE_ENV=production npm start` (admin/dist ni ham shu port'dan beradi).

Maʼlumotlar `server/data/platform.sqlite` (Node 24 ichki SQLite, qoʻshimcha oʻrnatish shart emas).

## Kompaniya ochish oqimi

1. Admin kompaniya qoʻshadi va tarif/paketni tanlaydi. Kompaniya **Toʻlov kutilmoqda** (`pending`) holatida yaratiladi, API tokenlari 403 `COMPANY_PENDING` qaytaradi.
2. Kompaniya pul toʻlagach admin kompaniya sahifasidagi sariq kartada summani kiritib **Toʻlovni tasdiqlash va ochish** tugmasini bosadi: paket shu kundan boshlanadi (muddat shu kundan hisoblanadi), kompaniya `active` boʻladi. Daqiqalik tarifda kiritilgan summa balansga tushadi.
3. Keyingi paketlar "Tarif va balans" boʻlimida: toʻlangan boʻlsa darhol ochiladi, aks holda "Toʻlov kutish" bilan biriktirilib keyin tasdiqlanadi.
4. Barcha toʻlovlar **Toʻlovlar** sahifasida: roʻyxat (kompaniya/davr/tur boʻyicha filtr), qoʻshish, tahrirlash, oʻchirish. Balans toʻldirish summasi oʻzgarsa balans ham oʻzgaradi; paket toʻlovi oʻzgarsa obunadagi narx ham yangilanadi.

## Sotuv skripti va admin paneldan tahlil

- Har kompaniyaga **Sotuv skripti** (kompaniya sahifasi → "Sotuv skripti" tab, yoki CRM `PUT /api/v1/script`). Skript boʻlsa AI har qoʻngʻiroqni bosqichma-bosqich skript bilan solishtiradi: `result.scriptAdherence` (score 0–100, steps done/partial/missed, deviations, recommendations), roʻyxatlarda `scriptScore`.
- Soʻrovdagi `script` maydoni shu qoʻngʻiroq uchun ustun; boʻsh satr yuborilsa skriptsiz tahlil.
- Admin kompaniya sahifasi → "Tahlillar" tabida audio yuklab tahlil qila oladi (`POST /api/admin/companies/:id/analyze`); hisob API soʻrovi kabi yechiladi, natijada `source: "admin"`.

## Billing qoidasi

- Davomiylik fayl sarlavhasidan aniqlanadi (`music-metadata`); har boshlangan daqiqa toʻliq daqiqa.
- **Daqiqalik tarif**: `daqiqa × narx` oldindan toʻldirilgan balansdan yechiladi (402 `INSUFFICIENT_BALANCE`).
- **Paket**: `N daqiqa` limiti, ixtiyoriy amal muddati; tugasa 402 `LIMIT_EXCEEDED`. Paketlar navbat bilan ishlatiladi.
- Xato boʻlgan tahlil uchun hech narsa yechilmaydi.
- Har tahlilda Gemini token sarfi va tannarxi ($) saqlanadi; narxlar va USD kursi Sozlamalar'da.

## CRM API (qisqa)

```
POST /api/v1/analyze            multipart: audio, externalId?, customFields?(JSON), callDate?, notes?
GET  /api/v1/account
GET  /api/v1/analyses?externalId=
GET  /api/v1/analyses/:id
Authorization: Bearer sci_...
```

Toʻliq hujjat admin paneldagi **API hujjatlari** sahifasida (curl va Node misollari, xato kodlari, field turlari).

## Tuzilma

```
server/src
  gemini/        client (retry + fallback modellar), prompts (tilga bogʻliq), schema (custom fieldlar bilan)
  services/      billing, analysis (pipeline), customFields (validatsiya/koersiya), settings
  routes/admin   auth, companies, plans, analyses, settings, stats
  routes/v1      CRM API
admin/src/pages  Dashboard, Companies, CompanyDetail (hisobot/tarif/token/fieldlar/tahlillar), Analyses, AnalysisDetail, Plans, Settings, Docs
```
