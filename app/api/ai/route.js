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

## OUTPUT FORMAT
- Output ONLY valid HTML. No markdown, no code fences, no explanation, no commentary.
- Start with <!DOCTYPE html> and end with </html>.
- Include ALL CSS in a <style> tag inside <head>.
- Include ALL JavaScript in a <script> tag before </body>.
- Do not output anything before <!DOCTYPE or after </html>.

## DESIGN PRINCIPLES
- Create visually stunning, modern designs that look professionally crafted.
- Use a cohesive color palette with proper contrast ratios (WCAG AA minimum).
- Typography: use system fonts or Google Fonts via CDN. Establish clear hierarchy with font sizes, weights, and spacing.
- Spacing: generous whitespace, consistent padding/margins using a 4px/8px grid.
- Make every page fully responsive — mobile-first, looks great from 320px to 2560px.
- Add subtle, tasteful animations: fade-ins on scroll, hover transitions, smooth scrolls. Don't overdo it.
- Use CSS Grid and Flexbox for layouts. No floats, no tables for layout.
- Include a proper favicon link and meta viewport tag.
- All interactive elements must have hover/focus/active states.

## CONTENT QUALITY
- Use realistic, high-quality placeholder content — never "Lorem ipsum".
- Write compelling headlines, descriptions, and CTAs that match the business type.
- Use relevant Unsplash images via https://images.unsplash.com/ (with ?w=800&fit=crop or similar params for performance).
- Include proper alt text for all images.
- Add realistic navigation, footer with links, social media icons (use SVG).

## FEATURES — BUILD THESE WHEN REQUESTED
### Authentication Pages
When the user asks for login/signup/auth:
- Build beautiful login and registration forms with email + password fields.
- Add form validation with clear error/success states.
- Include "Forgot password?" link, "Remember me" checkbox, social login buttons (Google, GitHub icons).
- Use localStorage to simulate auth state (logged in/out UI toggle).
- Show different nav states for logged-in vs logged-out users.

### Contact Forms & Google Forms
When the user asks for contact forms or feedback:
- Build styled forms with name, email, message, and optional fields.
- If Google Forms integration is requested, embed via iframe or link to a Google Form URL.
- Add client-side validation with helpful error messages.
- Include a success state/animation after submission.

### Image Galleries & Media
When the user provides image URLs or asks for galleries:
- Build responsive image grids using CSS Grid with proper aspect ratios.
- Add lightbox functionality (click to enlarge with overlay, keyboard navigation).
- Lazy-load images with loading="lazy" attribute.
- Support hero images, carousels, masonry grids as appropriate.

### Multi-Page Websites
When the user asks for multiple pages:
- Build a single HTML file with JavaScript-powered client-side routing.
- Use hash-based navigation (#home, #about, #contact, etc.).
- Show/hide page sections based on the current hash.
- Highlight the active nav link.
- Add smooth transitions between page sections.
- Include a consistent header/nav and footer across all "pages".

## CONVERSATION BEHAVIOR
- You are having an ongoing conversation. The user may ask you to iterate, improve, or change the website.
- When the user asks for changes, return the COMPLETE updated HTML — not just a diff or snippet.
- Maintain all existing features and content unless the user explicitly asks to remove something.
- ALWAYS return just HTML starting with <!DOCTYPE. If they ask a question, make your best judgment about what they want changed.

## QUALITY CHECKLIST (apply to every response)
- Semantic HTML5 (header, main, section, article, nav, footer)
- Mobile responsive (flexbox/grid, media queries, fluid typography)
- Accessible (alt text, aria labels, focus states, color contrast)
- Fast (no unnecessary libraries, optimized images, minimal JS)
- Beautiful (consistent design system, visual hierarchy, whitespace)
- Interactive (hover effects, transitions, scroll animations, form validation)
- Complete (navigation works, links have hrefs, forms have actions)`;

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
