// netlify/functions/get-prenotazioni.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni';

  try {
    let allRecords = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`);
      url.searchParams.set('fields[]', 'Nome');
      url.searchParams.append('fields[]', 'Data');
      url.searchParams.append('fields[]', 'Ora');
      url.searchParams.append('fields[]', 'Persone');
      url.searchParams.append('fields[]', 'Stato');
      url.searchParams.append('fields[]', 'Note');
      url.searchParams.append('fields[]', 'Telefono');
      url.searchParams.set('filterByFormula', "NOT({Stato}='Cancellata')");
      if (offset) url.searchParams.set('offset', offset);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Airtable error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
      }

      const json = await res.json();
      allRecords = [...allRecords, ...(json.records || [])];
      offset = json.offset;
    } while (offset);

    const prenotazioni = allRecords
      .filter(r => r.fields.Data && r.fields.Ora)
      .map(r => ({
        id: r.id,
        nome: r.fields.Nome || '',
        data: r.fields.Data,
        ora: r.fields.Ora,
        persone: r.fields.Persone || 0,
        stato: r.fields.Stato || '',
        note: r.fields.Note || '',
        telefono: r.fields.Telefono || '',
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, prenotazioni })
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
