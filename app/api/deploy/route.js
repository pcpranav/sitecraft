// app/api/deploy/route.js
// Deploy generated site to Vercel via the v13/deployments API.
// Accepts a multipart upload with a `zip` (ZIP of the static site) or a
// raw `html` string. Files are sent inline to the Vercel API.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 10 * 1024 * 1024;

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

function slugify(s) {
  return (s || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site';
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
    return NextResponse.json({ error: 'Sign in to deploy your site.' }, { status: 401, headers: CORS });
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    return NextResponse.json(
      { error: 'Deploy not configured. Set VERCEL_TOKEN in environment.' },
      { status: 500, headers: CORS }
    );
  }

  try {
    const formData = await req.formData();
    const zipFile = formData.get('zip');
    const rawHtml = formData.get('html');
    const projectName = formData.get('project_name') || 'sitecraft-site';

    let files = [];

    if (zipFile && typeof zipFile !== 'string') {
      if (zipFile.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Deploy bundle exceeds 10MB.' }, { status: 400, headers: CORS });
      }
      const buf = Buffer.from(await zipFile.arrayBuffer());
      const zip = await JSZip.loadAsync(buf);
      const entries = Object.values(zip.files).filter(f => !f.dir);
      for (const entry of entries) {
        const data = await entry.async('uint8array');
        files.push({ file: entry.name, data: Buffer.from(data).toString('base64'), encoding: 'base64' });
      }
    } else if (typeof rawHtml === 'string' && rawHtml.length > 0) {
      if (Buffer.byteLength(rawHtml, 'utf8') > MAX_BYTES) {
        return NextResponse.json({ error: 'HTML payload exceeds 10MB.' }, { status: 400, headers: CORS });
      }
      files.push({ file: 'index.html', data: rawHtml });
    } else {
      return NextResponse.json({ error: 'Provide a zip file or html string.' }, { status: 400, headers: CORS });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Empty deploy bundle.' }, { status: 400, headers: CORS });
    }

    const teamId = process.env.VERCEL_TEAM_ID;
    const url = `https://api.vercel.com/v13/deployments${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`;

    const deployRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: process.env.VERCEL_PROJECT_NAME || slugify(projectName),
        files,
        target: 'production',
        projectSettings: { framework: null },
      }),
    });

    let deployData;
    try { deployData = await deployRes.json(); } catch {
      throw new Error(`Vercel returned invalid JSON (${deployRes.status})`);
    }

    if (!deployRes.ok) {
      const msg = deployData?.error?.message || deployData?.message || `Vercel deploy failed (${deployRes.status})`;
      throw new Error(msg);
    }

    const host = deployData.alias?.[0] || deployData.url;
    if (!host) {
      throw new Error('Vercel did not return a deploy URL.');
    }
    const deployUrl = host.startsWith('http') ? host : `https://${host}`;

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
      state: deployData.readyState || deployData.state,
    }, { headers: CORS });
  } catch (err) {
    console.error('Deploy error:', err);
    return NextResponse.json(
      { error: err.message || 'Deploy failed' },
      { status: 500, headers: CORS }
    );
  }
}
