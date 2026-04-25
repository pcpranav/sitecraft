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
