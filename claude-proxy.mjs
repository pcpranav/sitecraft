const rateLimits = new Map();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_TOKENS = 8000;
const MAX_BODY_BYTES = 32_000;

function getClientIp(req, context) {
  return context?.ip
    || req.headers.get("x-nf-client-connection-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetMs: RATE_LIMIT_WINDOW_MS };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const resetMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart) };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extraHeaders },
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

  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: { message: "Server misconfigured: ANTHROPIC_API_KEY not set." } }, 500);
  }

  // Check body size
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { message: "Request too large." } }, 413);
  }

  // ── Admin bypass ──────────────────────────────────────────────────────────
  // If ADMIN_TOKEN env var is set and the request sends a matching X-Admin-Token
  // header, skip rate limiting entirely. Only YOU know this token.
  const adminToken = Netlify.env.get("ADMIN_TOKEN");
  const requestToken = req.headers.get("x-admin-token");
  const isAdmin = adminToken && requestToken && adminToken === requestToken;
  // ─────────────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    const ip = getClientIp(req, context);
    const { allowed, remaining, resetMs } = checkRateLimit(ip);
    if (!allowed) {
      const resetMins = Math.ceil(resetMs / 60000);
      return jsonResponse(
        { error: { message: `Rate limit exceeded. You can make ${RATE_LIMIT_MAX} requests per hour. Try again in ~${resetMins} minute${resetMins !== 1 ? "s" : ""}.` } },
        429,
        {
          "Retry-After": String(Math.ceil(resetMs / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + resetMs) / 1000)),
        }
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: { message: "Invalid JSON body." } }, 400);
  }

  // Lock model and cap tokens
  body.model = "claude-sonnet-4-20250514";
  body.max_tokens = Math.min(body.max_tokens || 4000, MAX_TOKENS);
  if (typeof body.system !== "string") delete body.system;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return jsonResponse(data, upstream.status, {
      "X-RateLimit-Limit": isAdmin ? "unlimited" : String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": isAdmin ? "unlimited" : "see header",
    });
  } catch (err) {
    return jsonResponse({ error: { message: "Upstream error: " + err.message } }, 502);
  }
};

export const config = {
  path: "/api/claude",
};
