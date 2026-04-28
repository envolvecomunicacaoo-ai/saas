// Proxy serverless pra Kommo CRM API V4
// Contorna CORS chamando do servidor Netlify ao invés do browser
// Recebe headers: x-kommo-token, x-kommo-subdomain
// Recebe path: /api/v4/...  via query ?path=

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Kommo-Token, X-Kommo-Subdomain, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const token = event.headers['x-kommo-token'] || event.headers['X-Kommo-Token'];
  const subdomain = event.headers['x-kommo-subdomain'] || event.headers['X-Kommo-Subdomain'];
  const path = event.queryStringParameters?.path || '/';

  if (!token || !subdomain) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing X-Kommo-Token or X-Kommo-Subdomain headers' })
    };
  }

  // Sanitiza subdomínio
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
