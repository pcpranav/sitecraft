// app/api/ai/route.js
// AI proxy — Groq, Cerebras, OpenRouter, Cloudflare Workers AI.
// All four are OpenAI-compatible chat-completion endpoints, served via one
// shared callOpenAICompat helper. The frontend chooses provider+model;
// PROVIDERS resolves the base URL and credentials.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { DEFAULT_MODEL_ID } from '@/lib/models';

// Extend serverless function timeout. Vercel clamps this to plan max:
// Hobby = 60s, Pro = 300s, Enterprise = 900s. Setting 300 lets Pro+ use
// slower models (1T-class, reasoning) without changing code per-plan.
export const maxDuration = 300;

// ── PROVIDER CONFIG ────────────────────────────────────────────────────────
// Each entry resolves credentials at call time (not module load) so the
// route still boots when only some keys are populated. maxTokens is the
// per-provider effective output cap — picked conservatively from each
// provider's docs so we don't trip into "max_tokens exceeds model limit"
// errors. Request body max_tokens is clamped to this.
const PROVIDERS = {
  groq: {
    label: 'Groq',
    maxTokens: 8000,
    resolve: () => {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return { error: 'Groq API key not configured. Get one free at console.groq.com' };
      return { baseURL: 'https://api.groq.com/openai/v1', apiKey };
    },
  },
  cerebras: {
    label: 'Cerebras',
    maxTokens: 16000,
    resolve: () => {
      const apiKey = process.env.CEREBRAS_API_KEY;
      if (!apiKey) return { error: 'Cerebras API key not configured. Get one at cloud.cerebras.ai' };
      return { baseURL: 'https://api.cerebras.ai/v1', apiKey };
    },
  },
  openrouter: {
    label: 'OpenRouter',
    maxTokens: 8000,
    resolve: () => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { error: 'OpenRouter API key not configured. Get one at openrouter.ai/keys' };
      return { baseURL: 'https://openrouter.ai/api/v1', apiKey };
    },
  },
  cloudflare: {
    label: 'Cloudflare Workers AI',
    maxTokens: 8000,
    resolve: () => {
      const apiKey = process.env.CF_AI_TOKEN;
      const accountId = process.env.CF_ACCOUNT_ID;
      if (!apiKey || !accountId) {
        return { error: 'Cloudflare Workers AI not configured. Set CF_ACCOUNT_ID and CF_AI_TOKEN.' };
      }
      return { baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`, apiKey };
    },
  },
};


// ── ROUTE HANDLER ─────────────────────────────────────────────────────────
export async function POST(req) {
  // Require an authenticated session — the studio UI is gated, and so is the
  // model proxy behind it, so a logged-out caller can't hit the providers directly.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to generate sites.' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    provider = 'cerebras',
    model = DEFAULT_MODEL_ID,
    messages,
    max_tokens: clientMaxTokens,
    features = [],
    imageUrls = [],
    stylePreset,
    tonePreset,
  } = body;

  const providerCfg = PROVIDERS[provider];
  if (!providerCfg) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  // Clamp the requested max_tokens to the provider's effective cap. If the
  // client didn't pass one, just use the cap directly — that's typically
  // the right ceiling for a single-page HTML generation.
  const max_tokens = Math.min(clientMaxTokens || providerCfg.maxTokens, providerCfg.maxTokens);

  if (Array.isArray(messages) && messages.length > 50) {
    return NextResponse.json({ error: 'Conversation too long. Start a new chat.' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt({ features, imageUrls, stylePreset, tonePreset });

  const finalMessages = messages || [];
  if (finalMessages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  try {
    const streamHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };

    // If the client closes the tab mid-generation, propagate that to the
    // upstream fetch so we stop paying for completions nobody will see.
    const abortCtrl = new AbortController();
    if (req.signal) {
      if (req.signal.aborted) abortCtrl.abort();
      else req.signal.addEventListener('abort', () => abortCtrl.abort(), { once: true });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };

        try {
          const result = await callOpenAICompat({
            providerCfg,
            model,
            system: systemPrompt,
            messages: finalMessages,
            max_tokens,
            signal: abortCtrl.signal,
          });

          const rawText = (result.content?.[0]?.text || '').trim();
          const html = extractHtml(rawText);

          if (!html) {
            const snippet = rawText.slice(0, 200).replace(/\s+/g, ' ');
            throw new Error(`Model returned non-HTML output${snippet ? `: "${snippet}…"` : '.'} Try rephrasing your prompt or switching models.`);
          }

          send({ html, tokens: result.usage?.output_tokens || 0, done: true });
        } catch (err) {
          console.error(`[${provider}] Error:`, err.message);
          send({ error: err.message || 'AI request failed', done: true });
        }

        controller.close();
      }
    });

    return new Response(stream, { status: 200, headers: streamHeaders });

  } catch (err) {
    console.error(`[${provider}] Stream error:`, err.message);
    return NextResponse.json(
      { error: err.message || 'AI request failed' },
      { status: 500 }
    );
  }
}

// ── HTML EXTRACTION ───────────────────────────────────────────────────────
// Strip any markdown fencing or commentary the model wrapped around its HTML.
// Earlier this grabbed the FIRST fenced block, which broke when a model
// emitted an explanation snippet before the actual HTML. Now we prefer the
// largest fenced block containing HTML markers, then fall back to slicing
// from the first <!doctype/<html to the last </html>.
function extractHtml(rawText) {
  if (!rawText) return '';

  const fenceRe = /```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```/g;
  const blocks = [];
  let m;
  while ((m = fenceRe.exec(rawText)) !== null) blocks.push(m[1].trim());

  const looksLikeHtml = (s) => {
    const l = s.toLowerCase();
    return l.includes('<!doctype') || l.includes('<html');
  };

  let candidate = rawText;
  if (blocks.length) {
    const htmlBlocks = blocks.filter(looksLikeHtml);
    if (htmlBlocks.length) {
      candidate = htmlBlocks.reduce((a, b) => (b.length > a.length ? b : a));
    } else if (blocks.length === 1) {
      candidate = blocks[0];
    }
  }

  const lower = candidate.toLowerCase();
  const docIdx = lower.indexOf('<!doctype');
  const htmlIdx = lower.indexOf('<html');
  const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
  if (startIdx > 0) candidate = candidate.slice(startIdx);

  const endIdx = candidate.toLowerCase().lastIndexOf('</html>');
  if (endIdx !== -1) candidate = candidate.slice(0, endIdx + 7);

  if (!looksLikeHtml(candidate)) return '';
  return candidate.trim();
}

// ── OpenAI-compatible call (Groq, Cerebras, OpenRouter, Cloudflare) ───────
// One retry on 429/5xx with a short backoff. Most free-tier failures are
// transient capacity issues — a single retry absorbs the majority of them
// without spinning up a serious retry library.
async function callOpenAICompat({ providerCfg, model, system, messages, max_tokens, signal }) {
  const resolved = providerCfg.resolve();
  if (resolved.error) throw Object.assign(new Error(resolved.error), { status: 503 });
  const { baseURL, apiKey } = resolved;

  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  chatMessages.push(...messages);

  const requestBody = { model, messages: chatMessages };
  if (max_tokens) requestBody.max_tokens = max_tokens;

  const attempt = async () => {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });
    const rawBody = await res.text();
    let data = null;
    try { data = rawBody ? JSON.parse(rawBody) : null; } catch {}
    return { res, data, rawBody };
  };

  let { res, data, rawBody } = await attempt();
  const isRetryable = !res.ok && (res.status === 429 || res.status >= 500);
  if (isRetryable) {
    await new Promise(r => setTimeout(r, 1500));
    ({ res, data, rawBody } = await attempt());
  }

  if (!res.ok) {
    const upstream =
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      (rawBody ? rawBody.slice(0, 200).replace(/\s+/g, ' ') : null);
    throw new Error(`${providerCfg.label} error ${res.status}${upstream ? `: ${upstream}` : ''}`);
  }
  if (!data) throw new Error(`${providerCfg.label} returned invalid JSON (${res.status})`);

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
