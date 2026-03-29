// netlify/functions/salva-feedback.js
// Riceve il form feedback negativo e salva su Airtable

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_FEEDBACK = process.env.AIRTABLE_FEEDBACK || 'Feedback';

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: 'Invalid JSON' };
  }

  const { nome, dataPrenotazione, voto, commento } = data;

  if (!commento) {
    return { statusCode: 400, headers, body: 'Commento obbligatorio' };
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_FEEDBACK)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Nome':               nome || 'Anonimo',
            'Data prenotazione':  dataPrenotazione || '',
            'Voto':               voto ? parseInt(voto) : null,
            'Commento':           commento,
            'Data invio':         new Date().toISOString().split('T')[0],
          }
        })
      }
    );

    if (!res.ok) {
      console.error('Airtable error:', await res.text());
      return { statusCode: 500, headers, body: 'Errore salvataggio' };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: 'Errore server' };
  }
};
