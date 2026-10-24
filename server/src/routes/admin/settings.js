import { Router } from 'express';
import { publicSettings, setSetting } from '../../services/settings.service.js';
import { testGemini } from '../../gemini/client.js';
import { asyncHandler, HttpError } from '../../middleware/errors.js';
import { COUNTRIES, LANGUAGES } from '../../util/countries.js';
import { FIELD_TYPES } from '../../services/customFields.js';

const router = Router();

router.get('/', (_req, res) => res.json(publicSettings()));

router.get('/meta', (_req, res) => res.json({ countries: COUNTRIES, languages: LANGUAGES, fieldTypes: FIELD_TYPES }));

router.put('/', (req, res) => {
  const b = req.body || {};
  if (typeof b.geminiApiKey === 'string') {
    const key = b.geminiApiKey.trim();
    // Empty string clears the stored key; a masked value (contains …) means "unchanged"
    if (!key.includes('…')) setSetting('gemini_api_key', key);
  }
  if (typeof b.analyzeModel === 'string' && b.analyzeModel.trim()) setSetting('analyze_model', b.analyzeModel.trim());
  if (typeof b.fallbackModels === 'string') setSetting('fallback_models', b.fallbackModels);
  if (b.maxAudioMinutes !== undefined) {
    const n = Number(b.maxAudioMinutes);
    if (!Number.isFinite(n) || n < 1 || n > 600) throw new HttpError(400, 'maxAudioMinutes 1..600 oraligʻida boʻlsin');
    setSetting('max_audio_minutes', String(Math.round(n)));
  }
  for (const [key, field] of [['gemini_input_price', 'geminiInputPrice'], ['gemini_output_price', 'geminiOutputPrice'], ['usd_rate', 'usdRate']]) {
    if (b[field] !== undefined) {
      const n = Number(b[field]);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${field} manfiy boʻlmagan son boʻlsin`);
      setSetting(key, String(n));
    }
  }
  res.json(publicSettings());
});

router.post(
  '/test-gemini',
  asyncHandler(async (_req, res) => {
    try {
      res.json(await testGemini());
    } catch (err) {
      if (err instanceof HttpError) throw err;
      res.status(200).json({ ok: false, error: err.message, status: err.status || null });
    }
  })
);

export default router;
