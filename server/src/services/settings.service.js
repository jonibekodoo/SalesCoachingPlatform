import { q } from '../db.js';
import { config } from '../config.js';
import { nowIso } from '../util/ids.js';

const DEFAULTS = {
  gemini_api_key: '',
  analyze_model: 'gemini-3.8-flash',
  fallback_models: 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash',
  max_audio_minutes: '120',
  // Gemini paid tier, USD per 1M tokens (output includes thinking tokens)
  gemini_input_price: '0.75',
  gemini_output_price: '3.75',
  // so'm per 1 USD, for showing the AI cost next to the tariff
  usd_rate: '12800',
};

export const getSetting = (key) => {
  const row = q.one('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : DEFAULTS[key] ?? '';
};

export const setSetting = (key, value) =>
  q.run(
    'INSERT INTO settings(key, value, updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    key,
    String(value ?? ''),
    nowIso()
  );

export const getGeminiKey = () => getSetting('gemini_api_key') || config.envGeminiKey;

export const getModels = () => ({
  analyze: getSetting('analyze_model') || DEFAULTS.analyze_model,
  fallbacks: (getSetting('fallback_models') || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
});

export const getMaxAudioSeconds = () => (Number(getSetting('max_audio_minutes')) || 120) * 60;

export const getPricing = () => ({
  inputPerM: Number(getSetting('gemini_input_price')) || 0,
  outputPerM: Number(getSetting('gemini_output_price')) || 0,
  usdRate: Number(getSetting('usd_rate')) || 0,
});

/** Gemini cost in USD for one call (thinking tokens are billed as output) */
export const estimateAiCostUsd = ({ inputTokens = 0, outputTokens = 0, thoughtTokens = 0 }) => {
  const p = getPricing();
  return (inputTokens * p.inputPerM + (outputTokens + thoughtTokens) * p.outputPerM) / 1e6;
};

// Masked view for the admin panel
export const publicSettings = () => {
  const key = getSetting('gemini_api_key');
  const envKey = config.envGeminiKey;
  const effective = key || envKey;
  return {
    geminiApiKeyMasked: effective ? `${effective.slice(0, 6)}…${effective.slice(-4)}` : '',
    geminiKeySource: key ? 'settings' : envKey ? 'env' : 'none',
    analyzeModel: getSetting('analyze_model'),
    fallbackModels: getSetting('fallback_models'),
    maxAudioMinutes: Number(getSetting('max_audio_minutes')) || 120,
    geminiInputPrice: Number(getSetting('gemini_input_price')) || 0,
    geminiOutputPrice: Number(getSetting('gemini_output_price')) || 0,
    usdRate: Number(getSetting('usd_rate')) || 0,
  };
};
