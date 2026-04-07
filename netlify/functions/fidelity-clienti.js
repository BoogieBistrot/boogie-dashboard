// netlify/functions/fidelity-clienti.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const { verifyToken } = require('./verifyToken');
  if (!verifyToken(event)) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const { q } = event.queryStringParameters || {};

  const brevoHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY,
  };

  try {
    const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID) || 3;

    // Carica tutti i contatti dalla lista fidelity con paginazione
    let tuttiContatti = [];
    let offset = 0;
    const limit = 500;
    while (true) {
      const res = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${BREVO_LIST_ID}/contacts?limit=${limit}&offset=${offset}&sort=desc`,
        { headers: brevoHeaders }
      );
      if (!res.ok) {
        console.error('Brevo list error:', res.status, await res.text());
        return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
      }
      const json = await res.json();
      const batch = json.contacts || [];
      tuttiContatti = tuttiContatti.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }

    // Gli attributi sono già inclusi nella risposta della lista
    let clienti = tuttiContatti
      .filter(c => c.attributes?.ISCRITTO_FIDELITY)
      .map(c => ({
        email: c.email,
        nome: c.attributes?.FIRSTNAME || '',
        cognome: c.attributes?.LASTNAME || '',
        punti: parseInt(c.attributes?.PUNTI_FIDELITY) || 0,
        dataIscrizione: c.attributes?.DATA_ISCRIZIONE_FIDELITY || '',
      }));

    // Filtra per ricerca parziale se c'è un parametro q
    if (q) {
      const qLower = q.toLowerCase();
      clienti = clienti.filter(c =>
        c.email.toLowerCase().includes(qLower) ||
        c.nome.toLowerCase().includes(qLower) ||
        c.cognome.toLowerCase().includes(qLower) ||
        (c.nome + ' ' + c.cognome).toLowerCase().includes(qLower)
      );
    }

    clienti = clienti.sort((a, b) => b.punti - a.punti);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, clienti }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }
};
