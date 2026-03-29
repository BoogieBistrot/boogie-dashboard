// netlify/functions/prenota.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni';
  const BREVO_API_KEY    = process.env.BREVO_API_KEY;
  const BREVO_LIST_ID    = parseInt(process.env.BREVO_LIST_ID) || 3;
  const EMAIL_RISTORANTE = process.env.EMAIL_RISTORANTE;
  const EMAIL_FROM       = process.env.EMAIL_FROM;
  const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const SITO_URL         = process.env.SITO_URL || 'https://boogiebistrot.com';

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: 'Invalid JSON' };
  }

  const { nome, cognome, data: dataPrenotazione, ora, persone, email, telefono, note, preferenza, evento, consenso_privacy, consenso_marketing } = data;

  if (!nome || !dataPrenotazione || !ora || !persone || !email || !telefono || !consenso_privacy) {
    return { statusCode: 400, headers, body: 'Campi obbligatori mancanti' };
  }

  const nomeCompleto = cognome ? nome + ' ' + cognome : nome;

  const dataFormattata = new Date(dataPrenotazione + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── 1. Salva su Airtable Prenotazioni ────────────────────────────
  let recordId;
  try {
    const airtableRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          'Nome':               nomeCompleto,
          'Data':               dataPrenotazione,
          'Ora':                ora,
          'Persone':            parseInt(persone),
          'Email':              email,
          'Telefono':           telefono,
          'Note':               note || '',
          'Preferenza':         preferenza || '',
          'Evento':             evento || '',
          'Canale':             'Sito web',
          'Consenso Privacy':   consenso_privacy,
          'Consenso Marketing': consenso_marketing,
          'Timestamp':          new Date().toISOString(),
          'Stato':              'In attesa',
        }
      })
    });

    if (!airtableRes.ok) {
      console.error('Airtable error:', await airtableRes.text());
      return { statusCode: 500, headers, body: 'Errore salvataggio prenotazione' };
    }

    const airtableData = await airtableRes.json();
    recordId = airtableData.id;
  } catch (err) {
    console.error('Airtable fetch error:', err);
    return { statusCode: 500, headers, body: 'Errore connessione Airtable' };
  }

  // ── 2. Aggiungi/aggiorna contatto su Brevo ──────────────────────
  try {
    const brevoContactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: nome,
          LASTNAME: cognome || '',
          SMS: telefono || '',
          CONSENSO_MARKETING: consenso_marketing ? true : false,
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
      })
    });
    const brevoContactBody = await brevoContactRes.json();
    console.log('Brevo contact status:', brevoContactRes.status, JSON.stringify(brevoContactBody));
  } catch (err) {
    console.error('Brevo contact error:', err);
  }

  // ── 3. Notifica Telegram ─────────────────────────────────────────
  const linkConferma = `${SITO_URL}/conferma-prenotazione?id=${recordId}`;
  const preferenzaEmoji = preferenza === 'Pizza' ? '🍕' : preferenza === 'Cucina' ? '🍽️' : '';

  try {
    const testo =
      `🔔 *Nuova richiesta di prenotazione!*\n\n` +
      (evento ? `🎉 *Evento:* ${evento}\n` : '') +
      `👤 *Nome:* ${nomeCompleto}\n` +
      `📅 *Data:* ${dataFormattata}\n` +
      `🕐 *Ora:* ${ora}\n` +
      `👥 *Persone:* ${persone}\n` +
      (preferenza ? `${preferenzaEmoji} *Preferenza:* ${preferenza}\n` : '') +
      `📞 *Telefono:* ${telefono}\n` +
      `📧 *Email:* ${email}` +
      (note ? `\n📝 *Note:* ${note}` : '') +
      `\n\n✅ [Conferma prenotazione](${linkConferma})`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: testo, parse_mode: 'Markdown' })
    });
  } catch (err) {
    console.error('Telegram error:', err);
  }

  // ── 4. Email utente ──────────────────────────────────────────────
  const emailUtenteHtml = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot${evento ? ' · ' + evento : ''}</p>
          <h1 style="font-size:26px;color:#1A1610;margin:0 0 24px;font-weight:400;">Richiesta ricevuta ✓</h1>
          <p style="font-size:15px;color:#4A4030;line-height:1.7;margin:0 0 24px;">
            Ciao <strong>${nome}</strong>,<br>
            abbiamo ricevuto la tua richiesta. Riceverai entro pochi minuti una <strong>conferma definitiva</strong> della prenotazione.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              ${evento ? `<p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Evento</span><strong>${evento}</strong></p>` : ''}
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Data</span><strong>${dataFormattata}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ora</span><strong>${ora}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ospiti</span><strong>${persone} ${parseInt(persone) === 1 ? 'persona' : 'persone'}</strong></p>
              ${note ? `<p style="margin:0;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Note</span><strong>${note}</strong></p>` : ''}
            </td></tr>
          </table>
          <p style="font-size:13px;color:#8B6F47;line-height:1.6;">Per informazioni scrivici a <a href="mailto:${EMAIL_RISTORANTE}" style="color:#C4913A;">${EMAIL_RISTORANTE}</a>.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 30px;border-top:1px solid #D4C9B0;">
          <p style="font-size:11px;color:#B0A898;margin:0;line-height:1.7;">Boogie Bistrot — Hai ricevuto questa email perché hai effettuato una richiesta di prenotazione sul nostro sito.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── 5. Email notifica proprietarie ───────────────────────────────
  const emailNotificaHtml = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot — Gestionale</p>
          <h1 style="font-size:22px;color:#1A1610;margin:0 0 6px;font-weight:400;">🔔 Nuova richiesta di prenotazione</h1>
          <p style="font-size:13px;color:#8B6F47;margin:0 0 24px;">Da confermare al più presto</p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              ${evento ? `<p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Evento</span><strong>🎉 ${evento}</strong></p>` : ''}
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Nome</span><strong>${nomeCompleto}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Data</span><strong>${dataFormattata}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ora</span><strong>${ora}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Persone</span><strong>${persone}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Email</span><strong>${email}</strong></p>
              <p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Telefono</span><strong>${telefono}</strong></p>
              ${note ? `<p style="margin:0 0 10px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Note</span><strong>${note}</strong></p>` : ''}
              <p style="margin:0;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Ricevuta il</span><strong>${new Date().toLocaleString('it-IT')}</strong></p>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
            <tr><td align="center">
              <a href="${linkConferma}" style="display:inline-block;background:#1A1610;color:white;text-decoration:none;padding:14px 32px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.05em;">✓ CONFERMA PRENOTAZIONE</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #D4C9B0;">
          <p style="font-size:11px;color:#B0A898;margin:0;">Boogie Bistrot — Sistema prenotazioni automatico</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const brevoHeaders = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY };

  try {
    const resUtente = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: brevoHeaders,
      body: JSON.stringify({
        sender: { name: 'Boogie Bistrot', email: EMAIL_FROM },
        to: [{ email, name: nomeCompleto }],
        subject: evento
          ? `Richiesta ricevuta — ${evento} · ${dataFormattata} ore ${ora}`
          : `Richiesta di prenotazione ricevuta — ${dataFormattata} ore ${ora}`,
        htmlContent: emailUtenteHtml,
      })
    });
    const resUtenteBody = await resUtente.json();
    console.log('Brevo utente status:', resUtente.status, JSON.stringify(resUtenteBody));

    const resRistorante = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: brevoHeaders,
      body: JSON.stringify({
        sender: { name: 'Sistema Prenotazioni', email: EMAIL_FROM },
        to: [{ email: EMAIL_RISTORANTE }],
        subject: evento
          ? `🎉 ${evento} — ${nomeCompleto} · ${dataFormattata} ore ${ora} (${persone} pers.)`
          : `🔔 Nuova richiesta: ${nomeCompleto} — ${dataFormattata} ore ${ora} (${persone} pers.)`,
        htmlContent: emailNotificaHtml,
      })
    });
    const resRistoranteBody = await resRistorante.json();
    console.log('Brevo ristorante status:', resRistorante.status, JSON.stringify(resRistoranteBody));
  } catch (err) {
    console.error('Brevo error:', err);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
