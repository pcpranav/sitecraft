# Sitecraft v2 — AI Website Builder

An AI-powered website builder. Describe any idea and get a complete, mobile-responsive website with HTML, CSS, and JS — ready to iterate, export, or deploy.

## Features
- AI generation via Gemini 2.5 / 3 Flash and Groq Llama 3.3
- Conversational refinement with chat history
- Mobile-first generated sites (touch targets, viewport meta, responsive layouts enforced)
- Cloud project save (Vercel Postgres) with delete + history clear
- ZIP export (drag into Vercel/Netlify/anywhere static)

## Auth + Database setup

This project uses **Auth.js v5** (Google OAuth) and **Vercel Postgres**.

### 1. Provision Vercel Postgres

- In the Vercel dashboard, go to your project → Storage → Create → Postgres
- Once created, copy the `POSTGRES_URL` values into `.env.local`

### 2. Create Google OAuth credentials

- Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
- Application type: Web
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://<your-prod-domain>/api/auth/callback/google`
- Copy the Client ID and Secret

### 3. Configure `.env.local`

Copy `.env.example` to `.env.local` and fill in:

```
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<from Google Console>
AUTH_GOOGLE_SECRET=<from Google Console>
POSTGRES_URL=<from Vercel>
POSTGRES_URL_NON_POOLING=<from Vercel>
GEMINI_API_KEY=<optional for AI>
GROQ_API_KEY=<optional for AI>
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start dev server

```bash
npm run dev
```

Sign in with Google at http://localhost:3000/studio.

## Deployment (Vercel)
1. Push this repo to GitHub.
2. Import the repo in Vercel (`vercel.com/new`). It autodetects Next.js — accept defaults.
3. Add env vars from `.env.example` in **Project Settings → Environment Variables**. Make sure to also add the production Google OAuth redirect URI in the Google Cloud Console.
4. Push to `main` to auto-deploy.
