import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Braces, ThumbsUp, AlertTriangle, ListChecks, MessageSquareText, Clock, Flag, Target, FileText, CheckCircle2, MinusCircle, XCircle, Sparkles, Eye, Star } from 'lucide-react';
import { api, portal } from '../api';
import { downloadJson, downloadReportHtml } from '../report';
import type { AnalysisFull } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, RATING_LABEL, ScoreRing, Spinner, StatusBadge, Table, Td, cx, fmtDate, fmtDuration, fmtMoney, fmtNum, ratingColor, ratingTone } from '../components/ui';

const PRIO: Record<string, { label: string; tone: 'red' | 'amber' | 'sky' }> = {
  high: { label: 'Yuqori', tone: 'red' },
  medium: { label: 'Oʻrta', tone: 'amber' },
  low: { label: 'Past', tone: 'sky' },
};

export default function AnalysisDetail({ portal: isPortal = false }: { portal?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<AnalysisFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [tab, setTab] = useState<'coaching' | 'transcript'>('coaching');

  useEffect(() => {
    (isPortal ? portal.analysis(id) : api.analysis(id)).then(setA).catch((e) => setError(e.message));
  }, [id, isPortal]);

  if (error) return <ErrorBox error={error} />;
  if (!a) return <Spinner />;
  const r = a.result;

  const remove = async () => {
    if (!confirm('Tahlilni oʻchirasizmi? (Hisobdan yechilgan summa qaytarilmaydi)')) return;
    await api.deleteAnalysis(a.id);
    navigate(-1);
  };

  const cfEntries = Object.entries(a.customFields || {});

  return (
    <>
      <PageHeader
        back={
          <Link to={isPortal ? '/portal/analyses' : `/companies/${a.companyId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> {isPortal ? 'Tahlillar' : a.companyName}
          </Link>
        }
        title={a.title || a.fileName || a.id}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            <span>{fmtDate(a.createdAt)}</span>
            <span className="font-mono text-xs">{a.id}</span>
            {a.externalId && <Badge tone="indigo">CRM: {a.externalId}</Badge>}
            {r?.language && <Badge tone="violet">{r.language.language}</Badge>}
            {r?.source === 'admin' && <Badge tone="sky">Admin paneldan</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" icon={<Eye className="w-4 h-4" />} onClick={() => setShowJson((v) => !v)} title="JSON'ni shu yerda koʻrish">
              {showJson ? 'Yopish' : 'Koʻrish'}
            </Button>
            <Button variant="secondary" icon={<Braces className="w-4 h-4" />} onClick={() => downloadJson(a)} title="JSON faylini yuklab olish">
              JSON
            </Button>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={() => downloadReportHtml(a)} title="HTML hisobotni yuklab olish">
              HTML yuklab olish
            </Button>
            {!isPortal && <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove} />}
          </>
        }
      />

      {a.status === 'failed' && (
        <Card className="mb-6 border-rose-200">
          <div className="flex items-start gap-3 text-sm text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <div className="font-bold">Tahlil amalga oshmadi (hisobdan yechilmadi)</div>
              <div className="text-xs mt-1 font-mono">{a.error}</div>
            </div>
          </div>
        </Card>
      )}

      {showJson && (
        <Card className="mb-6" title="Toʻliq JSON (CRM shu koʻrinishda oladi)" padded={false}>
          <pre className="p-4 text-[11px] font-mono bg-slate-950 text-slate-100 rounded-b-2xl overflow-auto thin-scroll max-h-[70vh]">{JSON.stringify(a, null, 2)}</pre>
        </Card>
      )}

      {r && (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-6 md:p-8 mb-6 fade-up ring-1 ring-white/10">
            {/* ambient glow */}
            <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-indigo-600/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
            <div className="pointer-events-none absolute top-10 right-1/3 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* rating + outcome */}
              <div className="lg:col-span-7 min-w-0 flex items-start gap-5">
                {r.rating ? (
                  <div
                    className="shrink-0 w-24 h-24 rounded-2xl flex flex-col items-center justify-center border"
                    style={{ borderColor: `${ratingColor(r.rating.score)}66`, background: `${ratingColor(r.rating.score)}1a`, boxShadow: `0 0 32px ${ratingColor(r.rating.score)}33` }}
                  >
                    <div className="text-4xl font-extrabold leading-none" style={{ color: ratingColor(r.rating.score) }}>
                      {r.rating.score.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-300 mt-1">/ 10</div>
                  </div>
                ) : (
                  <ScoreRing score={r.callSummary.overallScore} size={96} dark />
                )}
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
                    <Sparkles className="w-3 h-3" /> AI bahosi · {r.rating?.basis === 'script' ? 'sotuv skripti boʻyicha' : 'umumiy mezonlar boʻyicha'}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    {r.rating ? (
                      <>
                        <span className="text-2xl font-extrabold tracking-tight">{RATING_LABEL[r.rating.label] || r.rating.label}</span>
                        <span className="ml-1 px-2 py-0.5 rounded-md bg-white/10 text-xs font-bold text-indigo-200">
                          {Math.round(r.callSummary.overallScore)} / 100 · {r.coachingCard.overallGrade}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold tracking-tight">{Math.round(r.callSummary.overallScore)}</span>
                        <span className="text-sm text-slate-400">/ 100</span>
                        <span className="ml-1 px-2 py-0.5 rounded-md bg-white/10 text-sm font-bold text-indigo-200">{r.coachingCard.overallGrade}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{r.rating?.verdict || r.callSummary.callOutcome}</p>
                  {r.rating?.verdict && <p className="mt-1 text-xs text-slate-400">{r.callSummary.callOutcome}</p>}
                </div>
              </div>

              {/* KPIs */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3 content-start">
                <Kpi label="Davomiylik" value={fmtDuration(a.durationSeconds)} hint={`${r.transcript.length} ta replika`} />
                <Kpi
                  label="Hisob"
                  value={a.billing.type === 'per_minute' ? fmtMoney(a.billing.cost) : `${a.billing.billedMinutes} daq`}
                  hint={a.billing.type === 'package' ? 'paketdan yechildi' : `${a.billing.billedMinutes} daqiqa`}
                />
                <Kpi
                  label="Gapirish nisbati"
                  value={`${talkPct(r, 'A')}% · ${talkPct(r, 'B')}%`}
                  hint={`${r.callSummary.speakerA.name} · ${r.callSummary.speakerB.name}`}
                />
                {isPortal ? (
                  <Kpi label="Skript" value={a.scriptScore === null || a.scriptScore === undefined ? '—' : `${Math.round(a.scriptScore)}%`} hint={a.scriptScore === null ? 'skriptsiz tahlil' : 'skriptga muvofiqlik'} />
                ) : (
                  <Kpi
                    label="Gemini tannarxi"
                    value={a.ai?.costUsd ? `$${a.ai.costUsd.toFixed(3)}` : '—'}
                    hint={a.ai ? `${fmtNum(a.ai.inputTokens + a.ai.outputTokens + a.ai.thoughtTokens)} token · ${Math.round(a.processingMs / 1000)} s` : undefined}
                  />
                )}
              </div>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur p-4 text-xs">
                <div className="font-bold text-emerald-300 mb-1.5 inline-flex items-center gap-1.5">
                  <ThumbsUp className="w-3.5 h-3.5" /> Kuchli tomon
                </div>
                <div className="text-slate-200 leading-relaxed">{r.callSummary.keyStrengthsSummary}</div>
              </div>
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur p-4 text-xs">
                <div className="font-bold text-rose-300 mb-1.5 inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Asosiy xavf
                </div>
                <div className="text-slate-200 leading-relaxed">{r.callSummary.primaryRiskSummary}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
            <Card
              title={
                <span className="inline-flex items-center gap-2">
                  <Braces className="w-4 h-4 text-violet-600" /> CRM fieldlar
                </span>
              }
              padded={false}
            >
              {cfEntries.length === 0 ? (
                <Empty text="Bu tahlil uchun custom field soʻralmagan" />
              ) : (
                <Table head={['Field', 'Qiymat']}>
                  {cfEntries.map(([k, v]) => (
                    <tr key={k}>
                      <Td mono className="text-slate-600">
                        {k}
                      </Td>
                      <Td className="text-sm">
                        {v === null || v === undefined ? (
                          <span className="text-slate-400 italic">null (audioda yoʻq)</span>
                        ) : typeof v === 'boolean' ? (
                          <Badge tone={v ? 'green' : 'red'}>{v ? 'true' : 'false'}</Badge>
                        ) : Array.isArray(v) ? (
                          <div className="flex flex-wrap gap-1">
                            {v.map((x, i) => (
                              <Badge key={i}>{String(x)}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="font-semibold">{String(v)}</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <Card
              className="lg:col-span-2"
              title={
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-600" /> Topshiriqlar ({r.coachingCard.tasks?.length || 0})
                </span>
              }
            >
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                <strong>Kouch xulosasi:</strong> {r.coachingCard.summaryAdvice}
              </div>
              <div className="space-y-2">
                {(r.coachingCard.tasks || []).map((t, i) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-slate-900">
                        <span className="text-slate-400 font-mono text-[10px] mr-1.5">#{i + 1}</span>
                        {t.title}
                      </div>
                      <Badge tone={PRIO[t.priority]?.tone || 'slate'}>{PRIO[t.priority]?.label || t.priority}</Badge>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{t.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.deadline}
                      </span>
                      <span>{t.category}</span>
                      {t.relatedTimestamp && <span className="font-mono text-indigo-700">@{t.relatedTimestamp}</span>}
                    </div>
                    {(t.why || t.successCriteria) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-[11px]">
                        {t.why && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 flex gap-1.5">
                            <Flag className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" /> {t.why}
                          </div>
                        )}
                        {t.successCriteria && (
                          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 flex gap-1.5 text-emerald-900">
                            <Target className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" /> {t.successCriteria}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {r.rating && r.rating.criteria.length > 0 && (
            <Card
              className="mb-6"
              title={
                <span className="inline-flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Baholash mezonlari ({r.rating.basis === 'script' ? 'skript bosqichlari' : 'standart'})
                </span>
              }
              padded={false}
            >
              <div className="divide-y divide-slate-100">
                {r.rating.criteria.map((c, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-4">
                    <div className="w-12 shrink-0 text-right">
                      <span className="text-lg font-extrabold" style={{ color: ratingColor(c.score) }}>
                        {c.score % 1 === 0 ? c.score : c.score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400">/10</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{c.name}</span>
                        {c.required && <Badge tone="red">majburiy</Badge>}
                        <Badge tone={ratingTone(c.score)}>{c.score >= 9 ? 'aʼlo' : c.score >= 7 ? 'yaxshi' : c.score >= 5 ? 'oʻrtacha' : 'zaif'}</Badge>
                      </div>
                      <div className="h-1.5 w-full max-w-xs bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.score * 10}%`, background: ratingColor(c.score) }} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">{c.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {r.scriptAdherence && <ScriptAdherenceCard sa={r.scriptAdherence} />}

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 w-fit">
            {(['coaching', 'transcript'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx('px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer', tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600')}>
                {t === 'coaching' ? 'Kouching kartasi' : `Transkript (${r.transcript.length})`}
              </button>
            ))}
          </div>

          {tab === 'coaching' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card
                title={
                  <span className="inline-flex items-center gap-2 text-emerald-700">
                    <ThumbsUp className="w-4 h-4" /> Yaxshi bajarilgan
                  </span>
                }
              >
                <div className="space-y-3">
                  {r.coachingCard.threeThingsDoneWell.map((w) => (
                    <div key={w.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900">{w.title}</div>
                        <span className="font-mono text-slate-500">{w.timestamp}</span>
                      </div>
                      <div className="italic text-slate-600 mt-1">«{w.quote}»</div>
                      <div className="mt-1.5 text-slate-700">{w.analysis}</div>
                      <div className="mt-1.5 text-emerald-900">
                        <strong>Taʼsiri:</strong> {w.impact}
                      </div>
                      <Badge className="mt-2" tone="green">
                        {w.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
              <Card
                title={
                  <span className="inline-flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="w-4 h-4" /> Boy berilgan imkoniyatlar
                  </span>
                }
              >
                <div className="space-y-3">
                  {r.coachingCard.threeMissedOpportunities.map((m) => (
                    <div key={m.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900">{m.title}</div>
                        <span className="font-mono text-slate-500">{m.timestamp}</span>
                      </div>
                      <div className="italic text-slate-600 mt-1">«{m.quote}»</div>
                      <div className="mt-1.5 text-slate-700">{m.analysis}</div>
                      <div className="mt-1.5">
                        <strong>Tavsiya:</strong> {m.recommendation}
                      </div>
                      <div className="mt-1.5 rounded-lg bg-white border border-rose-200 px-2.5 py-1.5 text-slate-800">
                        <strong>Aytish kerak edi:</strong> «{m.alternativeScript}»
                      </div>
                      <Badge className="mt-2" tone="red">
                        {m.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <Card
              title={
                <span className="inline-flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-slate-600" /> Transkript
                </span>
              }
              padded={false}
            >
              <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto thin-scroll">
                {r.transcript.map((s) => (
                  <div key={s.id} className={cx('px-5 py-3 flex gap-3 text-sm', s.speaker === 'Speaker A' ? '' : 'bg-slate-50/60')}>
                    <div className="w-12 shrink-0 font-mono text-[11px] text-slate-400 pt-0.5">{s.timestamp}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className={cx('text-xs font-bold', s.speaker === 'Speaker A' ? 'text-indigo-700' : 'text-slate-800')}>{s.speakerName}</span>
                        <span className="text-[10px] text-slate-400">{s.role}</span>
                        <span className={cx('w-1.5 h-1.5 rounded-full', s.sentiment === 'positive' ? 'bg-emerald-500' : s.sentiment === 'negative' ? 'bg-rose-500' : 'bg-slate-300')} />
                        {s.keyMoment && <Badge tone="indigo">{s.keyMoment}</Badge>}
                        {s.coachingFlag && <Badge tone={s.coachingFlag === 'well' ? 'green' : 'red'}>{s.coachingFlag === 'well' ? 'Yaxshi' : 'Boy berildi'}</Badge>}
                      </div>
                      <div className="text-slate-800">{s.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}

// The model sometimes returns the talk ratio as a 0..1 fraction; fall back to the per-speaker talk time
const talkPct = (r: import('../types').AnalysisResult, who: 'A' | 'B') => {
  const cs = r.callSummary;
  const ta = Number(cs.speakerA?.talkTimePercent) || 0;
  const tb = Number(cs.speakerB?.talkTimePercent) || 0;
  let a = ta;
  let b = tb;
  if (a <= 0 && b <= 0) {
    // older results: talkRatio came back as a ratio such as 1.38 : 1
    a = Number(cs.talkRatio?.speakerA) || 0;
    b = Number(cs.talkRatio?.speakerB) || 0;
  }
  const total = a + b || 1;
  return Math.round(((who === 'A' ? a : b) / total) * 100);
};

const STEP_META = {
  done: { label: 'Bajarildi', icon: CheckCircle2, cls: 'text-emerald-600', row: 'border-emerald-200 bg-emerald-50/40' },
  partial: { label: 'Qisman', icon: MinusCircle, cls: 'text-amber-600', row: 'border-amber-200 bg-amber-50/40' },
  missed: { label: 'Oʻtkazib yuborildi', icon: XCircle, cls: 'text-rose-600', row: 'border-rose-200 bg-rose-50/40' },
} as const;

const ScriptAdherenceCard: React.FC<{ sa: NonNullable<import('../types').AnalysisResult['scriptAdherence']> }> = ({ sa }) => {
  const [showScript, setShowScript] = useState(false);
  const counts = { done: 0, partial: 0, missed: 0 };
  sa.steps.forEach((s) => (counts[s.status] = (counts[s.status] || 0) + 1));
  return (
    <Card
      className="mb-6"
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" /> Sotuv skriptiga muvofiqlik
        </span>
      }
      actions={
        sa.script ? (
          <button onClick={() => setShowScript((v) => !v)} className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer">
            {showScript ? 'Skriptni yashirish' : 'Skriptni koʻrish'}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col md:flex-row gap-5">
        <div className="flex items-center gap-4 md:w-72 shrink-0">
          <ScoreRing score={sa.score} size={76} />
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{Math.round(sa.score)}%</div>
            <div className="text-[11px] text-slate-500">skriptga amal qilindi</div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge tone="green">{counts.done} bajarildi</Badge>
              <Badge tone="amber">{counts.partial} qisman</Badge>
              <Badge tone="red">{counts.missed} oʻtkazib</Badge>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-700 flex-1">{sa.summary}</p>
      </div>

      {showScript && sa.script && (
        <pre className="mt-4 whitespace-pre-wrap text-[11.5px] font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto thin-scroll text-slate-700">{sa.script}</pre>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Bosqichlar</div>
          {sa.steps.map((s, i) => {
            const m = STEP_META[s.status] || STEP_META.partial;
            const Icon = m.icon;
            return (
              <div key={s.id || i} className={cx('rounded-xl border p-3 text-xs', m.row)}>
                <div className="flex items-start gap-2">
                  <Icon className={cx('w-4 h-4 shrink-0 mt-0.5', m.cls)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="font-bold text-slate-900">
                        {i + 1}. {s.step}
                        {s.required && <span className="ml-1 text-[10px] text-rose-700 font-bold">majburiy</span>}
                      </div>
                      <span className={cx('text-[10px] font-bold', m.cls)}>
                        {m.label}
                        {s.timestamp && <span className="font-mono text-slate-500 ml-1">@{s.timestamp}</span>}
                      </span>
                    </div>
                    {s.evidence && <div className="italic text-slate-600 mt-1">«{s.evidence}»</div>}
                    <div className="text-slate-700 mt-1">{s.comment}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-4">
          {sa.deviations.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Skriptdan chetlashishlar</div>
              <div className="space-y-2">
                {sa.deviations.map((d, i) => (
                  <div key={i} className="rounded-xl border border-rose-200 bg-white p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <div className="font-semibold text-slate-900">{d.whatHappened}</div>
                      {d.timestamp && <span className="font-mono text-slate-500">{d.timestamp}</span>}
                    </div>
                    <div className="mt-1 text-slate-700">
                      <strong>Skript boʻyicha:</strong> {d.scriptExpected}
                    </div>
                    {d.impact && <div className="mt-1 text-rose-800">{d.impact}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {sa.recommendations.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Tavsiyalar</div>
              <ul className="space-y-1.5 text-xs text-slate-800">
                {sa.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-indigo-500 font-bold">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const Kpi = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur px-4 py-3">
    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">{label}</div>
    <div className="text-lg font-extrabold mt-0.5 truncate">{value}</div>
    {hint && (
      <div className="text-[11px] text-slate-400 truncate" title={hint}>
        {hint}
      </div>
    )}
  </div>
);
