// Proxy serverless pra Asaas API V3
// Modo equipe: se ASAAS_KEY estiver nas env vars, usa ela (ignora header).
// ASAAS_ENV opcional ('production' default ou 'sandbox').
// Modo individual: cliente manda X-Asaas-Key e X-Asaas-Env.
//
// Health probe: ?path=__teamcheck__ → { teamMode: bool, env: string }

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Asaas-Key, X-Asaas-Env',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const expected = process.env.TEAM_PASSWORD;
  if (expected) {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token !== expected) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }
  }

  const envKey = process.env.ASAAS_KEY;
  const envEnv = process.env.ASAAS_ENV || 'production';
  const teamMode = !!envKey;

  const path = event.queryStringParameters?.path || '/';

  if (path === '__teamcheck__') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMode, env: teamMode ? envEnv : null })
    };
  }

  const apiKey = teamMode ? envKey : (event.headers['x-asaas-key'] || event.headers['X-Asaas-Key']);
  const env = teamMode ? envEnv : (event.headers['x-asaas-env'] || event.headers['X-Asaas-Env'] || 'production');

  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing X-Asaas-Key header (or ASAAS_KEY env var)' })
    };
  }

  const base = env === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
  const url = base + path;

  try {
    const fetchOpts = {
      method: event.httpMethod,
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'envolve-app'
      }
    };
    if (event.httpMethod !== 'GET' && event.body) {
      fetchOpts.body = event.body;
    }

    const res = await fetch(url, fetchOpts);
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        ...corsHeaders,
        'Content-Type': res.headers.get('content-type') || 'application/json'
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy error: ' + err.message })
    };
  }
};
