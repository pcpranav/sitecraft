# Phase A — Auth + DB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth + Supabase Postgres with Auth.js v5 (Google OAuth) + Vercel Postgres. End state: user signs in with Google, project CRUD works against Vercel Postgres, zero Supabase code or deps remain.

**Architecture:** Auth.js v5 handles OAuth + session cookies (database sessions in Vercel Postgres). API routes call `auth()` to get the session, scope queries with `WHERE user_id = ?`, and run parameterized SQL via `@vercel/postgres`. Client uses `next-auth/react` (`useSession`, `signIn`, `signOut`) — no more Authorization headers, cookies do it automatically.

**Tech Stack:** Next.js 16 App Router · React 19 · Auth.js v5 (`next-auth@5`) · `@auth/pg-adapter` · `@vercel/postgres` + `pg` · Vercel Postgres (Neon)

**Spec:** `docs/superpowers/specs/2026-04-25-supabase-removal-and-ai-refresh-design.md`

**Branch / worktree:** `feat/auth-db-migration` at `.worktrees/auth-db-migration/`

---

## Prerequisites (human steps — not plan tasks)

Before starting implementation, the user must provision external services:

1. **Vercel Postgres database**
   - Vercel dashboard → Storage → Create → Postgres (Neon)
   - Link to the sitecraft Vercel project
   - Copy `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` into local `.env.local`

2. **Google OAuth client**
   - Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://<production-domain>/api/auth/callback/google` (prod)
   - Copy Client ID and Client Secret into `.env.local` as `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

3. **Auth.js secret**
   - Run `openssl rand -base64 32`
   - Put result in `.env.local` as `AUTH_SECRET`

Implementation assumes these are set. If any are missing at a verification step, the plan tells you explicitly.

---

## File Structure

**New files:**
- `auth.js` — Auth.js v5 config (root). Exports `{ auth, signIn, signOut, handlers }`.
- `lib/db.js` — Vercel Postgres `sql` tag + typed project helpers.
- `app/api/auth/[...nextauth]/route.js` — re-exports Auth.js handlers.
- `migrations/001_initial.sql` — full schema.
- `scripts/db-migrate.mjs` — migration runner.
- `.env.example` — documents required env vars.
- `components/SessionProvider.jsx` — thin client wrapper around `next-auth/react`'s `SessionProvider` (needed because Auth.js's provider is a client component but `app/layout.js` is a server component).

**Modified files:**
- `package.json` — drop `@supabase/supabase-js`, add `next-auth@beta`, `@auth/pg-adapter`, `@vercel/postgres`, `pg`. Add migration script.
- `app/layout.js` — wrap in `<SessionProvider>`.
- `app/api/projects/route.js` — rewrite using `auth()` + `lib/db.js`.
- `app/api/projects/[id]/route.js` — same.
- `app/api/ai/route.js` — drop Supabase rate-limit code. Keep Gemini/Groq (Phase B will refactor).
- `components/AuthModal.jsx` — `signIn('google')` from `next-auth/react`.
- `components/Header.jsx` — `signOut()`, read session via `useSession()`, drop Authorization headers.
- `components/Sidebar.jsx` — drop Authorization headers and Supabase client usage.
- `context/AppContext.js` — drop Supabase client + auth listener; user comes from `useSession()`.
- `README.md` — update setup instructions.

**Deleted:**
- `app/api/config/route.js`
- `supabase/` directory (all migrations + any helpers)

**Testing approach:** No test harness exists. Each task verifies with `npm run build` (does it compile?) and, at integration checkpoints, manual E2E against a local Next.js dev server.

---

## Task 1: Swap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall Supabase, install Auth.js + Postgres stack**

```bash
cd /Users/pranav/Desktop/mini-projects/sitecraft/.worktrees/auth-db-migration
npm uninstall @supabase/supabase-js
npm install next-auth@beta @auth/pg-adapter @vercel/postgres pg
```

- [ ] **Step 2: Verify package.json**

Expected `dependencies` section after install:
```json
"dependencies": {
  "@auth/pg-adapter": "^1.x",
  "@vercel/postgres": "^0.10.x",
  "jszip": "^3.10.1",
  "next": "^16.2.2",
  "next-auth": "5.x.x",
  "pg": "^8.x",
  "react": "^19.2.4",
  "react-dom": "^19.2.4"
}
```

No `@supabase/supabase-js` anywhere.

- [ ] **Step 3: Add migration script to package.json**

Add to the `scripts` block:
```json
"db:migrate": "node scripts/db-migrate.mjs"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap Supabase deps for Auth.js + Vercel Postgres

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create the file**

