// app/api/ai/route.js
// AI proxy — Gemini, Groq (Llama) with streaming support

import { NextResponse } from 'next/server';

// Extend serverless function timeout (Netlify/Vercel)
export const maxDuration = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Webcraft, an elite web developer AI that builds stunning, production-ready websites from natural language descriptions.

## !!! CRITICAL: IMAGE STRATEGY — DO NOT IGNORE !!!
- NEVER EVER use "source.unsplash.com". It is deprecated and broken. Using it results in failure.
- ONLY EVER use "images.unsplash.com" with direct photo IDs from the list below.
- !!! FORBIDDEN: DO NOT invent IDs. Only use IDs you find in this list or have verified. !!!
- Use this curated "Golden ID" list:
  - Coffee/Cafe: 1511920135916-28150c44834f, 1541167760496-1628856ab772, 1495474472287-4d71bcdd2085, 1509042239860-f550ce710b93
  - SaaS/Tech/AI: 1460925895917-afdab827c52f, 1519389950473-47ba0277781c, 1551288049-bebda4e38f71, 1498050108023-c5249f4df085, 1451187580459-43490279c0fa
  - Food/Restaurant: 1517248135467-4c7ed9d4c442, 1504674900247-0877df9cc836, 1482049016688-2d3e1b311143, 1567620985-60c0910744d5
  - Travel/Nature/Agency: 1501785887741-f67a99596267, 1472213984083-20159d240dca, 1469474968028-56623f0214c8, 1506744038136-46273834b3fb
  - Fashion/Lifestyle: 1483985988307-2e1181792d0c, 1445204450317-2979201633e2, 1490481651871-ab68624d5e24
- Format: <img src="https://images.unsplash.com/photo-<ID>?auto=format&fit=crop&q=80&w=1200" alt="..." crossorigin="anonymous" loading="eager">
- !!! IMPORTANT: ALWAYS include crossorigin="anonymous" on all <img> tags to prevent browser ORB blocks.
- If you need a unique category not listed, use: https://placehold.co/600x400/1a1a1a/ffffff?text=<Category>
- Descriptive "alt" text is mandatory. Use loading="eager" specifically for the preview.

## OUTPUT FORMAT
- Output ONLY valid HTML. No markdown, no code fences, no explanation, no commentary.
- Start with <!DOCTYPE html> and end with </html>.
- Include ALL CSS in a <style> tag inside <head>.
- Include ALL JavaScript in a <script> tag before </body>.
- Do not output anything before <!DOCTYPE or after </html>.

## MOBILE-FIRST & RESPONSIVE DESIGN
- ALWAYS design mobile-first. Default CSS should be for mobile, with media queries for desktop.
- Mandate: <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
- Media Queries: Use @media (max-width: 768px) for tablets and @media (max-width: 480px) for tiny screens.
- Touch Targets: Buttons, links, and inputs MUST have a minimum clickable area of 48x48px on mobile.
- Fluid Layouts: Use percentage widths or flex/grid. Avoid fixed px widths.
- Typography: Use responsive font sizes (e.g., clamp(1rem, 2vw + 1rem, 1.5rem)) or media query overrides.
- Sticky Elements: Use position: sticky for navbars but ensure they don't block too much viewport on mobile.
- Form Elements: Ensure inputs don't zoom in on iPhone (use font-size: 16px minimum).

## DESIGN PRINCIPLES
- Create visually stunning, modern designs (glassmorphism, soft shadows, vibrant gradients).
- Use a cohesive color palette with proper contrast ratios (WCAG AA).
- Typography: Use system fonts or Google Fonts via CDN (e.g., Inter, Montserrat, Playfair Display).
- Spacing: Generous whitespace, consistent 4px/8px grid system.
- Add subtle animations: fade-ins on scroll (IntersectionObserver), hover transitions (0.3s ease), smooth scrolling.

## FEATURES — BUILD THESE WHEN REQUESTED
### Authentication Pages
- Beautiful login/signup forms, email/pass fields, social login buttons, storage-based auth simulation.
### Contact Forms
- Styled forms with validation, error/success states, realistic submission feedback.
### Image Galleries & Media
- Responsive grids, aspect-ratio containers, simple lightbox functionality.
### Multi-Page Websites
- Single HTML with hashtag-based client-side routing (#home, #about).
- Highlight active nav link, maintain layout consistency across "pages".

## QUALITY CHECKLIST
- Semantic HTML5, WAI-ARIA roles where appropriate.
- Responsive images (srcset not required, but query params for Unsplash are good).
- Error-free console (no broken links, valid CSS syntax).
- Professional, non-generic copy (no Lorem Ipsum).`;

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const {
    provider = 'gemini',
    model = 'gemini-2.5-flash',
    messages,
    max_tokens = 16000,
    features = [],
    imageUrls = [],
  } = body;

  // Build system prompt with feature context
  let systemPrompt = SYSTEM_PROMPT;

  if (features.length > 0) {
    systemPrompt += `\n\n## ACTIVE FEATURES FOR THIS PROJECT\nThe user has enabled these features — incorporate them into the website:\n${features.map(f => `- ${f}`).join('\n')}`;
  }

  if (imageUrls.length > 0) {
    const externalUrls = imageUrls.filter(u => !u.startsWith('data:'));
    const base64Count = imageUrls.length - externalUrls.length;
    if (externalUrls.length > 0) {
      systemPrompt += `\n\n## USER-PROVIDED IMAGES\nUse these images in the website where appropriate:\n${externalUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join('\n')}`;
    }
    if (base64Count > 0) {
      systemPrompt += `\n\nThe user has also uploaded ${base64Count} image(s). Use placeholder Unsplash images in their place with similar dimensions.`;
    }
  }

  const finalMessages = messages || [];
  if (finalMessages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400, headers: CORS });
  }

  // Use streaming to avoid Netlify function timeout
  try {
    const streamHeaders = {
      ...CORS,
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
          let result;
          if (provider === 'groq') {
            result = await callGroq({ model, system: systemPrompt, messages: finalMessages, max_tokens });
          } else {
            result = await callGemini({ model, system: systemPrompt, messages: finalMessages, max_tokens });
          }

          const rawText = (result.content?.[0]?.text || '').trim();

          // Strip markdown code fences
          let html = rawText;
          const fenceMatch = html.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
          if (fenceMatch) html = fenceMatch[1].trim();

          // Find the HTML document
          const lower = html.toLowerCase();
          const docIdx = lower.indexOf('<!doctype');
          const htmlIdx = lower.indexOf('<html');
          const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
          if (startIdx > 0) html = html.slice(startIdx);

          // Trim after </html>
          const endIdx = html.toLowerCase().lastIndexOf('</html>');
          if (endIdx !== -1) html = html.slice(0, endIdx + 7);

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
      { status: 500, headers: CORS }
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
  if (!res.ok || data.error) {
    console.error('[Gemini] API error:', JSON.stringify(data.error || data, null, 2));
    throw new Error(data.error?.message || `Gemini error ${res.status}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason;
    console.error('[Gemini] No candidate:', JSON.stringify(data, null, 2));
    throw new Error(reason ? `Blocked by safety filter: ${reason}` : 'No response from model — try rephrasing your prompt');
  }

  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED') {
    throw new Error('Response blocked by safety filter — try rephrasing your prompt');
  }

  const text = candidate.content?.parts?.[0]?.text ?? '';
  if (!text) {
    console.error('[Gemini] Empty text. Candidate:', JSON.stringify(candidate, null, 2));
    throw new Error('Model returned empty response — try again');
  }

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
