// app/api/projects/route.js
// List & create projects — Next.js App Router

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
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

export async function GET(req) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, thumbnail, is_deployed, deploy_url, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ projects: data }, { headers: CORS });
  } catch (err) {
    console.error('Projects GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}

export async function POST(req) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    const body = await req.json();
    const { name, description, pages, shared_css, shared_js, history } = body;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name || 'Untitled',
        description: description || '',
        pages: pages || {},
        shared_css: shared_css || '',
        shared_js: shared_js || '',
        history: history || [],
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ project: data }, { status: 201, headers: CORS });
  } catch (err) {
    console.error('Projects POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS });
  }
}
