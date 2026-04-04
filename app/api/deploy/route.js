// netlify/functions/deploy.mjs
// Receives a ZIP blob and deploys it to the Netlify site via the Netlify API.
// Now with Supabase JWT auth verification.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

async function getUser(req) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

async function handleRequest(req, ctx) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Auth check — allow admin token OR authenticated user
  const adminToken = req.headers.get('x-admin-token') || '';
  const envAdmin = process.env.ADMIN_TOKEN;
  const user = await getUser(req);
  const isAdmin = envAdmin && adminToken === envAdmin;

  if (!user && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Sign in to deploy your site.' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!netlifyToken || !siteId) {
    return new Response(JSON.stringify({ error: 'Deploy not configured. Set NETLIFY_ACCESS_TOKEN and NETLIFY_SITE_ID.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const zipFile = formData.get('zip');

    if (!zipFile) {
      return new Response(JSON.stringify({ error: 'No zip file provided' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (zipFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Deploy zip exceeds 10MB limit. Decrease your assets size.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const zipBuffer = await zipFile.arrayBuffer();

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        'Content-Type': 'application/zip',
      },
      body: zipBuffer,
    });

    let deployData;
    try {
      deployData = await deployRes.json();
    } catch {
      throw new Error(`Netlify returned invalid JSON (${deployRes.status})`);
    }

    if (!deployRes.ok) {
      throw new Error(deployData.message || `Netlify deploy failed (${deployRes.status})`);
    }

    const deployUrl = deployData.ssl_url || deployData.deploy_ssl_url || deployData.url;

    // Update project deploy status if project_id was provided
    if (user) {
      const projectId = formData.get('project_id');
      if (projectId) {
        const supabase = getSupabase();
        if (supabase) {
          await supabase
            .from('projects')
            .update({ is_deployed: true, deploy_url: deployUrl })
            .eq('id', projectId)
            .eq('user_id', user.id);
        }
      }
    }

    return new Response(JSON.stringify({
      url: deployUrl,
      deploy_id: deployData.id,
      state: deployData.state,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Deploy error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Deploy failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/deploy' };


export async function GET(req, ctx) { return handleRequest(req, ctx); }
export async function POST(req, ctx) { return handleRequest(req, ctx); }
export async function PUT(req, ctx) { return handleRequest(req, ctx); }
export async function DELETE(req, ctx) { return handleRequest(req, ctx); }
export async function OPTIONS(req, ctx) { return handleRequest(req, ctx); }