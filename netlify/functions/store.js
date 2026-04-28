// Netlify Blobs storage — banco de dados compartilhado da equipe
// GET /.netlify/functions/store?key=NOME → retorna valor (json ou null)
// GET /.netlify/functions/store?batch=1&keys=a,b,c → retorna {a:..., b:..., c:...}
// POST /.netlify/functions/store?key=NOME → salva o body (JSON)
// Requer: header `Authorization: Bearer <TEAM_PASSWORD>` (se TEAM_PASSWORD env var estiver setada)

const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function authReject(event) {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) return null;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token !== expected) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'unauthorized' })
    };
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const reject = authReject(event);
  if (reject) return reject;

  let store;
  try {
    const blobsConfig = { name: 'envolve-data', consistency: 'strong' };
    if (process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
      blobsConfig.siteID = process.env.NETLIFY_BLOBS_SITE_ID;
      blobsConfig.token = process.env.NETLIFY_BLOBS_TOKEN;
    }
    store = getStore(blobsConfig);
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Blobs não disponível: ' + e.message })
    };
  }

  const params = event.queryStringParameters || {};

  // ===== GET =====
  if (event.httpMethod === 'GET') {
    // Batch (várias chaves de uma vez)
    if (params.batch) {
      const keys = (params.keys || '').split(',').filter(Boolean);
      const result = {};
      await Promise.all(keys.map(async (k) => {
        try {
          const v = await store.get(k, { type: 'json' });
          if (v !== null && v !== undefined) result[k] = v;
        } catch (e) { /* skip */ }
      }));
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }

    // Single key
    if (params.key) {
      try {
        const v = await store.get(params.key, { type: 'json' });
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(v || null)
        };
      } catch (e) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(null)
        };
      }
    }

    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'missing ?key= or ?batch=1&keys=...' })
    };
  }

  // ===== POST =====
  if (event.httpMethod === 'POST') {
    if (!params.key) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'missing ?key=' })
      };
    }
    try {
      const body = event.body ? JSON.parse(event.body) : null;
      await store.setJSON(params.key, body);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'set failed: ' + e.message })
      };
    }
  }

  // ===== DELETE =====
  if (event.httpMethod === 'DELETE') {
    if (!params.key) {
      return { statusCode: 400, headers: corsHeaders, body: '{"error":"missing key"}' };
    }
    try {
      await store.delete(params.key);
      return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: '{"ok":true}' };
    } catch (e) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers: corsHeaders, body: '{"error":"method not allowed"}' };
};
