// Proxy serverless pra Kommo CRM API V4
// Modo equipe: se KOMMO_TOKEN + KOMMO_SUBDOMAIN estiverem nas env vars, usa elas
// (ignora headers do cliente). Modo individual: cliente manda X-Kommo-Token
// e X-Kommo-Subdomain.
//
// Health probe: ?path=__teamcheck__ → { teamMode: bool, subdomain: string|null }

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Kommo-Token, X-Kommo-Subdomain, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const expected = process.env.TEAM_PASSWORD;
  if (expected) {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const reqToken = auth.replace(/^Bearer\s+/i, '').trim();
    if (reqToken !== expected) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }
  }

  const envToken = process.env.KOMMO_TOKEN;
  const envSub = process.env.KOMMO_SUBDOMAIN;
  const teamMode = !!(envToken && envSub);

  const path = event.queryStringParameters?.path || '/';

  // Health probe — frontend usa pra decidir UI
  if (path === '__teamcheck__') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMode, subdomain: teamMode ? envSub : null })
    };
  }

  const token = teamMode ? envToken : (event.headers['x-kommo-token'] || event.headers['X-Kommo-Token']);
  const subdomain = teamMode ? envSub : (event.headers['x-kommo-subdomain'] || event.headers['X-Kommo-Subdomain']);

  if (!token || !subdomain) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing X-Kommo-Token or X-Kommo-Subdomain headers (or KOMMO_TOKEN/KOMMO_SUBDOMAIN env vars)' })
    };
  }

  const cleanSub = subdomain.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  if (!cleanSub) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid subdomain' })
    };
  }

  const url = `https://${cleanSub}.kommo.com/api/v4${path}`;

  try {
    const fetchOpts = {
      method: event.httpMethod,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
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
