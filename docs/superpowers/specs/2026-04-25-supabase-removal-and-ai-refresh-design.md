# Supabase Removal & AI Refresh — Design Spec

**Date:** 2026-04-25
**Status:** Design approved, awaiting implementation plan
**Author:** Pranav (with Claude)

## Goal

Remove Supabase entirely from sitecraft, replace auth and data storage with Vercel-native services (Vercel Postgres + Auth.js), drop Gemini in favor of a consolidated free-tier OSS-model lineup, and refresh the AI layer (richer system prompt, more UI tools, user-expectation copy).

## Non-goals

- Migrating existing user data (clean-slate cutover; users re-sign-in).
- Adding paid AI models.
- Adding rate limiting of any kind (accepted exposure).
- Migrating away from Next.js, React, or Vercel hosting.
- Generalizing to non-Google OAuth providers.

## Context

Today sitecraft uses Supabase for five concerns: Google OAuth, user profile rows, the `projects` table, a `generations` usage-log table, and a `rate_limits` table with an `increment_rate_limit` RPC. Code audit shows `profiles`, `generations`, and `rate_limits` (server-side) are the only Supabase touchpoints beyond auth + `projects`; `profiles` and `generations` are effectively dead — avatar data comes from the OAuth payload at `components/Header.jsx:232-233`, and `generations` is never written to from the app. Rate limits gate `/api/ai` today but will be removed per design decision.

The AI layer currently supports Gemini (4 models) and Groq (Llama 3.3 70B). Gemini 2.5 Pro and Gemini 3 Flash are paid at production scale; the user wants a free-tier-only lineup across providers that all speak the OpenAI chat-completions API shape so one wrapper handles them all.

## Design Decisions

### Auth & Data

| Area | Before | After |
|---|---|---|
| Auth | Supabase Auth (Google OAuth) | Auth.js v5 (NextAuth) with Google provider |
| Session | Supabase JWT | Auth.js database sessions (stored in `sessions` table) |
| DB | Supabase Postgres | Vercel Postgres (Neon-backed) |
| DB SDK | `@supabase/supabase-js` | `@vercel/postgres` (raw parameterized SQL) |
| Authorization | Row-Level Security | App-level `WHERE user_id = $1` using `auth()` session |
| Rate limiting | Per-user DB quota + per-IP in-memory | None |
| Data migration | N/A | None — clean slate |

### AI Providers

Drop Gemini entirely. Keep Groq. Add Cerebras, OpenRouter, Cloudflare Workers AI. All four speak OpenAI-compatible chat completions, so one `callOpenAICompatible({ baseUrl, apiKey, model, system, messages, max_tokens })` function replaces both `callGemini` and `callGroq`.

**Final model lineup (all free-tier):**

| # | Label | Provider key | Model ID | Env vars |
|---|---|---|---|---|
| 1 | Llama 3.3 70B (Groq) | `groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| 2 | Llama 3.3 70B (Cerebras) | `cerebras` | `llama-3.3-70b` | `CEREBRAS_API_KEY` |
| 3 | DeepSeek R1 Free | `openrouter` | `deepseek/deepseek-r1:free` | `OPENROUTER_API_KEY` |
| 4 | Llama 3.3 70B (Cloudflare) | `cloudflare` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN` |

Model IDs on provider consoles drift; verify current names before deploy. Raise the Groq `max_tokens` cap from 4000 to 8000 (from `app/api/ai/route.js:208`). Use the full `SYSTEM_PROMPT` for all four providers; delete `SYSTEM_PROMPT_COMPACT`.

### System Prompt

Rewrite `SYSTEM_PROMPT` to generate richer sites. Preserve all existing rules (mobile-first, 44px touch targets, 16px input font, `images.unsplash.com` with photo-ID + `onerror` fallback to placehold.co, strict HTML-only output) and extend along six dimensions:

