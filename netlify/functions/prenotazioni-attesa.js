// netlify/functions/prenotazioni-attesa.js

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
    const filterFormula = encodeURIComponent(`{Stato}="In attesa"`);
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${filterFormula}&sort[0][field]=Data&sort[0][direction]=asc&fields[]=Nome&fields[]=Data&fields[]=Ora&fields[]=Persone&fields[]=Email&fields[]=Telefono&fields[]=Note`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );

    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };

    const json = await res.json();
    const prenotazioni = (json.records || []).map(r => ({
      id:       r.id,
      nome:     r.fields['Nome'] || '',
      data:     r.fields['Data'] || '',
      ora:      r.fields['Ora'] || '',
      persone:  r.fields['Persone'] || 0,
      email:    r.fields['Email'] || '',
      telefono: r.fields['Telefono'] || '',
      note:     r.fields['Note'] || '',
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, prenotazioni }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
