// netlify/functions/get-tag.js
// Legge le opzioni del campo multi-select "Tag" dalla tabella Prenotazioni via Airtable Meta API

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni';

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );
    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Meta API error: ' + res.status }) };

    const json = await res.json();
    const tabella = json.tables.find(t => t.name === AIRTABLE_TABLE);
    if (!tabella) return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Tabella non trovata' }) };

    const campoTag = tabella.fields.find(f => f.name === 'Tag');
    if (!campoTag) return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Campo Tag non trovato' }) };

    const tag = (campoTag.options?.choices || []).map(c => ({ id: c.id, nome: c.name }));
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tag }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
