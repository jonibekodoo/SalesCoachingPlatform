import { GoogleGenAI } from '@google/genai';
import { getGeminiKey, getModels } from '../services/settings.service.js';
import { HttpError } from '../middleware/errors.js';

// Rate/quota limit (429) or overloaded model (503): worth retrying, unlike e.g. a bad request
const RETRYABLE_STATUSES = new Set([429, 503]);
// Delay before each round; every round tries the primary model, then each fallback
const ROUND_DELAYS_MS = [0, 2000, 4000, 8000, 15000, 30000];
const MODEL_GAP_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getAiClient() {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new HttpError(503, 'Gemini API kaliti sozlanmagan. Admin paneldagi Sozlamalar boʻlimida kiriting.', {
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * ai.models.generateContent with retries across the primary model and the fallbacks.
 * Resolves with { response, model } so the caller knows which model answered.
 */
export async function generateContent(params) {
  const ai = getAiClient();
  const models = getModels();
  const primary = params.model || models.analyze;
  const candidates = [primary, ...models.fallbacks.filter((m) => m !== primary)];
  const attempts = ROUND_DELAYS_MS.flatMap((roundDelay) =>
    candidates.map((model, idx) => ({ model, delayMs: idx === 0 ? roundDelay : MODEL_GAP_MS }))
  );

  for (let i = 0; ; i++) {
    const { model, delayMs } = attempts[i];
    await sleep(delayMs);
    try {
      const response = await ai.models.generateContent({ ...params, model });
      return { response, model };
    } catch (err) {
      const next = attempts[i + 1];
      if (!RETRYABLE_STATUSES.has(err?.status) || !next) {
        throw err;
      }
      console.warn(`Gemini ${err.status} from ${model}, retrying with ${next.model} in ${next.delayMs / 1000}s`);
    }
  }
}

/** Lightweight check used by the admin "Kalitni tekshirish" button */
export async function testGemini() {
  const started = Date.now();
  const { response, model } = await generateContent({
    contents: 'Reply with the single word OK.',
    config: { maxOutputTokens: 5 },
  });
  return { ok: true, model, reply: (response.text || '').trim(), ms: Date.now() - started };
}
