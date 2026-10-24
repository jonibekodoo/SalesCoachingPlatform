import { HttpError } from '../middleware/errors.js';

export const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'select', 'list'];
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const MAX_FIELDS = 40;

/**
 * Validates CRM custom field definitions.
 * Accepts [{ key, label?, type?, description?, options?, required? }] and returns a clean list.
 */
export function normalizeFieldDefs(input, where = 'customFields') {
  if (input === undefined || input === null || input === '') return [];
  let defs = input;
  if (typeof defs === 'string') {
    try {
      defs = JSON.parse(defs);
    } catch {
      throw new HttpError(400, `${where} JSON formatida boʻlishi kerak`, { code: 'INVALID_CUSTOM_FIELDS' });
    }
  }
  // Also accept an object map { key: {label,type,...} } for convenience
  if (defs && typeof defs === 'object' && !Array.isArray(defs)) {
    defs = Object.entries(defs).map(([key, v]) => (typeof v === 'string' ? { key, label: v } : { key, ...v }));
  }
  if (!Array.isArray(defs)) {
    throw new HttpError(400, `${where} massiv boʻlishi kerak`, { code: 'INVALID_CUSTOM_FIELDS' });
  }
  if (defs.length > MAX_FIELDS) {
    throw new HttpError(400, `${where}: koʻpi bilan ${MAX_FIELDS} ta field`, { code: 'INVALID_CUSTOM_FIELDS' });
  }
  const seen = new Set();
  return defs.map((raw, i) => {
    const f = raw || {};
    const key = String(f.key || f.name || '').trim();
    if (!KEY_RE.test(key)) {
      throw new HttpError(400, `${where}[${i}].key notoʻgʻri (harf, raqam, _; harf bilan boshlanadi)`, {
        code: 'INVALID_CUSTOM_FIELDS',
      });
    }
    if (seen.has(key)) throw new HttpError(400, `${where}: "${key}" takrorlangan`, { code: 'INVALID_CUSTOM_FIELDS' });
    seen.add(key);
    const type = String(f.type || 'text').toLowerCase();
    if (!FIELD_TYPES.includes(type)) {
      throw new HttpError(400, `${where}[${i}].type "${type}" qoʻllanmaydi (${FIELD_TYPES.join(', ')})`, {
        code: 'INVALID_CUSTOM_FIELDS',
      });
    }
    let options = [];
    if (type === 'select') {
      options = (Array.isArray(f.options) ? f.options : String(f.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2) {
        throw new HttpError(400, `${where}[${i}] (select) kamida 2 ta option kerak`, { code: 'INVALID_CUSTOM_FIELDS' });
      }
    }
    return {
      key,
      label: String(f.label || key).slice(0, 200),
      type,
      description: String(f.description || '').slice(0, 1000),
      ...(type === 'select' ? { options } : {}),
    };
  });
}

/** Request fields override company defaults with the same key; the rest are merged. */
export function mergeFieldDefs(companyDefaults, requestDefs) {
  const map = new Map(companyDefaults.map((f) => [f.key, f]));
  for (const f of requestDefs) map.set(f.key, f);
  return [...map.values()];
}

/** Coerces the model output to the declared types; unknown or wrong values become null. */
export function coerceFieldValues(defs, values) {
  const out = {};
  const src = values && typeof values === 'object' ? values : {};
  for (const f of defs) {
    let v = src[f.key];
    if (v === undefined || v === '' ) v = null;
    if (v !== null) {
      switch (f.type) {
        case 'number': {
          const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
          v = Number.isFinite(n) ? n : null;
          break;
        }
        case 'boolean':
          v = typeof v === 'boolean' ? v : /^(true|yes|ha|да|1)$/i.test(String(v)) ? true : /^(false|no|yo.?q|нет|0)$/i.test(String(v)) ? false : null;
          break;
        case 'date': {
          const m = String(v).match(/\d{4}-\d{2}-\d{2}/);
          v = m ? m[0] : null;
          break;
        }
        case 'select':
          v = f.options.includes(v) ? v : f.options.find((o) => o.toLowerCase() === String(v).toLowerCase()) ?? null;
          break;
        case 'list':
          v = Array.isArray(v) ? v.map((x) => String(x)) : String(v).split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
          break;
        default:
          v = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
    out[f.key] = v;
  }
  return out;
}
