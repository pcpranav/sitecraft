// app/api/ai/route.js
// AI proxy — Groq, Cerebras, OpenRouter, Cloudflare Workers AI.
// All four are OpenAI-compatible chat-completion endpoints, served via one
// shared callOpenAICompat helper. The frontend chooses provider+model;
// PROVIDERS resolves the base URL and credentials.

import { NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/system-prompt';

// Extend serverless function timeout. Vercel clamps this to plan max:
// Hobby = 60s, Pro = 300s, Enterprise = 900s. Setting 300 lets Pro+ use
// slower models (1T-class, reasoning) without changing code per-plan.
export const maxDuration = 300;

// ── PROVIDER CONFIG ────────────────────────────────────────────────────────
// Each entry resolves credentials at call time (not module load) so the
// route still boots when only some keys are populated.
const PROVIDERS = {
  groq: {
    label: 'Groq',
    resolve: () => {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return { error: 'Groq API key not configured. Get one free at console.groq.com' };
      return { baseURL: 'https://api.groq.com/openai/v1', apiKey };
    },
  },
  cerebras: {
    label: 'Cerebras',
    resolve: () => {
      const apiKey = process.env.CEREBRAS_API_KEY;
      if (!apiKey) return { error: 'Cerebras API key not configured. Get one at cloud.cerebras.ai' };
      return { baseURL: 'https://api.cerebras.ai/v1', apiKey };
    },
  },
  openrouter: {
    label: 'OpenRouter',
    resolve: () => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { error: 'OpenRouter API key not configured. Get one at openrouter.ai/keys' };
      return { baseURL: 'https://openrouter.ai/api/v1', apiKey };
    },
  },
  cloudflare: {
    label: 'Cloudflare Workers AI',
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
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    provider = 'cerebras',
    model = 'qwen-3-235b-a22b-instruct-2507',
    messages,
    max_tokens,
    features = [],
    imageUrls = [],
    stylePreset,
    tonePreset,
  } = body;

  const providerCfg = PROVIDERS[provider];
  if (!providerCfg) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await callOpenAICompat({
            providerCfg,
            model,
            system: systemPrompt,
            messages: finalMessages,
            max_tokens,
          });

          const rawText = (result.content?.[0]?.text || '').trim();

          let html = rawText;
          const fenceMatch = html.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```/);
          if (fenceMatch) html = fenceMatch[1].trim();

          const lower = html.toLowerCase();
          const docIdx = lower.indexOf('<!doctype');
          const htmlIdx = lower.indexOf('<html');
          const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
          if (startIdx > 0) html = html.slice(startIdx);

          const endIdx = html.toLowerCase().lastIndexOf('</html>');
          if (endIdx !== -1) html = html.slice(0, endIdx + 7);

          if (!html || (!lower.includes('<!doctype') && !lower.includes('<html'))) {
            throw new Error('Model returned non-HTML output. Try rephrasing your prompt.');
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

// ── OpenAI-compatible call (Groq, Cerebras, OpenRouter, Cloudflare) ───────
async function callOpenAICompat({ providerCfg, model, system, messages, max_tokens }) {
  const resolved = providerCfg.resolve();
  if (resolved.error) throw Object.assign(new Error(resolved.error), { status: 503 });
  const { baseURL, apiKey } = resolved;

  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  chatMessages.push(...messages);

  const requestBody = { model, messages: chatMessages };
  if (max_tokens) requestBody.max_tokens = max_tokens;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`${providerCfg.label} returned invalid JSON (${res.status})`); }
  if (!res.ok) throw new Error(data.error?.message || data.error || `${providerCfg.label} error ${res.status}`);

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
