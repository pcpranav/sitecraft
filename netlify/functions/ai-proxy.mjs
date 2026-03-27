const rateLimits = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_BODY_BYTES = 48_000;

function getIp(req, context) {
  return context?.ip
    || req.headers.get("x-nf-client-connection-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function checkRate(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip);
  if (!e || now - e.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return { ok: true, remaining: RATE_LIMIT_MAX - 1, resetMs: RATE_LIMIT_WINDOW_MS };
  }
  if (e.count >= RATE_LIMIT_MAX) {
    return { ok: false, remaining: 0, resetMs: RATE_LIMIT_WINDOW_MS - (now - e.windowStart) };
  }
  e.count++;
  return { ok: true, remaining: RATE_LIMIT_MAX - e.count, resetMs: RATE_LIMIT_WINDOW_MS - (now - e.windowStart) };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra },
  });
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cl = parseInt(req.headers.get("content-length") || "0", 10);
  if (cl > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

  // Admin bypass
  const adminToken = Netlify.env.get("ADMIN_TOKEN");
  const isAdmin = adminToken && req.headers.get("x-admin-token") === adminToken;

  if (!isAdmin) {
    const ip = getIp(req, context);
    const { ok, remaining, resetMs } = checkRate(ip);
    if (!ok) {
      const mins = Math.ceil(resetMs / 60000);
      return json(
        { error: `Rate limit exceeded — ${RATE_LIMIT_MAX} requests/hour. Try again in ~${mins}m.` },
        429,
        { "Retry-After": String(Math.ceil(resetMs / 1000)) }
      );
    }
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const provider = (body.provider || "gemini").toLowerCase();
  delete body.provider;

  // ── GEMINI ─────────────────────────────────────────────────────────────
  if (provider === "gemini") {
    const apiKey = Netlify.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

    const model = body.model || "gemini-2.5-flash-preview-04-17";
    const maxTokens = Math.min(body.max_tokens || 8000, 8000);
    const systemPrompt = body.system || "";
    const messages = body.messages || [];

    // Convert Anthropic-style messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const geminiBody = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 },
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {})
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: data.error?.message || "Gemini error" }, upstream.status);

      // Normalize to Anthropic-style response so frontend stays consistent
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return json({
        content: [{ type: "text", text }],
        model,
        usage: { input_tokens: data.usageMetadata?.promptTokenCount || 0, output_tokens: data.usageMetadata?.candidatesTokenCount || 0 }
      });
    } catch (err) { return json({ error: "Gemini upstream error: " + err.message }, 502); }
  }

  // ── OPENAI ─────────────────────────────────────────────────────────────
  if (provider === "openai") {
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

    const oaBody = {
      model: body.model || "gpt-4.1-mini",
      max_tokens: Math.min(body.max_tokens || 8000, 8000),
      messages: [
        ...(body.system ? [{ role: "system", content: body.system }] : []),
        ...(body.messages || [])
      ]
    };
    try {
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(oaBody),
      });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: data.error?.message || "OpenAI error" }, upstream.status);

      const text = data.choices?.[0]?.message?.content || "";
      return json({
        content: [{ type: "text", text }],
        model: data.model,
        usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 }
      });
    } catch (err) { return json({ error: "OpenAI upstream error: " + err.message }, 502); }
  }

  // ── ANTHROPIC ──────────────────────────────────────────────────────────
  if (provider === "anthropic") {
    const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    body.model = body.model || "claude-haiku-4-5-20251001";
    body.max_tokens = Math.min(body.max_tokens || 8000, 8000);
    if (typeof body.system !== "string") delete body.system;

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
      });
      const data = await upstream.json();
      return json(data, upstream.status);
    } catch (err) { return json({ error: "Anthropic upstream error: " + err.message }, 502); }
  }

  return json({ error: `Unknown provider: ${provider}. Use gemini, openai, or anthropic.` }, 400);
};

export const config = { path: "/api/ai" };
