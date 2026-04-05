// app/api/deploy/route.js
// Deploy ZIP to Netlify — Next.js App Router

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  const adminToken = req.headers.get('x-admin-token') || '';
  const envAdmin = process.env.ADMIN_TOKEN;
  const user = await getUser(req);
  const isAdmin = envAdmin && adminToken === envAdmin;

  if (!user && !isAdmin) {
    return NextResponse.json(
      { error: 'Sign in to deploy your site.' },
      { status: 401, headers: CORS }
    );
  }

  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!netlifyToken || !siteId) {
    return NextResponse.json(
      { error: 'Deploy not configured. Set NETLIFY_ACCESS_TOKEN and NETLIFY_SITE_ID.' },
      { status: 500, headers: CORS }
    );
  }

  try {
    const formData = await req.formData();
    const zipFile = formData.get('zip');

    if (!zipFile) {
      return NextResponse.json({ error: 'No zip file provided' }, { status: 400, headers: CORS });
    }

    if (zipFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Deploy zip exceeds 10MB limit.' },
        { status: 400, headers: CORS }
      );
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
    try { deployData = await deployRes.json(); } catch {
      throw new Error(`Netlify returned invalid JSON (${deployRes.status})`);
    }

    if (!deployRes.ok) {
      throw new Error(deployData.message || `Netlify deploy failed (${deployRes.status})`);
    }

    const deployUrl = deployData.ssl_url || deployData.deploy_ssl_url || deployData.url;

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

    return NextResponse.json({
      url: deployUrl,
      deploy_id: deployData.id,
      state: deployData.state,
    }, { headers: CORS });
  } catch (err) {
    console.error('Deploy error:', err);
    return NextResponse.json(
      { error: err.message || 'Deploy failed' },
      { status: 500, headers: CORS }
    );
  }
}
