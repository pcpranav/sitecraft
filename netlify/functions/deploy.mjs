// netlify/functions/deploy.mjs
// Receives a ZIP blob and deploys it to the Netlify site via the Netlify API.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!netlifyToken || !siteId) {
    return new Response(JSON.stringify({ error: 'Deploy not configured. Set NETLIFY_ACCESS_TOKEN and NETLIFY_SITE_ID.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse multipart form — get the zip file
    const formData = await req.formData();
    const zipFile = formData.get('zip');

    if (!zipFile) {
      return new Response(JSON.stringify({ error: 'No zip file provided' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const zipBuffer = await zipFile.arrayBuffer();

    // Deploy to Netlify via their deploy API
    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        'Content-Type': 'application/zip',
      },
      body: zipBuffer,
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      throw new Error(deployData.message || `Netlify deploy failed (${deployRes.status})`);
    }

    return new Response(JSON.stringify({
      url: deployData.ssl_url || deployData.deploy_ssl_url || deployData.url,
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
