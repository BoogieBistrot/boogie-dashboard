// netlify/functions/gestisci-appuntamenti.js
// GET / POST / DELETE appuntamenti agenda

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE            = process.env.AIRTABLE_AGENDA || 'Agenda'
const BASE_URL         = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE)}`
const AT_HEADERS       = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  // GET — lista appuntamenti
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(
        `${BASE_URL}?sort[0][field]=Data&sort[0][direction]=asc&maxRecords=200`,
        { headers: AT_HEADERS }
      )
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      const appuntamenti = (json.records || []).map(r => ({
        id:    r.id,
        title: r.fields['Titolo'] || '',
        data:  r.fields['Data'] || '',
        ora:   r.fields['Ora'] || '',
        tipo:  r.fields['Tipo'] || 'Appuntamento',
        note:  r.fields['Note'] || '',
      }))
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, appuntamenti }) }
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: e.message }) }
    }
  }

  // POST — crea o aggiorna
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body)

      // Aggiorna esistente
      if (body.id) {
        const res = await fetch(`${BASE_URL}/${body.id}`, {
          method: 'PATCH',
          headers: AT_HEADERS,
          body: JSON.stringify({
            fields: {
              'Titolo': body.title,
              'Data':   body.data,
              'Ora':    body.ora || '',
              'Tipo':   body.tipo || 'Appuntamento',
              'Note':   body.note || '',
            }
          })
        })
        if (!res.ok) throw new Error(await res.text())
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
      }

      // Crea nuovo
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: AT_HEADERS,
        body: JSON.stringify({
          fields: {
            'Titolo': body.title,
            'Data':   body.data,
            'Ora':    body.ora || '',
            'Tipo':   body.tipo || 'Appuntamento',
            'Note':   body.note || '',
          }
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, id: json.id }) }
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: e.message }) }
    }
  }

  // DELETE
  if (event.httpMethod === 'DELETE') {
    try {
      const { id } = JSON.parse(event.body)
      await fetch(`${BASE_URL}/${id}`, { method: 'DELETE', headers: AT_HEADERS })
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: e.message }) }
    }
  }

  return { statusCode: 405, headers: CORS, body: 'Method not allowed' }
}
