// app/api/projects/[id]/route.js
// Single project CRUD — Next.js App Router dynamic route

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
};

const MAX_PROJECT_BYTES = 2 * 1024 * 1024;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase not configured (SUPABASE_SERVICE_KEY required)');
  return createClient(url, key);
}

async function getUser(req) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    const { id } = await params;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: CORS });
    return NextResponse.json({ project: data }, { headers: CORS });
  } catch (err) {
    console.error('Project GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}

export async function PUT(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    const { id } = await params;
    const body = await req.json();
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

    try {
      if (Buffer.byteLength(JSON.stringify(updates), 'utf8') > MAX_PROJECT_BYTES) {
        return NextResponse.json({ error: 'Update too large (>2MB).' }, { status: 413, headers: CORS });
      }
    } catch {}

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ project: data }, { headers: CORS });
  } catch (err) {
    console.error('Project PUT error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    const { id } = await params;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ deleted: true }, { headers: CORS });
  } catch (err) {
    console.error('Project DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}
