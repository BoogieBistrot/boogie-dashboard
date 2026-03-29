// netlify/functions/auth.js

const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const PASSWORD = process.env.DASHBOARD_PASSWORD;
  const SECRET   = process.env.DASHBOARD_SECRET || 'boogie-secret-key';

  let data;
  try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { password } = data;

  if (!password || password !== PASSWORD) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: 'Password errata' })
    };
  }

  // Genera token: hash di password + secret + data odierna (valido 24h)
  const today = new Date().toISOString().split('T')[0];
  const token = crypto
    .createHmac('sha256', SECRET)
    .update(PASSWORD + today)
    .digest('hex');

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, token })
  };
};
