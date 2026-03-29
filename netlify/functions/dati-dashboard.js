// netlify/functions/dati-dashboard.js
// Restituisce dati recensioni per la dashboard

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN      = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID    = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_RECENSIONI = process.env.AIRTABLE_RECENSIONI || 'Recensioni';

  try {
    // Recupera ultimi 10 record ordinati per data desc
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_RECENSIONI)}?sort[0][field]=Data&sort[0][direction]=desc&maxRecords=10`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (!res.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
    }

    const json = await res.json();
    const records = json.records || [];

    if (records.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, dati: null }) };
    }

    // Record più recente
    const ultimo = records[0].fields;

    // Record di ~7 giorni fa (settimana scorsa)
    const settimanaFa = records.find(r => {
      const data = new Date(r.fields['Data']);
      const ultimo_data = new Date(ultimo['Data']);
      const diff = (ultimo_data - data) / (1000 * 60 * 60 * 24);
      return diff >= 5 && diff <= 10;
    });

    // Record di ~30 giorni fa (mese scorso)
    const meseFa = records.find(r => {
      const data = new Date(r.fields['Data']);
      const ultimo_data = new Date(ultimo['Data']);
      const diff = (ultimo_data - data) / (1000 * 60 * 60 * 24);
      return diff >= 25 && diff <= 35;
    });

    const diffSettimana = settimanaFa
      ? ultimo['Google Recensioni'] - settimanaFa.fields['Google Recensioni']
      : null;

    const diffMese = meseFa
      ? ultimo['Google Recensioni'] - meseFa.fields['Google Recensioni']
      : null;

    const diffSettimanaTA = settimanaFa
      ? (ultimo['TripAdvisor Recensioni'] || 0) - (settimanaFa.fields['TripAdvisor Recensioni'] || 0)
      : null;

    const diffMeseTA = meseFa
      ? (ultimo['TripAdvisor Recensioni'] || 0) - (meseFa.fields['TripAdvisor Recensioni'] || 0)
      : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        dati: {
          recensioni:      ultimo['Google Recensioni'],
          rating:          ultimo['Google Rating'],
          data:            ultimo['Data'],
          diffSettimana,
          diffMese,
          taRecensioni:    ultimo['TripAdvisor Recensioni'],
          taRating:        ultimo['TripAdvisor Rating'],
          diffSettimanaTA,
          diffMeseTA,
        }
      })
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
