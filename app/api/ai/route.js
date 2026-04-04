// app/api/ai/route.js
// AI proxy — Gemini, Groq (Llama)

import { NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { provider = 'gemini', model = 'gemini-2.5-flash', system, messages, max_tokens = 8000, prompt, isEdit, pages } = body;

  // Build messages from prompt if not already structured
  let finalMessages = messages;
  let finalSystem = system;

  if (!finalMessages && prompt) {
    finalSystem = `You are an expert web developer. Generate complete, beautiful, production-ready single-page websites.

Rules:
- Output ONLY valid HTML — nothing else. No markdown, no code fences, no JSON, no explanation.
- Start your response with <!DOCTYPE html> and end with </html>
- Include all CSS inline in a <style> tag in the <head>
- Include all JavaScript inline in a <script> tag before </body>
- Use real content, beautiful modern design, proper typography and color
- Make it visually stunning with animations where appropriate
- Do not include any text before <!DOCTYPE or after </html>`;

    const userMsg = isEdit
      ? `Edit this website according to the request. Return only the full updated HTML.\n\nCurrent HTML:\n${Object.values(pages || {}).join('\n')}\n\nRequest: ${prompt}`
      : `Create a complete website for: ${prompt}`;

    finalMessages = [{ role: 'user', content: userMsg }];
  }

  try {
    let result;
    if (provider === 'groq') {
      result = await callGroq({ model, system: finalSystem, messages: finalMessages, max_tokens });
    } else {
      result = await callGemini({ model, system: finalSystem, messages: finalMessages, max_tokens });
    }

    // Parse the response from the AI
    const rawText = (result.content?.[0]?.text || '').trim();
    let parsed;

    // If response looks like HTML, use it directly
    if (rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html')) {
      parsed = { pages: { 'index.html': rawText }, shared_css: '', shared_js: '' };
    } else {
      // Try to extract JSON (for structured responses or legacy flow)
      try {
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('No JSON object found');
        }
      } catch {
        // Last resort: wrap raw text as HTML (it might be HTML without doctype)
        parsed = { pages: { 'index.html': rawText }, shared_css: '', shared_js: '' };
      }
    }

    return NextResponse.json({
      ...parsed,
      tokens: result.usage?.output_tokens || 0,
    }, { status: 200, headers: CORS });

  } catch (err) {
    console.error(`[${provider}] Error:`, err.message);
    return NextResponse.json(
      { error: err.message || 'AI request failed' },
      { status: err.status || 500, headers: CORS }
    );
  }
}

// ── GEMINI ─────────────────────────────────────────────────────────────────
async function callGemini({ model, system, messages, max_tokens }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('Gemini API key not configured.'), { status: 503 });

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens },
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
  if (!res.ok || data.error) throw new Error(data.error?.message || `Gemini error ${res.status}`);

  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('No response from model');

  const text = candidate.content?.parts?.[0]?.text ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

// ── GROQ (OpenAI-compatible) ──────────────────────────────────────────────
async function callGroq({ model, system, messages, max_tokens }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Object.assign(new Error('Groq API key not configured. Get one free at console.groq.com'), { status: 503 });

  const groqMessages = [];
  if (system) groqMessages.push({ role: 'system', content: system });
  groqMessages.push(...messages);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages: groqMessages, max_tokens }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`Groq returned invalid JSON (${res.status})`); }
  if (!res.ok) throw new Error(data.error?.message || `Groq error ${res.status}`);

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