1. **Section library** — always include: hero, features, social-proof (stats or testimonials), secondary CTA, footer with 3 columns.
2. **Layout variety** — randomize among: hero-with-right-image, full-bleed-hero-with-overlay, 50/50 split, asymmetric grid, magazine-style with pull-quotes.
3. **Typography pairings** — pair a display font (Space Grotesk / Sora / Inter Tight) with a body font (Inter / DM Sans) via Google Fonts link.
4. **Color palettes** — provide 5 curated palettes (primary / secondary / accent / surface / surface-alt / border / text / text-dim) for the model to pick from.
5. **Interactivity** — IntersectionObserver fade-ins (existing) plus: number counters in stats, hover tilt on cards, smooth accordion FAQ, sticky nav that shrinks on scroll.
6. **Content richness** — realistic testimonials (name + company + avatar), realistic stats (percent / count / metric), full-sentence benefit copy, no Lorem ipsum.

Plus dynamic injection:

- If client sent `stylePreset` (landing / portfolio / blog / SaaS / e-commerce / other): prepend `Category: {preset}. Optimize sections for this category.`
- If client sent `tonePreset` (minimal / playful / corporate / bold / retro): prepend `Tone: {preset}. Apply to typography, colors, copy voice.`

Target prompt length: ~300 lines (vs. ~70 today). Worth it for output quality.

### Client-Facing Tools

**Add to Sidebar:**

- **Regenerate button** — resends last user message with the currently-selected model.
- **Style preset dropdown** — 6 options (landing / portfolio / blog / SaaS / e-commerce / other). Sent to `/api/ai` as `stylePreset`.
- **Tone preset dropdown** — 5 options (minimal / playful / corporate / bold / retro). Sent to `/api/ai` as `tonePreset`.
- **Undo last turn** — pops the last assistant message and restores previous `currentHtml` from the existing `history` array.
- **Empty-state message** (before first prompt): *"Describe any website idea. Works best for landing pages, portfolios, and simple brochures."*
- **Tooltip on model picker**: *"Outputs are single-page HTML drafts. Don't expect pixel-perfect or backend-connected sites."*

**Add to PreviewFrame:**

- **Viewport toggle** — three buttons (Desktop / Tablet / Mobile) controlling iframe `max-width` via inline style (100% / 768px / 375px).

**Add to landing page (`app/page.js`):**

- One-line caption under the hero: *"Basic AI website generator — great for drafts, not production."*

**Remove from Sidebar:**

- `auth` feature toggle (generates fake, non-functional login forms — misleading).
- `multi-page` feature toggle (misleading label; the tool outputs single-file HTML).

**Keep from Sidebar:**

- `contact-form`, `image-gallery` feature toggles.
- Image upload.
- Chat history.
- Model picker.

### Model & Conversation Continuity

Verified working in current code:

- `components/Sidebar.jsx:162-205` reads `selectedModel` fresh on every send and derives provider via the `MODELS` lookup. Switching models mid-conversation works today and continues to work after the provider refactor.
- Full `messages` array is sent every turn; the API injects current HTML as context. Back-and-forth refinement continues to work.

No code changes required here — mentioned in spec so the implementation plan doesn't accidentally regress it.

## Architecture

```
┌───────────────────┐        ┌──────────────────────────┐
│ Client (browser)  │        │ Next.js server (Vercel)  │
│                   │        │                          │
│ useSession()      │ cookie │ /api/auth/[...nextauth] ─┼──► Google OAuth
│ signIn / signOut  ├────────►                          │
│                   │        │ /api/projects/*  ────────┼──► Vercel Postgres
│ Sidebar ──────────┼────────► /api/ai ─────────────────┼──► Groq / Cerebras /
│ PreviewFrame      │  SSE   │   callOpenAICompatible() │    OpenRouter / Cloudflare
└───────────────────┘        └──────────────────────────┘
```

**Units and their boundaries:**

- `lib/auth.js` — Auth.js config. Exports `auth`, `signIn`, `signOut`, `handlers`. Depends on pg adapter and Google provider.
- `lib/db.js` — Postgres access. Exports `sql` from `@vercel/postgres` plus typed helpers (`getProjectsForUser`, `getProjectById`, `upsertProject`, `deleteProject`, `clearProjectHistory`). Depends on `POSTGRES_URL`.
- `lib/ai-providers.js` — single `callOpenAICompatible` function and a `PROVIDER_CONFIG` map keyed by provider name. Depends only on `fetch` + env vars.
- `lib/system-prompt.js` — `SYSTEM_PROMPT` constant + `buildSystemPrompt({ features, imageUrls, stylePreset, tonePreset })` helper. Pure function, no deps.
- `app/api/auth/[...nextauth]/route.js` — re-exports `handlers` from `lib/auth.js`.
- `app/api/projects/route.js`, `app/api/projects/[id]/route.js` — thin wrappers calling `auth()` then `lib/db.js` helpers.
- `app/api/ai/route.js` — thin: reads body, calls `buildSystemPrompt`, dispatches to `callOpenAICompatible`, streams SSE.
- `components/AuthModal.jsx` — calls `signIn('google')`. No Supabase.
- `components/Sidebar.jsx` — adds new UI tools; continues posting to `/api/ai` with extended body shape.
- `components/PreviewFrame.jsx` — adds viewport toggle state + inline max-width.
- `context/AppContext.js` — removes Supabase client; reads `user` from `useSession()`.

