// netlify/functions/fidelity-ricarica.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const EMAIL_FROM    = process.env.EMAIL_FROM;

  let data;
  try { data = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { email, importo, nota, moltiplicatore, scalaP } = data;
  if (!email) return { statusCode: 400, headers, body: 'Email obbligatoria' };

  const isScala = scalaP && parseInt(scalaP) > 0;
  if (!isScala && (!importo || parseFloat(importo) <= 0)) {
    return { statusCode: 400, headers, body: 'Importo obbligatorio' };
  }

  const brevoHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY,
  };

  const puntiAggiunti = isScala
    ? -Math.abs(parseInt(scalaP))
    : Math.ceil(parseFloat(importo) * 5) * (moltiplicatore || 1);

  // Leggi contatto attuale
  const contactRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    headers: brevoHeaders
  });

  if (!contactRes.ok) {
    return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Contatto non trovato' }) };
  }

  const contact = await contactRes.json();
  const nome = contact.attributes?.FIRSTNAME || '';
  const puntiPrecedenti = parseInt(contact.attributes?.PUNTI_FIDELITY) || 0;
  const nuoviPunti = Math.max(0, puntiPrecedenti + puntiAggiunti);

  // Aggiorna punti su Brevo
  const updateRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: brevoHeaders,
    body: JSON.stringify({ attributes: { PUNTI_FIDELITY: nuoviPunti } })
  });

  if (!updateRes.ok) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Errore aggiornamento punti' }) };
  }

  // Email al cliente
  const emailHtml = isScala ? `
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot — Fidelity</p>
          <h1 style="font-size:24px;color:#1A1610;margin:0 0 20px;font-weight:400;">Premio riscattato 🎁</h1>
          <p style="font-size:15px;color:#4A4030;line-height:1.7;margin:0 0 24px;">Ciao <strong>${nome}</strong>, hai riscattato un premio!</p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Punti scalati</span><strong style="color:#E53935;font-size:1.4rem;">${Math.abs(puntiAggiunti)}</strong></p>
              <p style="margin:0;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Punti rimanenti</span><strong style="color:#C4913A;font-size:1.8rem;">${nuoviPunti}</strong></p>
              ${nota ? `<p style="margin:12px 0 0;font-size:12px;color:#8B6F47;font-style:italic;">${nota}</p>` : ''}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #D4C9B0;">
          <p style="font-size:11px;color:#B0A898;margin:0;">Boogie Bistrot — Via Europa, 2, Colle Brianza (LC)</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>` : `
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-top:3px solid #C4913A;">
        <tr><td style="padding:40px 40px 20px;">
          <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8B6F47;margin:0 0 12px;">Boogie Bistrot — Fidelity</p>
          <h1 style="font-size:24px;color:#1A1610;margin:0 0 20px;font-weight:400;">Punti aggiornati ✓</h1>
          <p style="font-size:15px;color:#4A4030;line-height:1.7;margin:0 0 24px;">Ciao <strong>${nome}</strong>, grazie per la tua visita!</p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;border-left:3px solid #C4913A;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Spesa</span><strong style="color:#1A1610;">€${parseFloat(importo || 0).toFixed(2)}${moltiplicatore > 1 ? ' · Punti doppi 2×' : ''}</strong></p>
              <p style="margin:0 0 12px;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Punti aggiunti</span><strong style="color:#C4913A;font-size:1.4rem;">+${puntiAggiunti}</strong></p>
              <p style="margin:0;font-size:13px;"><span style="color:#8B6F47;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:3px;">Totale punti</span><strong style="color:#C4913A;font-size:1.8rem;">${nuoviPunti}</strong></p>
              ${nota ? `<p style="margin:12px 0 0;font-size:12px;color:#8B6F47;font-style:italic;">${nota}</p>` : ''}
            </td></tr>
          </table>
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
      sender: { name: 'Boogie Bistrot', email: EMAIL_FROM },
      to: [{ email, name: nome }],
      subject: isScala
        ? `Premio riscattato — ${Math.abs(puntiAggiunti)} punti scalati · Boogie Bistrot`
        : `+${puntiAggiunti} punti Fidelity — Boogie Bistrot`,
      htmlContent: emailHtml,
    })
  });

  return { statusCode: 200, headers, body: JSON.stringify({
    success: true,
    puntiAggiunti: Math.abs(puntiAggiunti),
    puntiPrecedenti,
    nuoviPunti,
    nome,
    isScala,
  })};
};
