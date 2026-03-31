// netlify/functions/get-orari.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const { verifyToken } = require('./verifyToken');
  if (!verifyToken(event)) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_ORARI   = process.env.AIRTABLE_ORARI || 'Orari';

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_ORARI)}`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );

    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };

    const json = await res.json();
    const orari = (json.records || []).map(r => ({
      id:         r.id,
      giorno:     Array.isArray(r.fields['Giorni']) && r.fields['Giorni'].length > 0
                    ? parseInt(r.fields['Giorni'][0])
                    : null,
      fascia:     r.fields['Fascia'] || '',
      oraInizio:  r.fields['Ora inizio'] || '',
      oraFine:    r.fields['Ora fine'] || '',
      intervallo: r.fields['Intervallo minuti'] || 15,
      attivo:     r.fields['Attivo'] || false,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, orari }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
