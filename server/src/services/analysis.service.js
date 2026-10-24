import { parseBuffer } from 'music-metadata';
import { q, tx } from '../db.js';
import { newId, nowIso } from '../util/ids.js';
import { HttpError } from '../middleware/errors.js';
import { generateContent } from '../gemini/client.js';
import { buildSystemInstruction, buildAnalysisPrompt } from '../gemini/prompts.js';
import { buildAnalysisSchema } from '../gemini/schema.js';
import { checkAllowance, charge } from './billing.service.js';
import { getMaxAudioSeconds, estimateAiCostUsd } from './settings.service.js';
import { normalizeFieldDefs, mergeFieldDefs, coerceFieldValues } from './customFields.js';
import { findCountry, DEFAULT_COUNTRY, findLanguage } from '../util/countries.js';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const AUDIO_MIME_RE = /^(audio\/|video\/(mp4|webm|ogg|quicktime))/;
const EXT_MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  amr: 'audio/amr',
  aiff: 'audio/aiff',
  wma: 'audio/x-ms-wma',
};

export const guessMime = (fileName, declared) => {
  if (declared && AUDIO_MIME_RE.test(declared)) return declared.split(';')[0];
  const ext = String(fileName || '').split('.').pop()?.toLowerCase();
  return EXT_MIME[ext] || 'audio/mpeg';
};

