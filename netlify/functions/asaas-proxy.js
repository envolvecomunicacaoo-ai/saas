// Proxy serverless pra Asaas API V3
// Contorna CORS chamando do servidor Netlify
// Recebe headers: x-asaas-key, x-asaas-env (production|sandbox)
// Recebe path via query ?path=

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

  const apiKey = event.headers['x-asaas-key'] || event.headers['X-Asaas-Key'];
  const env = event.headers['x-asaas-env'] || event.headers['X-Asaas-Env'] || 'production';
  const path = event.queryStringParameters?.path || '/';

  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing X-Asaas-Key header' })
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
