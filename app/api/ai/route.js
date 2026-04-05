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
- ONLY use "images.unsplash.com" with direct photo IDs from the curated list below.
- !!! FORBIDDEN: DO NOT invent or guess photo IDs. Only use IDs from this exact list. !!!
- IMPORTANT: For EVERY <img> tag, you MUST also add an onerror fallback so broken images self-heal:
  onerror="this.onerror=null;this.src='https://placehold.co/800x500/1a1a2e/ffffff?text=Image'"

### Curated Photo ID List (ONLY use these):
  - Coffee/Cafe: 1511920135916-28150c44834f, 1541167760496-1628856ab772, 1495474472287-4d71bcdd2085, 1509042239860-f550ce710b93
  - SaaS/Tech/AI: 1460925895917-afdab827c52f, 1519389950473-47ba0277781c, 1551288049-bebda4e38f71, 1498050108023-c5249f4df085, 1451187580459-43490279c0fa
  - Food/Restaurant: 1517248135467-4c7ed9d4c442, 1504674900247-0877df9cc836, 1482049016688-2d3e1b311143, 1567620985-60c0910744d5
  - Travel/Nature/Agency: 1501785887741-f67a99596267, 1472213984083-20159d240dca, 1469474968028-56623f0214c8, 1506744038136-46273834b3fb
  - Fashion/Lifestyle: 1483985988307-2e1181792d0c, 1445204450317-2979201633e2, 1490481651871-ab68624d5e24
  - People/Team: 1507003211169-0a1dd7228f2d, 1494790108377-be9c29b29330, 1438761681033-6461ffad8d80, 1472099645785-5658abf4ff4e
  - Abstract/Gradient: 1557683316094-a31cdcf96c8c, 1558591710-4b4a1ae0f04d, 1579546929518-9e396f3cc809

### Image Format (copy exactly):
<img src="https://images.unsplash.com/photo-<ID>?auto=format&fit=crop&q=80&w=1200" alt="descriptive text" crossorigin="anonymous" loading="eager" onerror="this.onerror=null;this.src='https://placehold.co/800x500/1a1a2e/ffffff?text=Image'">

### Rules:
- ALWAYS include crossorigin="anonymous" on ALL <img> tags to prevent browser ORB blocks.
- ALWAYS include the onerror fallback on ALL <img> tags.
- If you need more than 5 images or a category not listed, use placehold.co: https://placehold.co/800x500/<hex_bg>/<hex_text>?text=<Label>
- Descriptive "alt" text is mandatory. Use loading="eager" for above-the-fold images.

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

// Compact system prompt for Groq (strict TPM limits — keep under 2000 tokens)
const SYSTEM_PROMPT_COMPACT = `You are Webcraft, an AI web developer. Build complete, responsive websites from descriptions.

OUTPUT: Only valid HTML. Start with <!DOCTYPE html>, end with </html>. All CSS in <style> in <head>, all JS in <script> before </body>. No markdown, no code fences.

IMAGES: NEVER use source.unsplash.com. Use images.unsplash.com with these IDs:
- Tech: 1460925895917-afdab827c52f, 1519389950473-47ba0277781c, 1551288049-bebda4e38f71
- Food: 1517248135467-4c7ed9d4c442, 1504674900247-0877df9cc836
- Nature: 1501785887741-f67a99596267, 1472213984083-20159d240dca
- People: 1507003211169-0a1dd7228f2d, 1494790108377-be9c29b29330
Format: <img src="https://images.unsplash.com/photo-<ID>?auto=format&fit=crop&q=80&w=1200" alt="..." crossorigin="anonymous" loading="eager" onerror="this.onerror=null;this.src='https://placehold.co/800x500/1a1a2e/ffffff?text=Image'">
For extra images use: https://placehold.co/800x500/<hex>/<hex>?text=<Label>

DESIGN: Mobile-first, responsive, modern. Include viewport meta tag. Use system fonts or Google Fonts. Professional copy (no Lorem Ipsum).`;

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
  // Use condensed prompt for Groq (strict TPM limits)
  let systemPrompt = provider === 'groq' ? SYSTEM_PROMPT_COMPACT : SYSTEM_PROMPT;

  if (features.length > 0) {
    systemPrompt += `\n\n## ACTIVE FEATURES\nIncorporate: ${features.join(', ')}`;
  }

  if (imageUrls.length > 0) {
    const externalUrls = imageUrls.filter(u => !u.startsWith('data:'));
    const base64Count = imageUrls.length - externalUrls.length;
    if (externalUrls.length > 0) {
      systemPrompt += `\n\n## USER IMAGES\n${externalUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join('\n')}`;
    }
    if (base64Count > 0) {
      systemPrompt += `\nUser uploaded ${base64Count} image(s) — use Unsplash placeholders.`;
    }
  }

  // Groq has strict token limits, reduce max_tokens
  const effectiveMaxTokens = provider === 'groq' ? Math.min(max_tokens, 4000) : max_tokens;

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
            result = await callGroq({ model, system: systemPrompt, messages: finalMessages, max_tokens: effectiveMaxTokens });
          } else {
            result = await callGemini({ model, system: systemPrompt, messages: finalMessages, max_tokens: effectiveMaxTokens });
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