/** Duration from the file header (null when the container is unknown) */
export async function probeDuration(buffer, mimeType) {
  try {
    const meta = await parseBuffer(buffer, { mimeType }, { duration: true });
    const d = meta.format.duration;
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

function normalizeTasks(card) {
  if (!card) return;
  let tasks = Array.isArray(card.tasks) ? card.tasks : [];
  if (tasks.length === 0 && Array.isArray(card.nextActionItems)) {
    tasks = card.nextActionItems.map((text, i) => ({
      id: `task-${i + 1}`,
      title: text,
      description: text,
      why: '',
      priority: 'medium',
      deadline: '',
      category: '',
      successCriteria: '',
    }));
  }
  card.tasks = tasks
    .map((t, i) => ({ ...t, id: t.id || `task-${i + 1}`, status: 'todo' }))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
}

/** talkRatio is documented as percentages; the model sometimes returns a ratio (1.38 : 1) or a fraction */
function normalizeTalkRatio(cs) {
  if (!cs) return;
  let a = Number(cs.speakerA?.talkTimePercent) || 0;
  let b = Number(cs.speakerB?.talkTimePercent) || 0;
  if (a <= 0 && b <= 0) {
    a = Number(cs.talkRatio?.speakerA) || 0;
    b = Number(cs.talkRatio?.speakerB) || 0;
  }
  const total = a + b || 1;
  const pa = Math.round((a / total) * 1000) / 10;
  cs.talkRatio = { speakerA: pa, speakerB: Math.round((100 - pa) * 10) / 10 };
  if (cs.speakerA && !(Number(cs.speakerA.talkTimePercent) > 0)) cs.speakerA.talkTimePercent = cs.talkRatio.speakerA;
  if (cs.speakerB && !(Number(cs.speakerB.talkTimePercent) > 0)) cs.speakerB.talkTimePercent = cs.talkRatio.speakerB;
}

/** Short rating view for lists and the top level of the API response */
function ratingSummary(row) {
  if (row.rating_score === null || row.rating_score === undefined) return null;
  const score = Number(row.rating_score);
  return { scale: 10, score, basis: row.script_score !== null && row.script_score !== undefined ? 'script' : 'general', label: ratingLabel(score) };
}

const ratingLabel = (s) => (s >= 9 ? 'excellent' : s >= 7 ? 'good' : s >= 5 ? 'average' : s >= 3 ? 'weak' : 'poor');

/** Clamps criteria, recomputes the overall score as a weighted mean (mandatory criteria ×2) */
function normalizeRating(parsed, withScript) {
  const r = parsed.rating && typeof parsed.rating === 'object' ? parsed.rating : { score: 0, verdict: '', criteria: [] };
  const criteria = (Array.isArray(r.criteria) ? r.criteria : []).map((c) => ({
    name: String(c.name || ''),
    score: Math.max(0, Math.min(10, Number(c.score) || 0)),
    required: !!c.required,
    comment: String(c.comment || ''),
  }));
  let score = Math.max(0, Math.min(10, Number(r.score) || 0));
  if (criteria.length) {
    const wsum = criteria.reduce((a, c) => a + (c.required ? 2 : 1), 0);
    score = criteria.reduce((a, c) => a + c.score * (c.required ? 2 : 1), 0) / wsum;
  }
  score = Math.round(score * 10) / 10;
  parsed.rating = { scale: 10, score, basis: withScript ? 'script' : 'general', label: ratingLabel(score), verdict: String(r.verdict || ''), criteria };
  return score;
}

export const rowToApi = (row, { full = true } = {}) => {
  const base = {
    id: row.id,
    externalId: row.external_id || null,
    status: row.status,
    createdAt: row.created_at,
    fileName: row.file_name,
    title: row.title,
    overallScore: row.overall_score,
    overallGrade: row.overall_grade,
    durationSeconds: row.duration_seconds,
    billing: { billedMinutes: row.billed_seconds / 60, cost: row.cost, type: row.billing_type || null },
    customFields: safeJson(row.custom_fields, {}),
    model: row.model || null,
    processingMs: row.processing_ms,
    scriptScore: row.script_score ?? null,
    rating: ratingSummary(row),
    ai: {
      inputTokens: row.input_tokens || 0,
      outputTokens: row.output_tokens || 0,
      thoughtTokens: row.thought_tokens || 0,
      costUsd: row.ai_cost_usd || 0,
    },
    error: row.error || null,
  };
  if (full) base.result = safeJson(row.result, null);
  return base;
};

const safeJson = (s, fallback) => {
  if (s === null || s === undefined) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

/**
 * Full pipeline for one CRM request: validate → duration → allowance → Gemini → store + charge.
 * @param {object} p
 * @param {object} p.company
 * @param {object} [p.token]
 * @param {Buffer} p.buffer
 * @param {string} p.fileName
 * @param {string} [p.mimeType]
 * @param {string} [p.externalId]
 * @param {Array|string} [p.customFields] - field definitions for this request
 * @param {object} [p.context] - { callDate, notes }
 * @param {string} [p.script] - sales script for this call (defaults to the company script)
 * @param {string} [p.source] - 'api' | 'admin'
 * @param {string} [p.outputLanguage] - language code for the result texts (defaults to the company setting, then the country language)
 */
export async function analyzeForCompany(p) {
  const startedAt = Date.now();
  const { company, token, buffer, fileName, externalId = '', context = {} } = p;
  if (!buffer || !buffer.length) throw new HttpError(400, 'Audio fayl yuborilmadi', { code: 'NO_AUDIO' });

  const mimeType = guessMime(fileName, p.mimeType);
  const country = findCountry(company.country) || findCountry(DEFAULT_COUNTRY);

  const companyDefs = normalizeFieldDefs(company.custom_fields, 'company.customFields');
  const requestDefs = normalizeFieldDefs(p.customFields, 'customFields');
  const fieldDefs = mergeFieldDefs(companyDefs, requestDefs);

  // Duration before paying Gemini: enforce the plan limit and the max length
  const probed = await probeDuration(buffer, mimeType);
  const maxSeconds = getMaxAudioSeconds();
  if (probed && probed > maxSeconds) {
    throw new HttpError(422, `Audio ${Math.round(probed / 60)} daqiqa; ruxsat etilgan maksimum ${Math.round(maxSeconds / 60)} daqiqa`, {
      code: 'AUDIO_TOO_LONG',
    });
  }
  // Unknown duration: require at least one minute of allowance, bill the real duration afterwards
  const allowance = checkAllowance(company, probed ?? 60);

  const script = String(p.script ?? company.script ?? '').trim().slice(0, 20000);
  const schema = buildAnalysisSchema(fieldDefs, { withScript: !!script });
  const audioLang = { language: country.language, note: country.note };
  const outCode = String(p.outputLanguage || company.output_language || '').trim();
  const outLangDef = outCode ? findLanguage(outCode) : null;
  if (outCode && !outLangDef) throw new HttpError(400, `outputLanguage qoʻllanmaydi: ${outCode}`, { code: 'INVALID_LANGUAGE' });
  const lang = outLangDef ? { language: outLangDef.language, note: outLangDef.note } : audioLang;
  const outputLanguageCode = outLangDef ? outLangDef.code : country.languageCode;
  let parsed;
  let model = '';
  let usage = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };
  try {
    const out = await generateContent({
      contents: {
        parts: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: buildAnalysisPrompt(fileName || 'sales_call.audio', fieldDefs, context, lang, script, audioLang) },
        ],
      },
      config: {
        systemInstruction: buildSystemInstruction(lang, audioLang),
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
    model = out.model;
    const u = out.response.usageMetadata || {};
    usage = { inputTokens: u.promptTokenCount || 0, outputTokens: u.candidatesTokenCount || 0, thoughtTokens: u.thoughtsTokenCount || 0 };
    const text = out.response.text;
    if (!text) throw new Error('Gemini returned an empty response');
    parsed = JSON.parse(text);
  } catch (err) {
    recordFailure({ company, token, fileName, mimeType, buffer, externalId, probed, err, startedAt, model });
    if (err.status === 429 || err.status === 503) {
      throw new HttpError(503, 'Tahlil xizmati hozir band, biroz kutib qayta urinib koʻring', { code: 'AI_UNAVAILABLE' });
    }
    if (err.status && err.status < 500) {
      throw new HttpError(502, `Gemini xatosi: ${err.message}`, { code: 'AI_ERROR' });
    }
    throw new HttpError(500, err.message || 'Tahlil amalga oshmadi', { code: 'ANALYSIS_FAILED' });
  }

  parsed.fileName = fileName || 'sales_call.audio';
  normalizeTasks(parsed.coachingCard);
  normalizeTalkRatio(parsed.callSummary);
  const customValues = coerceFieldValues(fieldDefs, parsed.customFields);
  parsed.customFields = customValues;
  parsed.language = {
    country: country.code,
    // language of the call (from the country) and language of the result texts
    language: country.language,
    code: country.languageCode,
    outputLanguage: lang.language,
    outputCode: outputLanguageCode,
  };
  let scriptScore = null;
  if (script && parsed.scriptAdherence) {
    const sa = parsed.scriptAdherence;
    sa.score = Math.max(0, Math.min(100, Number(sa.score) || 0));
    sa.steps = (sa.steps || []).map((st, i) => ({ ...st, id: st.id || `step-${i + 1}` }));
    sa.script = script;
    scriptScore = sa.score;
  } else {
    delete parsed.scriptAdherence;
  }
  parsed.source = p.source || 'api';
  const ratingScore = normalizeRating(parsed, !!(script && parsed.scriptAdherence));

  const durationSeconds = probed ?? Number(parsed.callSummary?.durationSeconds) ?? 60;
  // The real duration decides the bill; re-check the limit when the header gave no duration
  const finalAllowance = probed ? allowance : checkAllowance(company, durationSeconds);

  const id = newId('an');
  const createdAt = nowIso();
  tx(() => {
    q.run(
      `INSERT INTO analyses(id, company_id, token_id, subscription_id, external_id, file_name, mime_type, file_bytes, duration_seconds, billed_seconds, cost, billing_type,
         status, error, model, processing_ms, title, overall_score, overall_grade, custom_fields, result, created_at,
         input_tokens, output_tokens, thought_tokens, ai_cost_usd, script_score, rating_score)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'done',NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      company.id,
      token?.id || null,
      finalAllowance.subscription.id,
      String(externalId || '').slice(0, 200),
      String(fileName || '').slice(0, 300),
      mimeType,
      buffer.length,
      durationSeconds,
      finalAllowance.billedSeconds,
      Math.round(finalAllowance.cost),
      finalAllowance.subscription.type,
      model,
      Date.now() - startedAt,
      String(parsed.callSummary?.title || '').slice(0, 300),
      Number(parsed.callSummary?.overallScore) || null,
      String(parsed.coachingCard?.overallGrade || ''),
      JSON.stringify(customValues),
      JSON.stringify(parsed),
      createdAt,
      usage.inputTokens,
      usage.outputTokens,
      usage.thoughtTokens,
      estimateAiCostUsd(usage),
      scriptScore,
      ratingScore
    );
    charge({ company, subscription: finalAllowance.subscription, billedSeconds: finalAllowance.billedSeconds, cost: finalAllowance.cost, analysisId: id });
  });

  return rowToApi(q.one('SELECT * FROM analyses WHERE id = ?', id));
}

function recordFailure({ company, token, fileName, mimeType, buffer, externalId, probed, err, startedAt, model }) {
  try {
    q.run(
      `INSERT INTO analyses(id, company_id, token_id, external_id, file_name, mime_type, file_bytes, duration_seconds, status, error, model, processing_ms, created_at)
       VALUES(?,?,?,?,?,?,?,?,'failed',?,?,?,?)`,
      newId('an'),
      company.id,
      token?.id || null,
      String(externalId || '').slice(0, 200),
      String(fileName || '').slice(0, 300),
      mimeType,
      buffer.length,
      probed || 0,
      String(err?.message || err).slice(0, 1000),
      model || '',
      Date.now() - startedAt,
      nowIso()
    );
  } catch (e) {
    console.error('Could not record failed analysis', e);
  }
}
