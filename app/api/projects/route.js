// netlify/functions/projects.mjs
// CRUD API for user projects — backed by Supabase

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  _supabase = createClient(url, key);
  return _supabase;
}

async function getUser(req) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function handleRequest(req, ctx) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const supabase = getSupabase();
    const url = new URL(req.url);
    const pathParts = url.pathname.replace('/api/projects', '').split('/').filter(Boolean);
    const projectId = pathParts[0] || null;

    // GET /api/projects — list user's projects
    if (req.method === 'GET' && !projectId) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, thumbnail, is_deployed, deploy_url, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return json({ projects: data });
    }

    // GET /api/projects/:id — get single project with full data
    if (req.method === 'GET' && projectId) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();
      if (error || !data) return json({ error: 'Project not found' }, 404);
      return json({ project: data });
    }

    // POST /api/projects — create new project
    if (req.method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch (err) {
        return json({ error: 'Invalid JSON payload' }, 400);
      }
      const { name, description, pages, shared_css, shared_js, history } = body;
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: name || 'Untitled',
          description: description || '',
          pages: pages || {},
          shared_css: shared_css || '',
          shared_js: shared_js || '',
        })
        .select()
        .single();
      if (error) throw error;
      return json({ project: data }, 201);
    }

    // PUT /api/projects/:id — update project
    if (req.method === 'PUT' && projectId) {
      let body;
      try {
        body = await req.json();
      } catch (err) {
        return json({ error: 'Invalid JSON payload' }, 400);
      }
      const updates = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.pages !== undefined) updates.pages = body.pages;
      if (body.shared_css !== undefined) updates.shared_css = body.shared_css;
      if (body.shared_js !== undefined) updates.shared_js = body.shared_js;
      if (body.history !== undefined) updates.history = body.history;
      if (body.is_deployed !== undefined) updates.is_deployed = body.is_deployed;
      if (body.deploy_url !== undefined) updates.deploy_url = body.deploy_url;
      if (body.thumbnail !== undefined) updates.thumbnail = body.thumbnail;

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return json({ project: data });
    }

    // DELETE /api/projects/:id — delete project
    if (req.method === 'DELETE' && projectId) {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('Projects API error:', err);
    return json({ error: err.message || 'Internal error' }, 500);
  }
};

export const config = { path: ['/api/projects', '/api/projects/*'] };


export async function GET(req, ctx) { return handleRequest(req, ctx); }
export async function POST(req, ctx) { return handleRequest(req, ctx); }
export async function PUT(req, ctx) { return handleRequest(req, ctx); }
export async function DELETE(req, ctx) { return handleRequest(req, ctx); }
export async function OPTIONS(req, ctx) { return handleRequest(req, ctx); }