Content:
```
# Auth.js
AUTH_SECRET=              # generate: openssl rand -base64 32
AUTH_GOOGLE_ID=           # Google Cloud Console OAuth 2.0 Client ID
AUTH_GOOGLE_SECRET=       # Google Cloud Console OAuth 2.0 Client Secret

# Vercel Postgres (auto-injected by Vercel integration; set locally for dev)
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# AI providers (Phase B will expand this; Phase A preserves current)
GEMINI_API_KEY=
GROQ_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with Auth.js + Postgres vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Write schema migration SQL

**Files:**
- Create: `migrations/001_initial.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Auth.js core tables (schema required by @auth/pg-adapter)
-- See: https://authjs.dev/getting-started/adapters/pg

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  id_token TEXT,
  scope TEXT,
  session_state TEXT,
  token_type TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image TEXT
);

-- App-owned projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  description TEXT DEFAULT '',
  pages JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared_css TEXT DEFAULT '',
  shared_js TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Note: Column names like `"userId"` are quoted because `@auth/pg-adapter` expects camelCase identifiers. PostgreSQL lowercases unquoted identifiers, so quoting preserves the exact case the adapter wants.

- [ ] **Step 2: Commit**

```bash
git add migrations/001_initial.sql
git commit -m "feat: add initial Postgres schema for Auth.js + projects

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Write migration runner script

**Files:**
- Create: `scripts/db-migrate.mjs`

- [ ] **Step 1: Create the script**

```javascript
// scripts/db-migrate.mjs
// Usage: npm run db:migrate
// Reads every .sql file in ./migrations in lexical order and executes each
// file as a single batch against POSTGRES_URL.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from '@vercel/postgres';

const MIGRATIONS_DIR = 'migrations';

