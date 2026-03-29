// netlify/functions/cancella-prenotazione.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni';

  let data;
  try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { id } = data;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'ID mancante' }) };

  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'Stato': 'Cancellata' } })
    });

    if (!res.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
