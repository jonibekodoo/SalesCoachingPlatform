// Measures Gemini token usage for one analysis call: node scripts/usage-probe.mjs <audio file> [mimeType]
import 'dotenv/config';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { buildAnalysisSchema } from '../src/gemini/schema.js';
import { buildSystemInstruction, buildAnalysisPrompt } from '../src/gemini/prompts.js';

const [file, mimeType = 'audio/wav'] = process.argv.slice(2);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const data = fs.readFileSync(file).toString('base64');
const lang = { language: 'Uzbek', note: 'Latin script' };
const started = Date.now();
const r = await ai.models.generateContent({
  model: process.env.GEMINI_ANALYZE_MODEL || 'gemini-3.8-flash',
  contents: { parts: [{ inlineData: { mimeType, data } }, { text: buildAnalysisPrompt(file, [], {}, lang) }] },
  config: { systemInstruction: buildSystemInstruction(lang), responseMimeType: 'application/json', responseSchema: buildAnalysisSchema([]) },
});
console.log('ms', Date.now() - started, 'responseChars', (r.text || '').length);
console.log(JSON.stringify(r.usageMetadata, null, 1));
