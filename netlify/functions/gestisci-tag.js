// netlify/functions/gestisci-tag.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const { verifyToken } = require('./verifyToken');
  if (!verifyToken(event)) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Tag`;
  const AT_HEADERS = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'POST') {
    let data;
    try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }
    const { nome } = data;
    if (!nome) return { statusCode: 400, headers, body: 'Nome obbligatorio' };

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: AT_HEADERS,
      body: JSON.stringify({ fields: { 'Nome': nome } })
    });
    const result = await res.json();
    return { statusCode: res.ok ? 200 : 500, headers, body: JSON.stringify({ success: res.ok, id: result.id, nome }) };
  }

  if (event.httpMethod === 'DELETE') {
    const { id } = event.queryStringParameters || {};
    if (!id) return { statusCode: 400, headers, body: 'ID mancante' };

    const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE', headers: AT_HEADERS });
    return { statusCode: res.ok ? 200 : 500, headers, body: JSON.stringify({ success: res.ok }) };
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
