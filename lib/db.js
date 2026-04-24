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
  if (payloadSize(updates) > MAX_PROJECT_BYTES) {
    const err = new Error('Update too large (>2MB).');
    err.status = 413;
    throw err;
  }
  const allowed = ['name', 'description', 'pages', 'shared_css', 'shared_js', 'history', 'thumbnail'];
  const jsonbCols = new Set(['pages', 'history']);

  const existing = await getProjectForUser(userId, projectId);
  if (!existing) return null;

  const setClauses = [];
  const params = [];
  let i = 1;
  for (const col of allowed) {
    if (updates[col] === undefined) continue;
    const value = jsonbCols.has(col) ? JSON.stringify(updates[col]) : updates[col];
    const cast = jsonbCols.has(col) ? '::jsonb' : '';
    setClauses.push(`${col} = $${i}${cast}`);
    params.push(value);
    i++;
  }

  if (setClauses.length === 0) return existing;

  params.push(projectId, userId);
  await sql.query(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${i} AND user_id = $${i + 1}`,
    params
  );

  return getProjectForUser(userId, projectId);
}

export async function deleteProjectForUser(userId, projectId) {
  const { rowCount } = await sql`
    DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  return rowCount > 0;
}
