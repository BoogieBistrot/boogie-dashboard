// netlify/functions/pulizia-chiusure.js
// Scheduled function — si esegue ogni lunedì alle 03:00
// Configura in netlify.toml:
//   [functions.pulizia-chiusure]
//   schedule = "0 3 * * 1"

const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID
const AIRTABLE_CHIUSURE = process.env.AIRTABLE_CHIUSURE || 'Chiusure'
const BASE_URL          = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CHIUSURE)}`
const AT_HEADERS        = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }

exports.handler = async () => {
  try {
    // Recupera tutte le regole di tipo "Data specifica"
    const url = new URL(BASE_URL)
    url.searchParams.set('filterByFormula', "{Tipo}='Data specifica'")

    const res = await fetch(url.toString(), { headers: AT_HEADERS })
    if (!res.ok) throw new Error(await res.text())

    const json = await res.json()
    const records = json.records || []

    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)

    const daEliminare = records.filter(r => {
      const dataFine = r.fields['Data fine'] || r.fields['Data inizio']
      if (!dataFine) return false
      const fine = new Date(dataFine + 'T00:00:00')
      return fine < oggi
    })

    if (daEliminare.length === 0) {
      console.log('Nessuna regola scaduta da eliminare.')
      return { statusCode: 200, body: 'Nessuna regola scaduta' }
    }

    // Airtable supporta max 10 record per batch delete
    const chunks = []
    for (let i = 0; i < daEliminare.length; i += 10) {
      chunks.push(daEliminare.slice(i, i + 10))
    }

    for (const chunk of chunks) {
      const ids = chunk.map(r => r.id).map(id => `records[]=${id}`).join('&')
      const delRes = await fetch(`${BASE_URL}?${ids}`, {
        method: 'DELETE',
        headers: AT_HEADERS,
      })
      if (!delRes.ok) console.error('Delete error:', await delRes.text())
    }

    console.log(`Eliminate ${daEliminare.length} regole scadute.`)
    return { statusCode: 200, body: `Eliminate ${daEliminare.length} regole scadute` }

  } catch (err) {
    console.error('Errore pulizia chiusure:', err)
    return { statusCode: 500, body: err.message }
  }
}
