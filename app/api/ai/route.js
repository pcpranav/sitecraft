// app/api/ai/route.js
// AI proxy — Groq, Cerebras, OpenRouter, Cloudflare Workers AI.
// All four are OpenAI-compatible chat-completion endpoints, served via one
// shared callOpenAICompat helper. The frontend chooses provider+model;
// PROVIDERS resolves the base URL and credentials.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { DEFAULT_MODEL_ID } from '@/lib/models';
import { extractHtml } from '@/lib/html-extract';

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

        // Two-tier progress throttling:
        //   light  (chars only, 200ms)  — drives the live "Writing… 4.5k chars" indicator
        //   heavy  (chars + full text, 1000ms) — drives the live iframe preview
        // Sending full text every 200ms would be wasteful (40KB+/sec of redundant payload).
        let lastLight = 0;
        let lastHeavy = 0;

        try {
          const result = await streamOpenAICompat({
            providerCfg,
            model,
            system: systemPrompt,
            messages: finalMessages,
            max_tokens,
            signal: abortCtrl.signal,
            onDelta: (_delta, fullText) => {
              const now = Date.now();
              if (now - lastHeavy >= 1000) {
                send({ progress: true, chars: fullText.length, text: fullText });
                lastHeavy = now;
                lastLight = now;
              } else if (now - lastLight >= 200) {
                send({ progress: true, chars: fullText.length });
                lastLight = now;
              }
            },
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

// extractHtml lives in @/lib/html-extract so both this route and the
// frontend (for in-flight partial preview) can use the same logic.

// ── OpenAI-compatible streaming call ──────────────────────────────────────
// Requests stream:true upstream, parses the SSE response, calls onDelta for
// each content chunk, and returns the final accumulated text + usage.
// One retry on 429/5xx with a short backoff — most free-tier failures are
// transient capacity issues that a single retry absorbs.
async function streamOpenAICompat({ providerCfg, model, system, messages, max_tokens, signal, onDelta }) {
  const resolved = providerCfg.resolve();
  if (resolved.error) throw Object.assign(new Error(resolved.error), { status: 503 });
  const { baseURL, apiKey } = resolved;

  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  chatMessages.push(...messages);

  const requestBody = { model, messages: chatMessages, stream: true };
  if (max_tokens) requestBody.max_tokens = max_tokens;

  const attemptStream = async () =>
    fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

  let res = await attemptStream();
  if (!res.ok && (res.status === 429 || res.status >= 500)) {
    await new Promise(r => setTimeout(r, 1500));
    res = await attemptStream();
  }

  if (!res.ok) {
    const rawBody = await res.text();
    let data = null;
    try { data = rawBody ? JSON.parse(rawBody) : null; } catch {}
    const upstream =
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      (rawBody ? rawBody.slice(0, 200).replace(/\s+/g, ' ') : null);
    throw new Error(`${providerCfg.label} error ${res.status}${upstream ? `: ${upstream}` : ''}`);
  }

  // Parse upstream SSE. Each "data: {...}" line is a delta event; "[DONE]"
  // marks end-of-stream. Some providers send usage in the final event.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let usage = { input_tokens: 0, output_tokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trimEnd();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (onDelta) onDelta(delta, fullText);
        }
        if (json.usage) {
          usage = {
            input_tokens: json.usage.prompt_tokens ?? 0,
            output_tokens: json.usage.completion_tokens ?? 0,
          };
        }
      } catch {
        // Ignore malformed lines — some providers occasionally send keep-alives.
      }
    }
  }

  return {
    content: [{ type: 'text', text: fullText }],
    usage,
  };
}
