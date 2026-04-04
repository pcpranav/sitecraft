// app/api/ai/route.js
// AI proxy — Gemini, Groq (Llama) with conversation support

import { NextResponse } from 'next/server';

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
- If the user asks a question about the website (not a change request), still return the current HTML unchanged, but you can add an HTML comment at the top like <!-- Note: [your answer] --> before the <!DOCTYPE.
- Actually no — ALWAYS return just HTML starting with <!DOCTYPE. If they ask a question, make your best judgment about what they want changed.

## QUALITY CHECKLIST (apply to every response)
✓ Semantic HTML5 (header, main, section, article, nav, footer)
✓ Mobile responsive (flexbox/grid, media queries, fluid typography)
✓ Accessible (alt text, aria labels, focus states, color contrast)
✓ Fast (no unnecessary libraries, optimized images, minimal JS)
✓ Beautiful (consistent design system, visual hierarchy, whitespace)
✓ Interactive (hover effects, transitions, scroll animations, form validation)
✓ Complete (navigation works, links have hrefs, forms have actions)`;

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
    systemPrompt += `\n\n## USER-PROVIDED IMAGES\nThe user has uploaded these images. Use them in the website where appropriate:\n${imageUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join('\n')}`;
  }

  // Messages should already be structured from the client
  const finalMessages = messages || [];

  if (finalMessages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400, headers: CORS });
  }

  try {
    let result;
    if (provider === 'groq') {
      result = await callGroq({ model, system: systemPrompt, messages: finalMessages, max_tokens });
    } else {
      result = await callGemini({ model, system: systemPrompt, messages: finalMessages, max_tokens });
    }

    // Parse the response
    const rawText = (result.content?.[0]?.text || '').trim();

    // Strip markdown code fences if the model wrapped it
    let html = rawText;
    const fenceMatch = html.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) html = fenceMatch[1].trim();

    // Find the HTML document in the response
    const lower = html.toLowerCase();
    const docIdx = lower.indexOf('<!doctype');
    const htmlIdx = lower.indexOf('<html');
    const startIdx = docIdx !== -1 ? docIdx : htmlIdx;

    if (startIdx > 0) {
      html = html.slice(startIdx);
    }

    // Trim anything after </html>
    const endIdx = lower.lastIndexOf('</html>');
    if (endIdx !== -1) {
      html = html.slice(0, endIdx + 7);
    }

    return NextResponse.json({
      html,
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
