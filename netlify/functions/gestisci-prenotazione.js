// netlify/functions/gestisci-prenotazione.js

async function aggiungiTagBrevo(email, nuoviTag, apiKey) {
  const brevoHeaders = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': apiKey }
  const contactRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, { headers: brevoHeaders })
  if (!contactRes.ok) return
  const contact = await contactRes.json()
  const tagsEsistenti = contact.tags || []
  const tagsMerged = [...new Set([...tagsEsistenti, ...nuoviTag])]
  await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: brevoHeaders,
    body: JSON.stringify({ tags: tagsMerged })
  })
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const { verifyToken } = require('./verifyToken')
  if (!verifyToken(event)) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) }

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni'
  const BREVO_API_KEY    = process.env.BREVO_API_KEY
  const BREVO_LIST_ID    = parseInt(process.env.BREVO_LIST_ID) || 3
  const BASE_URL         = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`
  const AT_HEADERS       = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers, body: 'Invalid JSON' }
  }

  // PATCH — modifica prenotazione esistente
  if (event.httpMethod === 'PATCH' || body.action === 'edit') {
    const { id, nome, data, ora, persone, telefono, email, note, stato, tags } = body
    if (!id) return { statusCode: 400, headers, body: 'ID mancante' }

    try {
      const fields = {
        'Nome':     nome,
        'Data':     data,
        'Ora':      ora,
        'Persone':  parseInt(persone),
        'Telefono': telefono || '',
        'Email':    email || '',
        'Note':     note || '',
        'Stato':    stato,
      }
      if (tags !== undefined) fields['Tag'] = tags

      const res = await fetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: AT_HEADERS,
        body: JSON.stringify({ fields })
      })
      if (!res.ok) throw new Error(await res.text())

      // Aggiorna tag su Brevo se c'è email
      if (email && BREVO_API_KEY && tags && tags.length > 0) {
        try { await aggiungiTagBrevo(email, tags, BREVO_API_KEY) } catch (e) { console.error('Brevo tag error:', e) }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    } catch (err) {
      console.error('PATCH error:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) }
    }
  }

  // POST — crea nuova prenotazione telefonica
  if (event.httpMethod === 'POST') {
    const { nome, data, ora, persone, telefono, email, note, tags } = body
    if (!nome || !data || !ora || !persone) {
      return { statusCode: 400, headers, body: 'Campi obbligatori mancanti' }
    }

    // Splitta nome in nome/cognome per Brevo
    const parti = nome.trim().split(' ')
    const firstName = parti[0] || ''
    const lastName = parti.slice(1).join(' ') || ''

    try {
      // 1. Salva su Airtable — stato direttamente Confermata
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: AT_HEADERS,
        body: JSON.stringify({
          fields: {
            'Nome':               nome,
            'Data':               data,
            'Ora':                ora,
            'Persone':            parseInt(persone),
            'Telefono':           telefono || '',
            'Email':              email || '',
            'Note':               note || '',
            'Stato':              'Confermata',
            'Timestamp':          new Date().toISOString(),
            'Consenso Privacy':   true,
            'Consenso Marketing': false,
            'Canale':             'Telefono',
            'Tag':                tags && tags.length > 0 ? tags : [],
          }
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()

      // 2. Salva contatto su Brevo solo se c'è un'email
      if (email && BREVO_API_KEY) {
        try {
          await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'api-key': BREVO_API_KEY,
            },
            body: JSON.stringify({
              email,
              attributes: {
                FIRSTNAME: firstName,
                LASTNAME:  lastName,
                SMS:       telefono || '',
                CONSENSO_MARKETING: false,
              },
              listIds: [BREVO_LIST_ID],
              updateEnabled: true,
            })
          })
          if (tags && tags.length > 0) {
            await aggiungiTagBrevo(email, tags, BREVO_API_KEY)
          }
        } catch (brevoErr) {
          console.error('Brevo error:', brevoErr)
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: json.id }) }
    } catch (err) {
      console.error('POST error:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) }
    }
  }

  return { statusCode: 405, headers, body: 'Method not allowed' }
}