// netlify/functions/get-chiusure.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_CHIUSURE = process.env.AIRTABLE_CHIUSURE || 'Chiusure';

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CHIUSURE)}?sort[0][field]=Tipo&sort[0][direction]=asc`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );

    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };

    const json = await res.json();
    const chiusure = (json.records || []).map(r => ({
      id:           r.id,
      descrizione:  r.fields['Descrizione'] || '',
      tipo:         r.fields['Tipo'] || '',
      tipoApertura: r.fields['Tipo apertura'] || 'Chiusura',
      giorno:       r.fields['Giorno'] !== undefined ? r.fields['Giorno'] : null,
      dataInizio:   r.fields['Data inizio'] || '',
      dataFine:     r.fields['Data fine'] || '',
      fascia:       r.fields['Fascia'] || '',
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, chiusure }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
