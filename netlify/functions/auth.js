// auth.js — valida senha da equipe
// POST /.netlify/functions/auth  body: {"password":"..."}
// → 200 { ok: true, token } se senha correta
// → 401 se errada
// → 503 se TEAM_PASSWORD env var não estiver configurada

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'method not allowed' })
    };
  }

  const expected = process.env.TEAM_PASSWORD;
  if (!expected) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'TEAM_PASSWORD não configurada no Netlify' })
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { body = {}; }

  if (!body.password || body.password !== expected) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'senha inválida' })
    };
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, token: expected })
  };
};
