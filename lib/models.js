// lib/models.js
// Single source of truth for the model catalog. Sidebar reads MODELS to
// render the picker, AppContext reads DEFAULT_MODEL_ID + DEPRECATED_MODEL_IDS
// for the localStorage migration, and the API route reads DEFAULT_MODEL_ID
// as the request-body default. Adding/removing models should only require
// editing this file.
//
// quality / speed: rough subjective ratings (high|med|low) shown in the picker
// so users can pick the right trade-off. Quality reflects single-page-website
// generation output, not benchmark scores. Speed reflects perceived
// time-to-finished-page on a typical brief.

export const MODELS = [
  { id: 'gpt-oss-120b',                              provider: 'cerebras',   name: 'Cerebras · GPT-OSS 120B',  desc: '120B MoE on wafer-scale silicon',                       color: '#f97316', quality: 'high', speed: 'high' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq',       name: 'Groq · Llama 4 Scout',     desc: '17B-active MoE · ~750 tok/s on LPU',                    color: '#eab308', quality: 'med',  speed: 'high' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8',                provider: 'cloudflare', name: 'Cloudflare · Qwen3 30B',   desc: '30B MoE · 3B active · edge inference',                  color: '#f59e0b', quality: 'med',  speed: 'med'  },
  { id: 'openrouter/free',                           provider: 'openrouter', name: 'OpenRouter · Free Auto',   desc: 'Auto-routes across ~24 free models · resilient to throttling', color: '#10b981', quality: 'med',  speed: 'low'  },
];

export const DEFAULT_MODEL_ID = 'gpt-oss-120b';

// Slugs that used to be in MODELS but have been removed because their
// upstream changed (deprecated, deauthorized, capacity-throttled, etc.).
// AppContext checks this set when reading WEBCRAFT_MODEL from localStorage
// so returning users with a dead slug cached don't get stuck.
export const DEPRECATED_MODEL_IDS = new Set([
  'qwen-3-235b-a22b-instruct-2507',  // Cerebras removed 2026-05-27
  'inclusionai/ling-2.6-flash:free', // OpenRouter free tier removed
  '@cf/openai/gpt-oss-120b',         // Cloudflare slot dropped (poor results)
  'qwen/qwen3-coder:free',           // OpenRouter free upstream rate-limited
  'deepseek/deepseek-v4-flash:free', // OpenRouter free upstream rate-limited
]);
