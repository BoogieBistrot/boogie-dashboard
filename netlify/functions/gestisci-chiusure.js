// netlify/functions/gestisci-chiusure.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_CHIUSURE = process.env.AIRTABLE_CHIUSURE || 'Chiusure';

  if (event.httpMethod === 'DELETE') {
    const { id } = event.queryStringParameters || {};
    if (!id) return { statusCode: 400, headers, body: 'ID mancante' };
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CHIUSURE)}/${id}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );
    return { statusCode: res.ok ? 200 : 500, headers, body: JSON.stringify({ success: res.ok }) };
  }

  if (event.httpMethod === 'POST') {
    let data;
    try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

    const { descrizione, tipo, tipoApertura, giorno, dataInizio, dataFine, fascia } = data;
    if (!tipo) return { statusCode: 400, headers, body: 'Tipo obbligatorio' };

    const fields = {
      'Descrizione':   descrizione || '',
      'Tipo':          tipo,
      'Tipo apertura': tipoApertura || 'Chiusura',
    };

    if (tipo === 'Ricorrente' && giorno !== undefined && giorno !== null) fields['Giorno'] = parseInt(giorno);
    if (tipo === 'Data specifica') {
      if (dataInizio) fields['Data inizio'] = dataInizio;
      if (dataFine)   fields['Data fine']   = dataFine;
    }
    if (fascia) {
      // fascia può essere stringa o array
      const fasciaArr = Array.isArray(fascia) ? fascia : (fascia ? [fascia] : []);
      if (fasciaArr.length > 0) fields['Fascia'] = fasciaArr;
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CHIUSURE)}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      }
    );
    const result = await res.json();
    return { statusCode: res.ok ? 200 : 500, headers, body: JSON.stringify({ success: res.ok, id: result.id }) };
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
