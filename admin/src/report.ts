import type { AnalysisFull, AnalysisResult, CoachingTask, Rating, ScriptAdherence } from './types';

// Builds a self-contained HTML report of one analysis (inline CSS, no external assets),
// so it can be saved, emailed or printed from any browser.

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PRIORITY_LABELS: Record<string, string> = { high: 'Yuqori', medium: 'Oʻrta', low: 'Past' };
const SENTIMENT_LABELS: Record<string, string> = { positive: 'Ijobiy', neutral: 'Neytral', negative: 'Salbiy' };
const STEP_LABELS: Record<string, string> = { done: 'Bajarildi', partial: 'Qisman', missed: 'Oʻtkazib yuborildi' };

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} soʻm`;
const scoreColor = (score: number) => (score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#e11d48');

const talkPct = (r: AnalysisResult) => {
  const cs = r.callSummary;
  let a = Number(cs.speakerA?.talkTimePercent) || 0;
  let b = Number(cs.speakerB?.talkTimePercent) || 0;
  if (a <= 0 && b <= 0) {
    a = Number(cs.talkRatio?.speakerA) || 0;
    b = Number(cs.talkRatio?.speakerB) || 0;
  }
  const total = a + b || 1;
  const pa = Math.round((a / total) * 100);
  return { a: pa, b: 100 - pa };
};

// Simple inline SVG line chart of the engagement timeline
const timelineSvg = (r: AnalysisResult) => {
  const points = r.sentimentTimeline || [];
  if (points.length < 2) return '';
  const w = 720;
  const h = 200;
  const padL = 36;
  const padB = 28;
  const padT = 12;
  const maxT = Math.max(...points.map((p) => p.timeSeconds), 1);
  const x = (t: number) => padL + (t / maxT) * (w - padL - 12);
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (h - padT - padB);
  const path = (key: 'speakerAEngagement' | 'speakerBEngagement') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.timeSeconds).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const grid = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<line x1="${padL}" x2="${w - 12}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0" stroke-width="1"/>` +
        `<text x="${padL - 6}" y="${y(v) + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${v}</text>`
    )
    .join('');
  const labels = points
    .filter((_, i) => i % Math.ceil(points.length / 8) === 0)
    .map((p) => `<text x="${x(p.timeSeconds)}" y="${h - 8}" font-size="10" fill="#94a3b8" text-anchor="middle">${esc(p.time)}</text>`)
    .join('');
  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block">
      ${grid}${labels}
      <path d="${path('speakerAEngagement')}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${path('speakerBEngagement')}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>
    <div class="legend"><span><i style="background:#4f46e5"></i>${esc(r.callSummary.speakerA.name)}</span><span><i style="background:#10b981"></i>${esc(r.callSummary.speakerB.name)}</span></div>`;
};

const taskCard = (t: CoachingTask, i: number) => `
  <div class="task">
    <div class="task-head">
      <span class="num">${i + 1}</span>
      <div class="task-title">
        <strong>${esc(t.title)}</strong>
        <div class="chips">
          <span class="chip prio-${esc(t.priority)}">${esc(PRIORITY_LABELS[t.priority] || t.priority)} muhimlik</span>
          ${t.category ? `<span class="chip">${esc(t.category)}</span>` : ''}
          ${t.deadline ? `<span class="chip">⏱ ${esc(t.deadline)}</span>` : ''}
          ${t.relatedTimestamp ? `<span class="chip mono">@${esc(t.relatedTimestamp)}</span>` : ''}
        </div>
      </div>
    </div>
    <p class="task-desc">${esc(t.description)}</p>
    ${t.why ? `<p class="task-why"><b>Nima uchun:</b> ${esc(t.why)}</p>` : ''}
    ${t.successCriteria ? `<p class="task-ok"><b>Bajarildi deb hisoblanadi:</b> ${esc(t.successCriteria)}</p>` : ''}
  </div>`;

const RATING_LABELS: Record<string, string> = { excellent: 'Aʼlo', good: 'Yaxshi', average: 'Oʻrtacha', weak: 'Zaif', poor: 'Yomon' };
const ratingColor = (s: number) => (s >= 9 ? '#059669' : s >= 7 ? '#0284c7' : s >= 5 ? '#d97706' : '#e11d48');

const ratingSection = (rating?: Rating) => {
  if (!rating) return '';
  return `
  <section>
    <h2>Baho: <span style="color:${ratingColor(rating.score)}">${rating.score.toFixed(1)} / 10</span> <span class="tag" style="background:#eef2ff;color:#3730a3">${esc(RATING_LABELS[rating.label] || rating.label)}</span>
      <span class="sub" style="font-weight:400">· ${rating.basis === 'script' ? 'sotuv skripti boʻyicha' : 'umumiy mezonlar boʻyicha'}</span></h2>
    ${rating.verdict ? `<p>${esc(rating.verdict)}</p>` : ''}
    <table><thead><tr><th>Mezon</th><th>Baho</th><th>Izoh</th></tr></thead><tbody>
      ${rating.criteria
        .map(
          (c) => `<tr><td><b>${esc(c.name)}</b>${c.required ? ' <span class="chip prio-high">majburiy</span>' : ''}</td>
            <td style="white-space:nowrap;color:${ratingColor(c.score)};font-weight:700">${c.score % 1 === 0 ? c.score : c.score.toFixed(1)} / 10</td>
            <td>${esc(c.comment)}</td></tr>`
        )
        .join('')}
    </tbody></table>
  </section>`;
};

const customFieldsSection = (fields: Record<string, unknown>) => {
  const entries = Object.entries(fields || {});
  if (!entries.length) return '';
  const fmt = (v: unknown) =>
    v === null || v === undefined ? '<i class="sub">null (audioda yoʻq)</i>' : Array.isArray(v) ? v.map((x) => `<span class="chip">${esc(x)}</span>`).join('') : typeof v === 'boolean' ? (v ? 'true' : 'false') : esc(v);
  return `
  <section>
    <h2>CRM fieldlar <span class="tag" style="background:#f5f3ff;color:#5b21b6">${entries.length} ta</span></h2>
    <table><thead><tr><th>Field</th><th>Qiymat</th></tr></thead><tbody>
      ${entries.map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td>${fmt(v)}</td></tr>`).join('')}
    </tbody></table>
  </section>`;
};

