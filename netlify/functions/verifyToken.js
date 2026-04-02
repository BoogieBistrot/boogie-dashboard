const crypto = require('crypto');

function verifyToken(event) {
  const auth = (event.headers['authorization'] || event.headers['Authorization'] || '').trim();
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (process.env.NETLIFY_DEV === 'true') return true;
  if (!token) return false;

  const PASSWORD = process.env.DASHBOARD_PASSWORD;
  const SECRET   = process.env.DASHBOARD_SECRET || 'boogie-secret-key';

  // Accetta token di oggi e di ieri (gestisce il cambio di giornata a mezzanotte)
  for (let offset = 0; offset <= 1; offset++) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const day = d.toISOString().split('T')[0];
    const expected = crypto.createHmac('sha256', SECRET).update(PASSWORD + day).digest('hex');
    if (token === expected) return true;
  }
  return false;
}

module.exports = { verifyToken };