async function loadDotEnv() {
  try {
    const content = await readFile('.env.local', 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

async function run() {
  await loadDotEnv();
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set. Add it to .env.local.');
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const content = await readFile(path, 'utf8');
    console.log(`Running ${file}...`);
    await sql.query(content);
    console.log(`  ✓ ${file}`);
  }
  console.log('All migrations applied.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the migration (requires POSTGRES_URL in .env.local)**

```bash
npm run db:migrate
```

Expected output:
```
Running 001_initial.sql...
  ✓ 001_initial.sql
All migrations applied.
```

If you see `POSTGRES_URL not set`, add it to `.env.local` from your Vercel Postgres dashboard and re-run.

- [ ] **Step 3: Commit**

```bash
git add scripts/db-migrate.mjs
git commit -m "feat: add db migration runner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create Auth.js config

**Files:**
- Create: `auth.js`

- [ ] **Step 1: Create the file**

```javascript
// auth.js
// Auth.js v5 configuration. Exports { auth, signIn, signOut, handlers }.
// `auth()` is callable from server components, route handlers, and middleware
// to retrieve the current session.

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { createPool } from '@vercel/postgres';

const pool = createPool();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: {
    strategy: 'database',
  },
  trustHost: true,
});
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. If it fails with "AUTH_SECRET missing", add it to `.env.local` and re-run.

- [ ] **Step 3: Commit**

```bash
git add auth.js
git commit -m "feat: configure Auth.js v5 with Google + pg adapter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire Auth.js route handler

**Files:**
- Create: `app/api/auth/[...nextauth]/route.js`

- [ ] **Step 1: Create the handler**

```javascript
// app/api/auth/[...nextauth]/route.js
// Re-exports Auth.js handlers for /api/auth/* routes:
//   /api/auth/signin, /api/auth/callback/google, /api/auth/signout,
//   /api/auth/session, /api/auth/providers, /api/auth/csrf
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/[...nextauth]/route.js
git commit -m "feat: wire Auth.js route handlers at /api/auth

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Create DB helpers module

**Files:**
- Create: `lib/db.js`

- [ ] **Step 1: Create the module**

```javascript
// lib/db.js
// Central DB access. Re-exports `sql` from @vercel/postgres plus typed
// helpers scoped by userId. Every mutation includes `user_id` so there's
// no way to touch another user's data through this module.

import { sql } from '@vercel/postgres';

const MAX_PROJECT_BYTES = 2 * 1024 * 1024;

function payloadSize(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj), 'utf8'); } catch { return 0; }
}

export async function listProjectsForUser(userId) {
  const { rows } = await sql`
    SELECT id, name, description, thumbnail, created_at, updated_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function getProjectForUser(userId, projectId) {
  const { rows } = await sql`
    SELECT id, user_id, name, description, pages, shared_css, shared_js,
           thumbnail, history, created_at, updated_at
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createProjectForUser(userId, data) {
  const { name, description, pages, shared_css, shared_js, history } = data;
  if (payloadSize({ pages, shared_css, shared_js, history }) > MAX_PROJECT_BYTES) {
    const err = new Error('Project too large (>2MB). Trim history or images.');
    err.status = 413;
    throw err;
  }
  const { rows } = await sql`
    INSERT INTO projects (user_id, name, description, pages, shared_css, shared_js, history)
    VALUES (
      ${userId},
      ${name || 'Untitled'},
      ${description || ''},
      ${JSON.stringify(pages || {})}::jsonb,
      ${shared_css || ''},
      ${shared_js || ''},
      ${JSON.stringify(history || [])}::jsonb
    )
    RETURNING id, user_id, name, description, pages, shared_css, shared_js,
              thumbnail, history, created_at, updated_at
  `;
  return rows[0];
}

export async function updateProjectForUser(userId, projectId, updates) {
  // Build dynamic SET clause using COALESCE so undefined values don't overwrite.
  // Raw sql template can't do dynamic column lists cleanly, so we run one
  // UPDATE per field that's actually provided.
  if (payloadSize(updates) > MAX_PROJECT_BYTES) {
    const err = new Error('Update too large (>2MB).');
    err.status = 413;
    throw err;
  }
  const allowed = ['name', 'description', 'pages', 'shared_css', 'shared_js', 'history', 'thumbnail'];
  const jsonbCols = new Set(['pages', 'history']);

  // Verify ownership first.
  const existing = await getProjectForUser(userId, projectId);
  if (!existing) return null;

  for (const col of allowed) {
    if (updates[col] === undefined) continue;
    const value = jsonbCols.has(col) ? JSON.stringify(updates[col]) : updates[col];
    if (jsonbCols.has(col)) {
      await sql.query(
        `UPDATE projects SET ${col} = $1::jsonb WHERE id = $2 AND user_id = $3`,
        [value, projectId, userId]
      );
    } else {
      await sql.query(
        `UPDATE projects SET ${col} = $1 WHERE id = $2 AND user_id = $3`,
        [value, projectId, userId]
      );
    }
  }

  return getProjectForUser(userId, projectId);
}

export async function deleteProjectForUser(userId, projectId) {
  const { rowCount } = await sql`
    DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  return rowCount > 0;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/db.js
git commit -m "feat: add DB helpers for user-scoped project CRUD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Rewrite /api/projects list+create

**Files:**
- Modify: `app/api/projects/route.js` (full rewrite)

- [ ] **Step 1: Replace entire file contents**

```javascript
// app/api/projects/route.js
// List & create projects — Next.js App Router
// Auth via Auth.js session cookie (no Authorization header needed).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listProjectsForUser, createProjectForUser } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const projects = await listProjectsForUser(session.user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error('Projects GET error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const project = await createProjectForUser(session.user.id, body);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('Projects POST error:', err);
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
```

Note: The CORS headers from the old version are dropped. These endpoints are only called same-origin from the sitecraft frontend; no cross-origin consumers exist.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/route.js
git commit -m "refactor: port /api/projects to Auth.js + Vercel Postgres

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Rewrite /api/projects/[id] CRUD

**Files:**
- Modify: `app/api/projects/[id]/route.js` (full rewrite)

- [ ] **Step 1: Replace entire file contents**

```javascript
// app/api/projects/[id]/route.js
// Single-project CRUD — Next.js App Router dynamic route.
// Auth via Auth.js session cookie.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getProjectForUser,
  updateProjectForUser,
  deleteProjectForUser,
} from '@/lib/db';

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const project = await getProjectForUser(session.user.id, id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    console.error('Project GET error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const project = await updateProjectForUser(session.user.id, id, body);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    console.error('Project PUT error:', err);
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const ok = await deleteProjectForUser(session.user.id, id);
    if (!ok) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Project DELETE error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/route.js
git commit -m "refactor: port /api/projects/[id] to Auth.js + Vercel Postgres

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Delete /api/config

**Files:**
- Delete: `app/api/config/route.js`

- [ ] **Step 1: Delete the file**

```bash
cd /Users/pranav/Desktop/mini-projects/sitecraft/.worktrees/auth-db-migration
rm app/api/config/route.js
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. (The client still calls `/api/config` — that becomes a dead fetch that 404s. We'll fix the client in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add -A app/api/config/
git commit -m "chore: remove /api/config route (Supabase anon keys no longer needed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Create SessionProvider wrapper

**Files:**
- Create: `components/SessionProvider.jsx`

Rationale: `next-auth/react`'s `SessionProvider` must run on the client, but `app/layout.js` is a server component. We wrap it in a thin client component.

- [ ] **Step 1: Create the file**

```javascript
// components/SessionProvider.jsx
'use client';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({ children }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SessionProvider.jsx
git commit -m "feat: add client-side SessionProvider wrapper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Wrap root layout in SessionProvider

**Files:**
- Modify: `app/layout.js`

- [ ] **Step 1: Replace file contents**

```javascript
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

export const metadata = {
  title: "Webcraft Studio",
  description: "AI-powered website builder",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.className}`}>
      <body>
        <SessionProvider>
          <AppProvider>{children}</AppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/layout.js
git commit -m "feat: wrap app in Auth.js SessionProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Refactor AppContext — drop Supabase, use useSession

**Files:**
- Modify: `context/AppContext.js` (full rewrite)

- [ ] **Step 1: Replace file contents**

```javascript
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const { data: session } = useSession();
  const user = session?.user || null;

  // Projects State
  const [projectId, setProjectId] = useState(null);
  const [projectsList, setProjectsList] = useState([]);

  // Chat / Conversation State
  const [chatMessages, setChatMessages] = useState([]);

  // Current website HTML (latest generated)
  const [currentHtml, setCurrentHtml] = useState('');

  // Feature toggles
  const [features, setFeatures] = useState([]);

  // Uploaded image URLs
  const [imageUrls, setImageUrls] = useState([]);

  // Legacy state for backward compat with cloud save
  const [pages, setPages] = useState({});
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [desc, setDesc] = useState('');
  const [history, setHistory] = useState([]);

  // UI State
  const [currentFile, setCurrentFile] = useState('index.html');
  const [view, setView] = useState('preview');
  const [theme, setTheme] = useState('dark');
  const [totalTokens, setTotalTokens] = useState(0);

  // Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Model selection
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('WEBCRAFT_MODEL') || 'gemini-2.5-flash';
    }
    return 'gemini-2.5-flash';
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('WEBCRAFT_THEME');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    try {
      const raw = sessionStorage.getItem('WEBCRAFT_PROJECT');
      if (raw) {
        const data = JSON.parse(raw);
        setPages(data.pages || {});
        setCss(data.css || '');
        setJs(data.js || '');
        setDesc(data.desc || '');
        setTotalTokens(data.totalTokens || 0);
        setCurrentHtml(data.currentHtml || '');
        setFeatures(data.features || []);
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('WEBCRAFT_PROJECT', JSON.stringify({
        pages, css, js, desc, totalTokens, currentHtml, features
      }));
    } catch(e) {}
  }, [pages, css, js, desc, totalTokens, currentHtml, features]);

  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setImageUrls([]);
    }
  }, [user]);

  const value = {
    user,
    projectId, setProjectId, projectsList, setProjectsList,
    pages, setPages, css, setCss, js, setJs, desc, setDesc, history, setHistory,
    currentFile, setCurrentFile, view, setView, theme, setTheme, totalTokens, setTotalTokens,
    isAuthOpen, setIsAuthOpen,
    sidebarOpen, setSidebarOpen,
    selectedModel, setSelectedModel,
    chatMessages, setChatMessages,
    currentHtml, setCurrentHtml,
    features, setFeatures,
    imageUrls, setImageUrls,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
```

Changes from original:
- Dropped: `supabaseClient`, the `/api/config` fetch, Supabase auth listener, `setUser`
- `user` now derived from `useSession()`
- Everything else preserved

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. Next.js will warn about `supabaseClient` not being in context when downstream components try to read it — that's fixed in Tasks 14–16.

- [ ] **Step 3: Commit**

```bash
git add context/AppContext.js
git commit -m "refactor: drop Supabase client from AppContext, use Auth.js session

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Refactor AuthModal for Auth.js signIn

**Files:**
- Modify: `components/AuthModal.jsx`

- [ ] **Step 1: Replace file contents**

```javascript
"use client";
import React, { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function AuthModal({ isOpen, onClose }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/studio' });
    } catch (err) {
      setError(err.message || 'Google Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-logo">W</div>
        <h3>Sign in</h3>
        <p className="modal-desc">
          Sign in to export projects and save to the cloud.
        </p>

        {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}

        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/AuthModal.jsx
git commit -m "refactor: AuthModal uses Auth.js signIn('google')

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Refactor Header — signOut + session-based avatar

**Files:**
- Modify: `components/Header.jsx`

Goal: Replace every Supabase-specific bit with Auth.js equivalents. Auth.js's session shape is `{ user: { id, name, email, image } }` — no nested `user_metadata`.

- [ ] **Step 1: Open and update the imports + signOut + session usage**

Make these specific edits to `components/Header.jsx`:

**Edit 1** — imports block (top of file):

Replace:
```javascript
import { useAppContext } from '@/context/AppContext';
import AuthModal from './AuthModal';
import JSZip from 'jszip';
```

With:
```javascript
import { useAppContext } from '@/context/AppContext';
import { signOut } from 'next-auth/react';
import AuthModal from './AuthModal';
import JSZip from 'jszip';
```

**Edit 2** — destructured context (inside `export default function Header() {`):

Replace:
```javascript
const {
    user, supabaseClient, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, setCss, setJs,
    setDesc, setHistory, setProjectId, projectId,
    sidebarOpen, setSidebarOpen, setCurrentFile,
    currentHtml, setCurrentHtml, setChatMessages, setFeatures, setImageUrls,
    chatMessages,
  } = useAppContext();
```

With:
```javascript
const {
    user, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, setCss, setJs,
    setDesc, setHistory, setProjectId, projectId,
    sidebarOpen, setSidebarOpen, setCurrentFile,
    currentHtml, setCurrentHtml, setChatMessages, setFeatures, setImageUrls,
    chatMessages,
  } = useAppContext();
```

**Edit 3** — fetchProjects trigger effect:

Replace:
```javascript
useEffect(() => {
    if (!menuOpen || !user || !supabaseClient) return;
    fetchProjects();
  }, [menuOpen, user, supabaseClient]);
```

With:
```javascript
useEffect(() => {
    if (!menuOpen || !user) return;
    fetchProjects();
  }, [menuOpen, user]);
```

**Edit 4** — fetchProjects itself:

Replace:
```javascript
const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok && data.projects) setProjects(data.projects);
    } catch (e) { console.warn('Failed to load projects:', e); }
    finally { setLoadingProjects(false); }
  };
