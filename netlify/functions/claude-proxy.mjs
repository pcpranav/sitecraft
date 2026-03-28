// netlify/functions/claude-proxy.mjs
// Unified AI proxy for Anthropic, Gemini, and OpenAI

const RATE_LIMIT = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip, adminToken) {
  const envAdmin = process.env.ADMIN_TOKEN;
  if (envAdmin && adminToken === envAdmin) return null; // bypass
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const mins = Math.ceil((entry.resetAt - now) / 60000);
    return `Rate limit reached (${RATE_LIMIT_MAX} req/hr). Resets in ~${mins}m.`;
  }
  entry.count++;
  RATE_LIMIT.set(ip, entry);
  return null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const ip = context.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const adminToken = req.headers.get('x-admin-token') || '';
  const rateLimitErr = checkRateLimit(ip, adminToken);
  if (rateLimitErr) {
    return new Response(JSON.stringify({ error: rateLimitErr }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { provider = 'anthropic', model, system, messages, max_tokens = 8000 } = body;

  try {
    let result;
    if (provider === 'anthropic') {
      result = await callAnthropic({ model, system, messages, max_tokens });
    } else if (provider === 'gemini') {
      result = await callGemini({ model, system, messages, max_tokens });
    } else if (provider === 'openai') {
      result = await callOpenAI({ model, system, messages, max_tokens });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[${provider}] Error:`, err);
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || 'AI request failed' }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

// ── ANTHROPIC ────────────────────────────────────────────────────────────────
async function callAnthropic({ model, system, messages, max_tokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error('Anthropic is not configured on this deployment. Please use Gemini instead.');
    err.status = 503;
    throw err;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, system, messages, max_tokens }),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`Anthropic returned invalid JSON (${res.status})`); }
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
  return {
    content: data.content,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

// ── GEMINI ───────────────────────────────────────────────────────────────────
async function callGemini({ model, system, messages, max_tokens }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err = new Error('Gemini is not configured on this deployment.');
    err.status = 503;
    throw err;
  }
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const geminiBody = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens, thinkingConfig: { thinkingBudget: 0 } },
  };
  if (system) {
    geminiBody.systemInstruction = { parts: [{ text: system }] };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`Gemini returned invalid JSON (${res.status})`); }
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Gemini error ${res.status}`);
  }
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const feedback = data.promptFeedback?.blockReason
      ? `Blocked: ${data.promptFeedback.blockReason}`
      : 'No response from model (safety filter?)';
    throw new Error(feedback);
  }
  const text = candidate.content?.parts?.[0]?.text ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

// ── OPENAI ───────────────────────────────────────────────────────────────────
async function callOpenAI({ model, system, messages, max_tokens }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error('OpenAI is not configured on this deployment. Please use Gemini instead.');
    err.status = 503;
    throw err;
  }
  const openaiMessages = [];
  if (system) openaiMessages.push({ role: 'system', content: system });
  openaiMessages.push(...messages);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages: openaiMessages, max_tokens }),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`OpenAI returned invalid JSON (${res.status})`); }
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export const config = { path: '/api/ai' };
