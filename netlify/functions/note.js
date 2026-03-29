const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = 'appo1z9qJbcQm2PQx'
const TABLE_ID = 'tblw6Crct6OaEjpDk'
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`

const headers = {
  'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  const method = event.httpMethod

  if (method === 'GET') {
    try {
      const res = await fetch(`${BASE_URL}?sort[0][field]=Data&sort[0][direction]=desc&maxRecords=50`, { headers })
      const json = await res.json()
      const note = (json.records || []).map(r => ({
        id: r.id,
        testo: r.fields.Testo || '',
        autore: r.fields.Autore || '',
        data: r.fields.Data || '',
        completata: r.fields.Completata || false,
        categoria: r.fields.Categoria || 'Generale',
        per: r.fields.Per || [],
      }))
      return { statusCode: 200, body: JSON.stringify({ success: true, note }) }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) }
    }
  }

  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body)

      if (body.action === 'toggle' && body.id) {
        const res = await fetch(`${BASE_URL}/${body.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: { Completata: body.completata } }),
        })
        const json = await res.json()
        return { statusCode: 200, body: JSON.stringify({ success: true, record: json }) }
      }

      if (body.action === 'delete' && body.id) {
        await fetch(`${BASE_URL}/${body.id}`, { method: 'DELETE', headers })
        return { statusCode: 200, body: JSON.stringify({ success: true }) }
      }

      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: {
            Testo: body.testo,
            Autore: body.autore,
            Data: new Date().toISOString().split('T')[0],
            Completata: false,
            Categoria: body.categoria || 'Generale',
            Per: body.per || [],
          }
        }),
      })
      const json = await res.json()
      return { statusCode: 200, body: JSON.stringify({ success: true, record: json }) }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) }
    }
  }

  return { statusCode: 405, body: 'Method not allowed' }
}