```

With:
```javascript
const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (res.ok && data.projects) setProjects(data.projects);
    } catch (e) { console.warn('Failed to load projects:', e); }
    finally { setLoadingProjects(false); }
  };
```

**Edit 5** — loadProject:

Replace:
```javascript
const loadProject = async (proj) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch(`/api/projects/${proj.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
```

With:
```javascript
const loadProject = async (proj) => {
    try {
      const res = await fetch(`/api/projects/${proj.id}`);
```

**Edit 6** — deleteProject:

Replace:
```javascript
setDeletingId(projId);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch(`/api/projects/${projId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
```

With:
```javascript
setDeletingId(projId);
    try {
      const res = await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
```

**Edit 7** — user display helpers:

Replace:
```javascript
const getUserInitial = () => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getUserDisplay = () => {
    return user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  };
```

With:
```javascript
const getUserInitial = () => {
    const name = user?.name || user?.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getUserDisplay = () => {
    return user?.name || null;
  };
```

**Edit 8** — handleSignOut:

Replace:
```javascript
const handleSignOut = async () => {
    if (!supabaseClient) return;
    try {
      await supabaseClient.auth.signOut();
      clearAll();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };
```

With:
```javascript
const handleSignOut = async () => {
    try {
      clearAll();
      await signOut({ callbackUrl: '/' });
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };
```

**Edit 9** — avatar reference (already uses user-shape — fix path):

Replace:
```javascript
{user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="user-avatar-img" alt="" />
              ) : (
```

With:
```javascript
{user.image ? (
                <img src={user.image} className="user-avatar-img" alt="" />
              ) : (
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/Header.jsx
git commit -m "refactor: Header uses Auth.js signOut + session user shape

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Refactor Sidebar — drop Supabase auth header

**Files:**
- Modify: `components/Sidebar.jsx`

- [ ] **Step 1: Update destructured context**

Replace this line (around Sidebar.jsx:48):
```javascript
supabaseClient, projectId, setProjectId, user, totalTokens, setTotalTokens,
```

With:
```javascript
projectId, setProjectId, user, totalTokens, setTotalTokens,
```

- [ ] **Step 2: Update saveToCloud to drop Supabase session lookup**

Replace this block (around Sidebar.jsx:106-135):
```javascript
const saveToCloud = async (newPages, newCss, newJs, newHistory) => {
    if (!supabaseClient || !user) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };
      const payload = {
        name: desc || 'Untitled',
        description: desc,
        pages: newPages,
        shared_css: newCss,
        shared_js: newJs,
        history: newHistory,
      };
      let res;
      if (projectId) {
        res = await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/projects', { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      if (!projectId && resData.project?.id) setProjectId(resData.project.id);
    } catch(e) {
      console.warn("Save to cloud failed:", e);
    }
  };
```

With:
```javascript
const saveToCloud = async (newPages, newCss, newJs, newHistory) => {
    if (!user) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      const payload = {
        name: desc || 'Untitled',
        description: desc,
        pages: newPages,
        shared_css: newCss,
        shared_js: newJs,
        history: newHistory,
      };
      let res;
      if (projectId) {
        res = await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/projects', { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      if (!projectId && resData.project?.id) setProjectId(resData.project.id);
    } catch(e) {
      console.warn("Save to cloud failed:", e);
    }
  };
```

- [ ] **Step 3: Update /api/ai call to drop Supabase auth header block**

Replace this block (around Sidebar.jsx:183-190):
```javascript
// Auth header (if signed in) so server can rate-limit per user.
      const headers = { 'Content-Type': 'application/json' };
      try {
        if (supabaseClient) {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch {}
```

With:
```javascript
const headers = { 'Content-Type': 'application/json' };
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.jsx
git commit -m "refactor: Sidebar drops Supabase auth header (cookies handle it)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Strip Supabase rate-limit code from /api/ai

**Files:**
- Modify: `app/api/ai/route.js`

Goal: Remove every Supabase touchpoint. Keep Gemini/Groq generation intact — Phase B refactors providers. Also remove anonymous per-IP rate limit per spec ("no rate limiting, accepted risk").

- [ ] **Step 1: Open `app/api/ai/route.js` and find the Supabase + rate-limit helpers at the top**

Locate the block that imports `createClient` from `@supabase/supabase-js` and the `checkUserRate`, `checkAnonRate`, `resolveUser` helpers. Delete:
- The `import { createClient } ...` line
- Any `getSupabase()` helper
- The `checkUserRate`, `checkAnonRate`, `resolveUser` functions
- Any in-memory `anonRateMap`/`anonRateBuckets` or similar

- [ ] **Step 2: Remove the rate-limit block from POST handler**

Remove the entire block from `app/api/ai/route.js` around lines 163–172:

```javascript
// Rate limit
  const user = await resolveUser(req);
  if (user) {
    const r = await checkUserRate(user.id);
    if (!r.ok) return NextResponse.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429, headers: { ...CORS, 'Retry-After': String(r.retryAfter) } });
  } else {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon';
    const r = checkAnonRate(ip);
    if (!r.ok) return NextResponse.json({ error: 'Anonymous limit reached. Sign in for more generations.' }, { status: 429, headers: { ...CORS, 'Retry-After': String(r.retryAfter) } });
  }
```

Delete it entirely. No replacement.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/route.js
git commit -m "refactor: remove Supabase rate-limiting from /api/ai

Both per-user (Supabase table) and per-IP (in-memory) limits removed
per spec. Accepted risk: unlimited AI-key exposure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Delete the supabase/ directory

**Files:**
- Delete: `supabase/` (entire directory)

- [ ] **Step 1: Delete**

```bash
cd /Users/pranav/Desktop/mini-projects/sitecraft/.worktrees/auth-db-migration
rm -rf supabase/
```

- [ ] **Step 2: Confirm no Supabase references remain**

```bash
grep -rn "supabase\|Supabase\|@supabase" --include="*.js" --include="*.jsx" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v package-lock
```

Expected: no output (or only matches inside `docs/` or committed historical files you may leave alone).

- [ ] **Step 3: Commit**

```bash
git add -A supabase/
git commit -m "chore: delete supabase/ migrations directory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Update README with new setup steps

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README to preserve non-setup sections**

```bash
cat README.md
```

- [ ] **Step 2: Replace any "Supabase setup" section with an "Auth + DB setup" section**

Add or replace with:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for Auth.js + Vercel Postgres setup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: End-to-end manual verification

**Files:** (no code changes — verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/pranav/Desktop/mini-projects/sitecraft/.worktrees/auth-db-migration
npm run dev
```

Expected: dev server starts on http://localhost:3000.

- [ ] **Step 2: Verify landing page loads**

Open http://localhost:3000. Expected: no console errors referencing Supabase, `/api/config`, or missing env vars.

- [ ] **Step 3: Verify sign-in flow**

Navigate to `/studio`. Click "Sign in". Expected: redirects to Google OAuth consent screen. Complete sign-in. Expected: redirects back to `/studio` with your name + avatar visible in the header.

- [ ] **Step 4: Verify user row created**

Via psql or Vercel's DB console:

```sql
SELECT id, email, name FROM users;
SELECT provider, "providerAccountId" FROM accounts;
SELECT id, "userId", expires FROM sessions;
```

Expected: one row in each, matching your Google account.

- [ ] **Step 5: Verify project create**

In `/studio`, enter a prompt and generate a site. Expected: site renders, and in the DB:

```sql
SELECT id, user_id, name, description FROM projects;
```

Expected: one row with your user_id.

- [ ] **Step 6: Verify project list + reload**

Click the user pill → open the menu → verify the project appears in "Saved projects".

Refresh the page. Sign-in persists (database session cookie). Project still in list.

- [ ] **Step 7: Verify cross-user isolation**

In an incognito window, sign in with a *different* Google account. Open the project list. Expected: empty — you should NOT see the first user's projects.

- [ ] **Step 8: Verify project delete**

Back in the first user's window, delete the project. Expected: removed from list and from DB.

- [ ] **Step 9: Verify sign-out**

Sign out. Expected: redirects to landing page. The session cookie is cleared. Attempting to call `/api/projects` returns 401.

- [ ] **Step 10: Verify AI generation still works**

(Requires `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env.local`.) Sign back in, generate a site, confirm it streams back and renders.

- [ ] **Step 11: Write the verification result**

If every step passed, commit a completion marker:

```bash
git commit --allow-empty -m "chore: Phase A verified end-to-end

Google sign-in + session persistence: OK
Project CRUD: OK
Cross-user isolation: OK
AI generation: OK

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If any step failed, diagnose and fix before marking Phase A complete.

---

## Phase A Completion Checklist

- [ ] All 20 tasks completed and committed
- [ ] `npm run build` passes
- [ ] No `supabase` or `@supabase` references remain in source (grep confirms)
- [ ] Manual E2E verification (Task 20) all green
- [ ] Phase B plan ready to be written next

## Spec Coverage Map

| Spec section | Task(s) |
|---|---|
| Remove Supabase Auth | 1, 14 |
| Auth.js v5 config | 5, 6 |
| Vercel Postgres + raw SQL | 1, 7 |
| Schema (users/accounts/sessions/verification_token/projects) | 3 |
| App-level authorization | 7, 8, 9 |
| Rate limiting removed | 17 |
| Clean slate data migration | (implicit — no data to migrate) |
| Delete /api/config | 10 |
| Drop @supabase/supabase-js | 1 |
| Drop profiles table | 3 (not created) |
| Drop generations table | 3 (not created) |
| Drop rate_limits table | 3 (not created) |
| .env.example with new vars | 2 |
| README update | 19 |
| SessionProvider wiring | 11, 12 |
| AuthModal uses signIn | 14 |
| Header uses signOut + session.user.image | 15 |
| AppContext uses useSession | 13 |
| Sidebar drops supabaseClient | 16 |
| user_id is integer (pg adapter default) | 3 |
