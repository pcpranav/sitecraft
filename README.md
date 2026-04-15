# Sitecraft v2 — AI Website Builder

An AI-powered website builder. Describe any idea and get a complete, mobile-responsive website with HTML, CSS, and JS — ready to iterate, export, or deploy.

## Features
- AI generation via Gemini 2.5 / 3 Flash and Groq Llama 3.3
- Conversational refinement with chat history
- Mobile-first generated sites (touch targets, viewport meta, responsive layouts enforced)
- One-click Vercel deploy
- Cloud project save (Supabase) with delete + history clear
- ZIP export

## Deployment (Vercel)
1. Push this repo to GitHub.
2. Import the repo in Vercel (`vercel.com/new`). It autodetects Next.js — accept defaults.
3. Add env vars from `.env.example` in **Project Settings → Environment Variables**.
4. Push to `main` to auto-deploy.

### Migrating from Netlify
Replace `NETLIFY_ACCESS_TOKEN` / `NETLIFY_SITE_ID` with `VERCEL_TOKEN` (and optionally `VERCEL_TEAM_ID`, `VERCEL_PROJECT_NAME`). The `netlify.toml` is no longer used; `vercel.json` configures function timeouts.

## Local Development
```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```
Open http://localhost:3000.

## Database
Run the SQL files in `supabase/migrations/` in order via the Supabase SQL editor.
