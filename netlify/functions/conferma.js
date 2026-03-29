// netlify/functions/conferma.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni';
  const BREVO_API_KEY    = process.env.BREVO_API_KEY;
  const EMAIL_RISTORANTE = process.env.EMAIL_RISTORANTE;
  const EMAIL_FROM       = process.env.EMAIL_FROM;
  const SITO_URL         = process.env.SITO_URL || 'https://boogiebistrot.com';
  const NETLIFY_URL      = process.env.NETLIFY_URL || 'https://shimmering-sundae-54b044.netlify.app';

  const { id, solo_dati } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'ID mancante' }) };

  // ── 1. Recupera record ───────────────────────────────────────────
  let record;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${id}`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    if (!res.ok) return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Prenotazione non trovata' }) };
    record = await res.json();
  } catch (err) {
    console.error('Airtable fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }

  const fields = record.fields;

  const nome       = fields['Nome'] || '';
  const email      = fields['Email'] || '';
  const data       = fields['Data'] || '';
  const ora        = fields['Ora'] || '';
  const persone    = fields['Persone'] || '';
  const note       = fields['Note'] || '';
  const preferenza = fields['Preferenza'] || '';
  const marketing  = fields['Consenso Marketing'];

  const dataFormattata = data
    ? new Date(data + 'T12:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : data;

  // ── Modalità solo_dati: restituisce i dati senza confermare ──────
  if (solo_dati === '1') {
    if (fields['Stato'] === 'Confermata') {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyConfirmed: true }) };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, nome, data: dataFormattata, ora, persone: String(persone), note, preferenza })
    };
  }

  // ── Modalità conferma (POST) ─────────────────────────────────────
  if (fields['Stato'] === 'Confermata') {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyConfirmed: true }) };
  }

  // Leggi messaggio dal body
  let messaggio = '';
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      messaggio = body.messaggio || '';
    } catch {}
  }

  // ── 2. Aggiorna stato → Confermata ──────────────────────────────
  try {
    const patchRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'Stato': 'Confermata' } })
    });
    if (!patchRes.ok) {
      console.error('Airtable patch error:', await patchRes.text());
      return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
    }
  } catch (err) {
    console.error('Airtable patch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) };
  }

  // ── 3. Link calendario ───────────────────────────────────────────
  let googleCalLink = '';
  if (data && ora) {
    const [anno, mese, giorno] = data.split('-');
    const [ore, minuti] = ora.split(':');
    const dtStart = `${anno}${mese}${giorno}T${ore}${minuti}00`;
    const oraFine = parseInt(ore) + 2;
    const dtEnd = `${anno}${mese}${giorno}T${String(oraFine).padStart(2,'0')}${minuti}00`;
    const titolo   = encodeURIComponent('Cena al Boogie Bistrot');
    const luogo    = encodeURIComponent('Via Europa 2, 23886 Colle Brianza LC');
    const dettagli = encodeURIComponent(`Prenotazione per ${persone} ${parseInt(persone) === 1 ? 'persona' : 'persone'} alle ${ora}.${preferenza ? ' Preferenza: ' + preferenza : ''}`);
    googleCalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titolo}&dates=${dtStart}/${dtEnd}&location=${luogo}&details=${dettagli}&ctz=Europe/Rome`;
  }

  const icsLink = `${NETLIFY_URL}/.netlify/functions/ics?data=${data}&ora=${encodeURIComponent(ora)}&nome=${encodeURIComponent(nome)}&persone=${persone}`;

  // ── 4. Email conferma definitiva ─────────────────────────────────
  const messaggioHtml = messaggio
    ? `<table cellpadding="0" cellspacing="0" width="100%" style="background:#FFF8EE;border:1px solid #E8D5A0;margin-bottom:28px;">
        <tr><td style="padding:16px 20px;">
          <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8B6F47;margin:0 0 6px;">Messaggio dal Boogie Bistrot</p>
          <p style="font-size:14px;color:#4A3828;line-height:1.7;margin:0;">${messaggio}</p>
        </td></tr>
      </table>`
    : '';

  const emailConfermaHtml = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot</p>
          <h1 style="font-size:26px;color:#1A1610;margin:0 0 8px;font-weight:400;">Prenotazione confermata! 🎉</h1>
          <p style="font-size:13px;color:#8B6F47;margin:0 0 24px;">Il tuo tavolo è riservato.</p>
          <p style="font-size:15px;color:#4A4030;line-height:1.7;margin:0 0 24px;">
            Ciao <strong>${nome}</strong>,<br>
            siamo lieti di confermarti la prenotazione. Non vediamo l'ora di accoglierti!
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Data</span><strong>${dataFormattata}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ora</span><strong>${ora}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ospiti</span><strong>${persone} ${parseInt(persone) === 1 ? 'persona' : 'persone'}</strong></p>
              ${preferenza ? `<p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Preferenza</span><strong>${preferenza}</strong></p>` : ''}
              ${note ? `<p style="margin:0;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Note</span><strong>${note}</strong></p>` : ''}
            </td></tr>
          </table>
          ${messaggioHtml}
          <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Aggiungi al calendario</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding-right:10px;">
                <a href="${googleCalLink}" target="_blank" style="display:inline-block;background:#1A1610;color:white;text-decoration:none;padding:10px 18px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.05em;">📅 Google Calendar</a>
              </td>
              <td>
                <a href="${icsLink}" style="display:inline-block;background:#F5F0E8;color:#1A1610;text-decoration:none;padding:10px 18px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.05em;border:1px solid #D4C9B0;">🍎 Apple Calendar</a>
              </td>
            </tr>
          </table>
          <p style="font-size:13px;color:#8B6F47;line-height:1.6;margin:0 0 8px;">
            Per modifiche o disdette scrivici a <a href="mailto:${EMAIL_RISTORANTE}" style="color:#C4913A;">${EMAIL_RISTORANTE}</a>.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px 30px;border-top:1px solid #D4C9B0;">
          <p style="font-size:11px;color:#B0A898;margin:0;line-height:1.7;">
            Boogie Bistrot — Via Europa, 2, Colle Brianza (LC)<br>
            ${marketing ? 'Sei iscritto alla nostra newsletter. Per cancellare l\'iscrizione scrivi a ' + EMAIL_RISTORANTE : ''}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'Boogie Bistrot', email: EMAIL_FROM },
        to: [{ email, name: nome }],
        subject: `Prenotazione confermata! — ${dataFormattata} ore ${ora}`,
        htmlContent: emailConfermaHtml,
      })
    });
  } catch (err) {
    console.error('Brevo error:', err);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, nome, data: dataFormattata, ora, persone: String(persone) }),
  };
};
