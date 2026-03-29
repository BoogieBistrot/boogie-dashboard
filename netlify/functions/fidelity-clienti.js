// netlify/functions/fidelity-clienti.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const { q } = event.queryStringParameters || {};

  const brevoHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY,
  };

  try {
    // Carica tutti gli iscritti fidelity
    const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID) || 3;
    const res = await fetch(`https://api.brevo.com/v3/contacts?limit=100&sort=desc`, {
      headers: brevoHeaders
    });

    if (!res.ok) {
      console.error('Brevo list error:', res.status, await res.text());
      return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
    }

    const json = await res.json();
    const tuttiContatti = json.contacts || [];

    // Fetch attributi per ogni contatto
    const clientiPromises = tuttiContatti.map(async c => {
      try {
        const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(c.email)}`, { headers: brevoHeaders });
        if (!r.ok) return null;
        const contact = await r.json();
        if (!contact.attributes?.ISCRITTO_FIDELITY) return null;
        return {
          email: contact.email,
          nome: contact.attributes?.FIRSTNAME || '',
          cognome: contact.attributes?.LASTNAME || '',
          punti: parseInt(contact.attributes?.PUNTI_FIDELITY) || 0,
          dataIscrizione: contact.attributes?.DATA_ISCRIZIONE_FIDELITY || '',
        };
      } catch { return null; }
    });

    const risultati = await Promise.all(clientiPromises);
    let clienti = risultati.filter(c => c !== null);

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
