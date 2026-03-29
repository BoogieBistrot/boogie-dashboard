// netlify/functions/get-clienti.js
// Restituisce tutti i contatti Brevo con paginazione

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const { page = '1', limit = '50', q = '' } = event.queryStringParameters || {};

  const brevoHeaders = {
    'Accept': 'application/json',
    'api-key': BREVO_API_KEY,
  };

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const url = `https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}&sort=desc`;

    const res = await fetch(url, { headers: brevoHeaders });
    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err }) };
    }

    const json = await res.json();
    const totale = json.count || 0;

    // Per ogni contatto fetch dettagli (attributi)
    const contacts = json.contacts || [];
    const dettagliPromises = contacts.map(async c => {
      try {
        const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(c.email)}`, { headers: brevoHeaders });
        if (!r.ok) return null;
        const d = await r.json();
        return {
          email: d.email,
          nome: d.attributes?.FIRSTNAME || '',
          cognome: d.attributes?.LASTNAME || '',
          telefono: d.attributes?.TELEFONO || '',
          punti: parseInt(d.attributes?.PUNTI_FIDELITY) || 0,
          fidelity: !!d.attributes?.ISCRITTO_FIDELITY,
          marketing: !!d.attributes?.CONSENSO_MARKETING,
          dataIscrizione: d.attributes?.DATA_ISCRIZIONE_FIDELITY || '',
        };
      } catch { return null; }
    });

    let clienti = (await Promise.all(dettagliPromises)).filter(Boolean);

    // Filtro ricerca lato server se q presente
    if (q) {
      const ql = q.toLowerCase();
      clienti = clienti.filter(c =>
        c.email.toLowerCase().includes(ql) ||
        c.nome.toLowerCase().includes(ql) ||
        c.cognome.toLowerCase().includes(ql)
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, clienti, totale, page: parseInt(page), limit: parseInt(limit) })
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
