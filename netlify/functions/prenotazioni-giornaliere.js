// netlify/functions/prenotazioni-giornaliere.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE || 'Prenotazioni'

  try {
    // Calcola oggi, domani, dopodomani
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const giorni = [0, 1, 2].map(offset => {
      const d = new Date(oggi)
      d.setDate(oggi.getDate() + offset)
      return d.toISOString().split('T')[0]
    })

    const [dataInizio, dataFine] = [giorni[0], giorni[2]]

    const formula = encodeURIComponent(
      `AND(DATETIME_FORMAT({Data},'YYYY-MM-DD') >= "${dataInizio}", DATETIME_FORMAT({Data},'YYYY-MM-DD') <= "${dataFine}", {Stato} != "Cancellata")`
    )

    const fields = ['Nome','Data','Ora','Persone','Stato','Note','Telefono','Preferenza']
      .map(f => `fields[]=${encodeURIComponent(f)}`).join('&')

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${formula}&${fields}&sort[0][field]=Data&sort[0][direction]=asc&sort[1][field]=Ora&sort[1][direction]=asc`

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    })
    if (!res.ok) throw new Error(await res.text())

    const json = await res.json()
    const records = json.records || []

    const prenotazioni = records.map(r => ({
      id:         r.id,
      nome:       r.fields.Nome || '',
      data:       r.fields.Data,
      ora:        r.fields.Ora || '',
      persone:    parseInt(r.fields.Persone) || 0,
      stato:      r.fields.Stato || '',
      note:       r.fields.Note || '',
      telefono:   r.fields.Telefono || '',
      preferenza: r.fields.Preferenza || '',
    }))

    // Raggruppa per data
    const perGiorno = giorni.map(data => {
      const pren = prenotazioni.filter(p => p.data === data)
      const totPersone = pren.reduce((s, p) => s + p.persone, 0)
      const pizza  = pren.filter(p => p.preferenza?.includes('Pizza')).length
      const cucina = pren.filter(p => p.preferenza?.includes('Cucina')).length
      return { data, prenotazioni: pren, totPrenotazioni: pren.length, totPersone, pizza, cucina }
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, giorni: perGiorno })
    }
  } catch (err) {
    console.error('Error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false }) }
  }
}