const scriptSection = (sa?: ScriptAdherence) => {
  if (!sa) return '';
  const counts = { done: 0, partial: 0, missed: 0 };
  sa.steps.forEach((s) => (counts[s.status] = (counts[s.status] || 0) + 1));
  return `
  <section>
    <h2>Sotuv skriptiga muvofiqlik <span class="tag" style="background:#eef2ff;color:#3730a3">${Math.round(sa.score)}%</span></h2>
    <div class="scriptbar"><i style="width:${Math.round(sa.score)}%;background:${scoreColor(sa.score)}"></i></div>
    <p class="sub" style="margin:4px 0 10px">${counts.done} bajarildi · ${counts.partial} qisman · ${counts.missed} oʻtkazib yuborildi</p>
    <p>${esc(sa.summary)}</p>
    ${sa.steps
      .map(
        (s, i) => `
      <div class="step step-${esc(s.status)}">
        <div class="step-head"><b>${i + 1}. ${esc(s.step)}</b>${s.required ? '<span class="chip prio-high">majburiy</span>' : ''}<span class="step-status">${esc(STEP_LABELS[s.status] || s.status)}${s.timestamp ? ` <span class="mono">@${esc(s.timestamp)}</span>` : ''}</span></div>
        ${s.evidence ? `<div class="quote">“${esc(s.evidence)}”</div>` : ''}
        <p>${esc(s.comment)}</p>
      </div>`
      )
      .join('')}
    ${
      sa.deviations?.length
        ? `<h3 class="h3">Skriptdan chetlashishlar</h3>${sa.deviations
            .map(
              (d) => `<div class="item missed"><p><b>${esc(d.whatHappened)}</b>${d.timestamp ? ` <span class="mono">@${esc(d.timestamp)}</span>` : ''}</p><p><b>Skript boʻyicha:</b> ${esc(d.scriptExpected)}</p>${d.impact ? `<p>${esc(d.impact)}</p>` : ''}</div>`
            )
            .join('')}`
        : ''
    }
    ${sa.recommendations?.length ? `<h3 class="h3">Tavsiyalar</h3><ol>${sa.recommendations.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${sa.script ? `<details style="margin-top:10px"><summary class="sub" style="cursor:pointer">Skript matni</summary><pre class="pre">${esc(sa.script)}</pre></details>` : ''}
  </section>`;
};

export function buildReportHtml(a: AnalysisFull): string {
  const r = a.result;
  if (!r) return `<!doctype html><html><body><p>Tahlil natijasi yoʻq (${esc(a.error || a.status)})</p></body></html>`;
  const s = r.callSummary;
  const c = r.coachingCard;
  const tasks = c.tasks || [];
  const title = s.title || a.title || 'Qoʻngʻiroq tahlili';
  const generated = formatDate(a.createdAt) || formatDate(new Date().toISOString());
  const talk = talkPct(r);
  const billing = a.billing?.type === 'per_minute' ? `${a.billing.billedMinutes} daqiqa · ${money(a.billing.cost)}` : a.billing ? `${a.billing.billedMinutes} daqiqa (paket)` : '';

  return `<!doctype html>
<html lang="${esc(r.language?.code || 'uz')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — qoʻngʻiroq tahlili</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; --indigo:#4f46e5; --green:#059669; --amber:#d97706; --rose:#e11d48; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .page { max-width:920px; margin:0 auto; padding:32px 20px 60px; }
  .hero { background:linear-gradient(135deg,#0f172a,#312e81 55%,#4c1d95); color:#fff; border-radius:20px; padding:28px 28px 24px; display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
  .hero h1 { margin:4px 0 6px; font-size:24px; line-height:1.25; }
  .hero .meta { font-size:12px; opacity:.8; }
  .hero .kicker { font-size:11px; letter-spacing:.12em; text-transform:uppercase; opacity:.75; font-weight:700; }
  .ring { width:112px; height:112px; border-radius:50%; display:grid; place-items:center; background:conic-gradient(#fff calc(var(--p)*1%), rgba(255,255,255,.18) 0); flex:none; }
  .ring > div { width:92px; height:92px; border-radius:50%; background:#1e1b4b; display:grid; place-items:center; text-align:center; }
  .ring b { font-size:30px; line-height:1; display:block; }
  .ring small { font-size:10px; opacity:.75; }
  .grade { background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.25); border-radius:12px; padding:10px 16px; text-align:center; }
  .grade b { font-size:26px; display:block; }
  .grade small { font-size:10px; text-transform:uppercase; letter-spacing:.1em; opacity:.8; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:16px 0; }
  .kpi { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
  .kpi small { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
  .kpi b { display:block; font-size:20px; margin-top:4px; }
  .kpi .sub, .sub { color:var(--muted); font-size:12px; }
  .bar, .scriptbar { height:10px; border-radius:999px; overflow:hidden; display:flex; background:#e2e8f0; margin:8px 0 6px; }
  .bar i, .scriptbar i { display:block; height:100%; }
  section { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 22px; margin-top:16px; }
  h2 { font-size:16px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
  .h3 { font-size:13px; margin:16px 0 6px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  h2 .tag { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:3px 8px; border-radius:999px; }
  .two { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media (max-width:640px) { .two { grid-template-columns:1fr; } }
  .note { border-radius:12px; padding:12px 14px; font-size:13px; }
  .note.good { background:#ecfdf5; border:1px solid #a7f3d0; }
  .note.risk { background:#fff1f2; border:1px solid #fecdd3; }
  .note.advice { background:#eef2ff; border:1px solid #c7d2fe; }
  .note b { display:block; margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  .item { border-radius:14px; padding:14px 16px; margin-top:10px; border:1px solid var(--line); }
  .item.well { background:#f0fdf4; border-color:#bbf7d0; }
  .item.missed { background:#fffbeb; border-color:#fde68a; }
  .item h3 { margin:0; font-size:14px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .num { width:22px; height:22px; border-radius:50%; display:inline-grid; place-items:center; color:#fff; font-size:11px; font-weight:700; flex:none; }
  .well .num { background:var(--green); } .missed .num { background:var(--amber); }
  .mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11px; }
  .quote { background:#fff; border-left:3px solid #cbd5e1; padding:8px 12px; margin:8px 0; font-style:italic; color:#334155; border-radius:0 8px 8px 0; }
  .item p, .step p { margin:6px 0; font-size:13px; }
  .script { background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; padding:10px 12px; margin-top:8px; }
  .script b { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#3730a3; display:block; margin-bottom:4px; }
  .chip { display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; background:#f1f5f9; color:#334155; border:1px solid var(--line); margin:2px 4px 0 0; }
  .prio-high { background:#fff1f2; color:#9f1239; border-color:#fecdd3; } .prio-medium { background:#fffbeb; color:#92400e; border-color:#fde68a; } .prio-low { background:#f0f9ff; color:#075985; border-color:#bae6fd; }
  .task { border:1px solid var(--line); border-radius:14px; padding:14px 16px; margin-top:10px; background:#fff; }
  .task-head { display:flex; gap:10px; align-items:flex-start; }
  .task .num { background:var(--indigo); margin-top:2px; }
  .task-title strong { font-size:14px; }
  .task p { margin:8px 0 0; font-size:13px; }
  .task-why { color:#475569; } .task-ok { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px; }
  .step { border:1px solid var(--line); border-radius:12px; padding:10px 14px; margin-top:8px; }
  .step-done { background:#f0fdf4; border-color:#bbf7d0; } .step-partial { background:#fffbeb; border-color:#fde68a; } .step-missed { background:#fff1f2; border-color:#fecdd3; }
  .step-head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:13px; }
  .step-status { margin-left:auto; font-size:11px; font-weight:700; color:#475569; }
  .pre { white-space:pre-wrap; font:12px/1.5 ui-monospace, Menlo, monospace; background:#f8fafc; border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .legend { display:flex; gap:16px; font-size:12px; color:var(--muted); margin-top:6px; } .legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:middle; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th, td { text-align:left; padding:8px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
  td.a { color:#3730a3; font-weight:700; white-space:nowrap; } td.b { color:#065f46; font-weight:700; white-space:nowrap; }
  .flag { font-size:10px; padding:1px 6px; border-radius:999px; margin-left:6px; } .flag.well { background:#dcfce7; color:#166534; } .flag.missed { background:#fef3c7; color:#92400e; }
  ol { padding-left:20px; margin:4px 0; } ol li { margin:4px 0; font-size:13px; }
  footer { color:var(--muted); font-size:11px; text-align:center; margin-top:28px; }
  @media print { body { background:#fff; } .page { padding:0; } section, .kpi, .task, .step { break-inside:avoid; } }
</style>
</head>
<body>
<div class="page">
  <div class="hero">
    <div class="ring" style="--p:${Number(s.overallScore) || 0}"><div><b>${esc(Math.round(s.overallScore))}</b><small>/ 100</small></div></div>
    <div style="flex:1;min-width:240px">
      <div class="kicker">Savdo qoʻngʻirogʻi · AI tahlili${a.companyName ? ` · ${esc(a.companyName)}` : ''}</div>
      <h1>${esc(title)}</h1>
      <div class="meta">${esc(s.speakerA.name)} (${esc(s.speakerA.role)}) ↔ ${esc(s.speakerB.name)} (${esc(s.speakerB.role)}) · ${esc(s.duration)} · ${esc(generated)}${a.fileName ? ` · ${esc(a.fileName)}` : ''}${a.externalId ? ` · CRM: ${esc(a.externalId)}` : ''}</div>
    </div>
    <div class="grade"><small>${r.rating ? 'Baho / 10' : 'Baho'}</small><b>${r.rating ? r.rating.score.toFixed(1) : esc(c.overallGrade || '—')}</b>${r.rating ? `<small>${esc(RATING_LABELS[r.rating.label] || '')}</small>` : ''}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><small>Natija</small><b style="font-size:14px;color:${scoreColor(s.overallScore)}">${esc(s.callOutcome)}</b></div>
    <div class="kpi"><small>Davomiylik</small><b>${esc(s.duration)}</b><span class="sub">${esc((s.speakerA.wordsSpoken || 0) + (s.speakerB.wordsSpoken || 0))} ta soʻz${billing ? ` · ${esc(billing)}` : ''}</span></div>
    ${a.scriptScore !== null && a.scriptScore !== undefined ? `<div class="kpi"><small>Skriptga muvofiqlik</small><b style="color:${scoreColor(a.scriptScore)}">${Math.round(a.scriptScore)}%</b></div>` : `<div class="kpi"><small>Topshiriqlar</small><b>${tasks.length}</b><span class="sub">menejer uchun</span></div>`}
    <div class="kpi" style="grid-column:span 2"><small>Gapirish nisbati</small>
      <div class="bar"><i style="width:${talk.a}%;background:#4f46e5"></i><i style="width:${talk.b}%;background:#10b981"></i></div>
      <span class="sub">${esc(s.speakerA.name)} ${talk.a}% · ${esc(s.speakerB.name)} ${talk.b}%</span></div>
  </div>

  <section>
    <h2>Xulosa</h2>
    <div class="two">
      <div class="note good"><b>Asosiy kuchli tomon</b>${esc(s.keyStrengthsSummary)}</div>
      <div class="note risk"><b>Bitim uchun asosiy xavf</b>${esc(s.primaryRiskSummary)}</div>
    </div>
    ${c.summaryAdvice ? `<div class="note advice" style="margin-top:12px"><b>Kouching xulosasi</b>${esc(c.summaryAdvice)}</div>` : ''}
  </section>

  ${ratingSection(r.rating)}
  ${customFieldsSection(a.customFields || r.customFields || {})}
  ${scriptSection(r.scriptAdherence)}

  <section>
    <h2>Topshiriqlar <span class="tag" style="background:#eef2ff;color:#3730a3">${tasks.length} ta</span></h2>
    ${tasks.length ? tasks.map(taskCard).join('') : '<p class="sub">Topshiriqlar yoʻq.</p>'}
  </section>

  <section>
    <h2>Yaxshi bajarilgan <span class="tag" style="background:#dcfce7;color:#166534">kuchli tomonlar</span></h2>
    ${(c.threeThingsDoneWell || [])
      .map(
        (it, i) => `
      <div class="item well">
        <h3><span class="num">${i + 1}</span>${esc(it.title)} <span class="chip">${esc(it.category)}</span> <span class="mono">@${esc(it.timestamp)}</span></h3>
        <div class="quote">“${esc(it.quote)}”</div>
        <p>${esc(it.analysis)}</p>
        ${it.impact ? `<p><b>Bitimga taʼsiri:</b> ${esc(it.impact)}</p>` : ''}
      </div>`
      )
      .join('')}
  </section>

  <section>
    <h2>Boy berilgan imkoniyatlar <span class="tag" style="background:#fef3c7;color:#92400e">eʼtibor kerak</span></h2>
    ${(c.threeMissedOpportunities || [])
      .map(
        (it, i) => `
      <div class="item missed">
        <h3><span class="num">${i + 1}</span>${esc(it.title)} <span class="chip">${esc(it.category)}</span> <span class="mono">@${esc(it.timestamp)}</span></h3>
        <div class="quote">“${esc(it.quote)}”</div>
        <p>${esc(it.analysis)}</p>
        <p><b>Tavsiya:</b> ${esc(it.recommendation)}</p>
        ${it.alternativeScript ? `<div class="script"><b>Buning oʻrniga shunday deng</b>“${esc(it.alternativeScript)}”</div>` : ''}
      </div>`
      )
      .join('')}
  </section>

  <section>
    <h2>Qiziqish dinamikasi</h2>
    ${timelineSvg(r) || '<p class="sub">Maʼlumot yoʻq.</p>'}
    ${
      (r.sentimentTimeline || []).some((p) => p.event)
        ? `<table style="margin-top:12px"><thead><tr><th>Vaqt</th><th>Bosqich</th><th>Voqea</th><th>Mijoz</th></tr></thead><tbody>${r.sentimentTimeline
            .filter((p) => p.event)
            .map((p) => `<tr><td class="mono">${esc(p.time)}</td><td>${esc(p.phase)}</td><td>${esc(p.event)}</td><td>${esc(p.speakerBEngagement)}%</td></tr>`)
            .join('')}</tbody></table>`
        : ''
    }
  </section>

  <section>
    <h2>Transkript <span class="tag" style="background:#f1f5f9;color:#334155">${(r.transcript || []).length} ta replika</span></h2>
    <table>
      <thead><tr><th>Vaqt</th><th>Soʻzlovchi</th><th>Matn</th><th>Kayfiyat</th></tr></thead>
      <tbody>
      ${(r.transcript || [])
        .map(
          (t) => `<tr>
          <td class="mono">${esc(t.timestamp)}</td>
          <td class="${t.speaker === 'Speaker A' ? 'a' : 'b'}">${esc(t.speakerName)}</td>
          <td>${esc(t.text)}${t.coachingFlag ? `<span class="flag ${esc(t.coachingFlag)}">${t.coachingFlag === 'well' ? 'yaxshi' : 'boy berildi'}</span>` : ''}${t.keyMoment ? `<div class="sub" style="font-size:11px">★ ${esc(t.keyMoment)}</div>` : ''}</td>
          <td>${esc(SENTIMENT_LABELS[t.sentiment] || t.sentiment)} · ${esc(t.engagementScore)}%</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>
  </section>

  <footer>Sales Coaching Platform · Gemini tahlili asosida avtomatik tuzilgan hisobot · ${esc(generated)} · ${esc(a.id)}</footer>
</div>
</body>
</html>`;
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').slice(0, 80) || 'hisobot';

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const baseName = (a: AnalysisFull) => `${(a.createdAt || new Date().toISOString()).slice(0, 10)}_${safeFileName(a.title || a.fileName || a.id)}`;

/** Downloads the analysis as a standalone .html report */
export function downloadReportHtml(a: AnalysisFull) {
  triggerDownload(new Blob([buildReportHtml(a)], { type: 'text/html;charset=utf-8' }), `${baseName(a)}.html`);
}

/** Downloads the raw analysis JSON (what the CRM receives) */
export function downloadJson(a: AnalysisFull) {
  const { account: _account, ...rest } = a as AnalysisFull & { account?: unknown };
  triggerDownload(new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json;charset=utf-8' }), `${baseName(a)}.json`);
}
