// netlify/functions/fidelity-iscrizione.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID) || 3;

  let data;
  try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { nome, cognome, email, telefono, consenso_privacy, consenso_marketing } = data;
  if (!nome || !email || !consenso_privacy) {
    return { statusCode: 400, headers, body: 'Campi obbligatori mancanti' };
  }

  const brevoHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY,
  };

  // Controlla se il contatto esiste già ed è già iscritto
  try {
    const checkRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: brevoHeaders
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.attributes && existing.attributes.ISCRITTO_FIDELITY === true) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyMember: true }) };
      }
    }
  } catch (err) { /* contatto non trovato, procedi */ }

  // Crea o aggiorna contatto su Brevo
  const upsertRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      email,
      attributes: {
        FIRSTNAME: nome,
        LASTNAME: cognome || '',
        SMS: telefono || '',
        ISCRITTO_FIDELITY: true,
        PUNTI_FIDELITY: 0,
        DATA_ISCRIZIONE_FIDELITY: new Date().toISOString().split('T')[0],
        CONSENSO_MARKETING: consenso_marketing ? true : false,
      },
      listIds: [BREVO_LIST_ID],
      updateEnabled: true,
    })
  });

  if (!upsertRes.ok) {
    const upsertBody = await upsertRes.json().catch(() => ({}));
    if (upsertRes.status !== 400 || upsertBody.code !== 'duplicate_parameter') {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
    }
    console.warn('Brevo SMS duplicato, contatto salvato senza numero:', upsertBody.message);
  }

  // Email di benvenuto al cliente
  const emailHtml = `
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot — Fidelity</p>
          <h1 style="font-size:24px;color:#1A1610;margin:0 0 20px;font-weight:400;">Benvenuto nel programma Fidelity! 🎉</h1>
          <p style="font-size:15px;color:#4A4030;line-height:1.7;margin:0 0 20px;">Ciao <strong>${nome}</strong>,<br>sei ufficialmente iscritto al programma Fidelity di Boogie Bistrot.</p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Come funziona</p>
              <p style="margin:0;font-size:14px;color:#1A1610;line-height:1.7;"><strong>Ogni euro speso vale 5 punti.</strong><br>I punti si accumulano ad ogni visita e potrai usarli per ottenere premi esclusivi.</p>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#8B6F47;">Il tuo saldo punti attuale: <strong style="color:#C4913A;">0 punti</strong></p>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #D4C9B0;">
          <p style="font-size:11px;color:#B0A898;margin:0;">Boogie Bistrot — Via Europa, 2, Colle Brianza (LC)</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: 'Boogie Bistrot', email: process.env.EMAIL_FROM },
      to: [{ email, name: nome }],
      subject: '🎉 Benvenuto nel programma Fidelity — Boogie Bistrot',
      htmlContent: emailHtml,
    })
  });

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyMember: false }) };
};