## Schema

Auth.js-managed tables (created by `@auth/pg-adapter`; schema matches the adapter's required shape):

```sql
-- users
id              text primary key,
name            text,
email           text unique,
email_verified  timestamptz,
image           text

-- accounts
id                  text primary key,
user_id             text not null references users(id) on delete cascade,
type                text not null,
provider            text not null,
provider_account_id text not null,
refresh_token       text,
access_token        text,
expires_at          bigint,
token_type          text,
scope               text,
id_token            text,
session_state       text,
unique (provider, provider_account_id)

-- sessions
id            text primary key,
session_token text unique not null,
user_id       text not null references users(id) on delete cascade,
expires       timestamptz not null

-- verification_tokens  (required by adapter, unused with OAuth-only)
identifier text not null,
token      text not null,
expires    timestamptz not null,
primary key (identifier, token)
```

App-owned table:

```sql
-- projects
id           uuid primary key default gen_random_uuid(),
user_id      text not null references users(id) on delete cascade,
name         text not null default 'Untitled',
description  text default '',
pages        jsonb not null default '{}'::jsonb,
shared_css   text default '',
shared_js    text default '',
thumbnail    text default '',
history      jsonb default '[]'::jsonb,
created_at   timestamptz default now(),
updated_at   timestamptz default now(),

index on (user_id),
index on (updated_at desc)
```

Note: `user_id` switches from `uuid` (Supabase style) to `text` (Auth.js default for the `users.id` column).

## API Contracts

### `/api/auth/[...nextauth]`

Standard Auth.js routes. Handled entirely by the library. Supports `GET/POST /api/auth/signin`, `/callback/google`, `/signout`, `/session`.

### `/api/projects` (GET, POST)

Unchanged shape from client's perspective. Server-side: pulls user via `auth()` → 401 if none → queries/inserts via `lib/db.js`.

### `/api/projects/[id]` (GET, PUT, DELETE)

Same — authenticates, scopes by `user_id`.

### `/api/ai` (POST)

Request body extended:

```ts
{
  provider: 'groq' | 'cerebras' | 'openrouter' | 'cloudflare',
  model: string,
  messages: Array<{ role: 'user'|'assistant'|'system', content: string }>,
  max_tokens?: number,         // default 16000; clamped to 8000 for Groq only
  features?: string[],         // 'contact-form' | 'image-gallery'
  imageUrls?: string[],
  stylePreset?: 'landing'|'portfolio'|'blog'|'saas'|'ecommerce'|'other',
  tonePreset?: 'minimal'|'playful'|'corporate'|'bold'|'retro'
}
```

Response: SSE stream (unchanged), terminal event `{ html, tokens, done: true }` or `{ error, done: true }`.

### Removed

- `/api/config` — was serving Supabase anon keys. Delete.

## Error Handling

- **Auth failures** — Auth.js returns standard error flow. `AuthModal` surfaces `result.error` string.
- **DB failures** — `@vercel/postgres` throws; API routes catch and return `500 { error: "Database unavailable" }`. No fail-open behavior (Supabase had fail-open on rate limit; not relevant now).
- **AI provider failures** — existing pattern preserved: `callOpenAICompatible` throws on non-200; route catches, sends SSE `{ error, done: true }`. 429s from any provider surface to the user via the same SSE channel.
- **Missing provider env vars** — `callOpenAICompatible` throws 503 with a specific message per provider (e.g., "Cerebras API key not configured. Get one at cloud.cerebras.ai").
- **Google OAuth callback errors** — Auth.js default error page at `/api/auth/error?error=...` acceptable for v1.

## Testing

- **Auth** — manual: sign-in with Google, verify session cookie, verify `/api/projects` returns user's projects, sign-out clears cookie.
- **DB** — manual: create project, edit, delete; confirm row-level scoping by attempting to GET another user's project ID (expect 404).
- **AI providers** — manual: cycle through all 4 models, confirm each returns valid HTML. Pay special attention to Cloudflare's different base URL structure.
- **System prompt** — eyeball: sample 5 prompts across style presets × tone presets, verify sections present, fonts loaded, palettes applied, interactivity works in preview.
- **UI tools** — manual: regenerate re-runs last prompt, undo restores prior HTML, viewport toggle resizes iframe.
- **Migration smoke** — run locally against a fresh Vercel Postgres database; verify migrations apply cleanly.

No automated test suite exists today. Not adding one in this spec — stays manual.

## Environment Variables

**Remove:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

**Add:**
```
# Auth.js
AUTH_SECRET                 # generate with: openssl rand -base64 32
AUTH_GOOGLE_ID              # Google Cloud Console → OAuth 2.0 Client ID
AUTH_GOOGLE_SECRET

# Vercel Postgres (auto-injected by the Vercel integration, but names shown)
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING

# AI providers (existing)
GROQ_API_KEY

# AI providers (new)
CEREBRAS_API_KEY
OPENROUTER_API_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_AI_TOKEN
```

## Dependencies

**Remove:**
```json
"@supabase/supabase-js"
```

**Add:**
```json
"next-auth": "^5",
"@auth/pg-adapter": "^1",
"@vercel/postgres": "^0.10",
"pg": "^8"
```

## Files Touched

**New:**
- `lib/auth.js`
- `lib/db.js`
- `lib/ai-providers.js`
- `lib/system-prompt.js`
- `app/api/auth/[...nextauth]/route.js`
- `migrations/001_initial.sql` — raw SQL, run via a `npm run db:migrate` script using `@vercel/postgres`

**Modified:**
- `app/layout.js` — wrap with `<SessionProvider>`
- `app/page.js` — landing caption
- `app/api/ai/route.js` — heavy refactor
- `app/api/projects/route.js` — Supabase → `lib/db.js`
- `app/api/projects/[id]/route.js` — same
- `components/AuthModal.jsx` — `signIn('google')`
- `components/Header.jsx` — `signOut()`, `session.user.image`
- `components/Sidebar.jsx` — remove `auth`/`multi-page` toggles, add regenerate/undo/style-preset/tone-preset, update `MODELS` array, empty-state + tooltip copy
- `components/PreviewFrame.jsx` — viewport toggle
- `context/AppContext.js` — drop Supabase, use `useSession`
- `package.json` — deps swap
- `.env.example` — var swap
- `README.md` — update setup instructions

**Deleted:**
- `app/api/config/route.js`
- `supabase/` directory (migrations + config)
- Any Supabase client helpers

## Phases

Implementation plan (to be produced next) should stage as:

- **Phase A — Auth + DB migration**
  Ship Supabase → Auth.js + Vercel Postgres. Users re-sign-in. Largest chunk. Independently shippable.

- **Phase B — Provider layer refactor**
  Remove Gemini. Add Cerebras + OpenRouter + Cloudflare. Generalize to `callOpenAICompatible`. Raise Groq cap. Update `MODELS` array. Independently shippable after A.

- **Phase C — Prompt + UI tools + copy**
  Rewrite `SYSTEM_PROMPT`. Add regenerate / undo / style-preset / tone-preset / viewport-toggle. Remove `auth`/`multi-page` feature toggles. Add expectations copy in three spots. Additive, low-risk. Ships last.

## Open Questions

None — all design decisions resolved during brainstorming.

## Risks & Accepted Tradeoffs

- **No rate limiting** — AI API keys exposed to unlimited abuse via `/api/ai`. Accepted per user decision; mitigation is provider-level quotas + Vercel platform DDoS protection.
- **Clean-slate cutover** — any existing Supabase users must re-sign-in; existing projects lost. Accepted (no prod users).
- **Model IDs drift** — provider consoles periodically rename/retire models. Mitigation is a single source of truth in the `MODELS` constant.
- **70B-class models only** — smaller/faster options not included; trades latency for output quality. Accepted.
