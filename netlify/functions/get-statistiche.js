// netlify/functions/get-statistiche.js
// Restituisce le ultime N settimane di statistiche da Airtable

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const STATS_TABLE      = 'tblQL9VX6Zx35yta5'
const BASE             = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`
const AT_HEADERS       = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const { verifyToken } = require('./verifyToken')
  if (!verifyToken(event)) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '12')
    const url = `${BASE}/${STATS_TABLE}?sort[0][field]=Data%20inizio&sort[0][direction]=desc&maxRecords=${limit}`

    const res = await fetch(url, { headers: AT_HEADERS })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()

    const mapped = (json.records || []).map(r => {
      const tasso = r.fields['Tasso cancellazione']
      const tassoParsed = tasso != null
        ? parseFloat(String(tasso).replace('%', ''))
        : 0

      const trendPren = r.fields['Prenotazioni ultima settimana vs precedente (%)']
      const trendPers = r.fields['Persone ultima settimana vs precedente (%)']

      return {
        settimana:           r.fields['Settimana'] || '',
        dataInizio:          r.fields['Data inizio'] || '',
        dataFine:            r.fields['Data fine'] || '',
        prenotazioni:        r.fields['Prenotazioni totali'] || 0,
        persone:             r.fields['Persone totali'] || 0,
        prenotazioniSito:    r.fields['Prenotazioni sito'] || 0,
        prenotazioniTel:     r.fields['Prenotazioni telefono'] || 0,
        prenotazioniEventi:  r.fields['Prenotazioni eventi'] || 0,
        cancellazioni:       r.fields['Cancellazioni'] || 0,
        tassoCancellazione:  isNaN(tassoParsed) ? 0 : tassoParsed,
        leadTime:            r.fields['Lead time medio (giorni)'] || 0,
        dimGruppo:           r.fields['Dimensione media gruppo'] || 0,
        slotPiu:             r.fields['Slot più richiesto'] || '',
        slotMeno:            r.fields['Slot meno richiesto'] || '',
        giornopiuPieno:      r.fields['Giorno più pieno'] || '',
        giornopiuVuoto:      r.fields['Giorno più vuoto'] || '',
        fasciaMenoRichiesta: r.fields['Fascia meno richiesta'] || '',
        copertipranzo:       r.fields['Coperti pranzo'] || 0,
        copertiAperitivo:    r.fields['Coperti aperitivo'] || 0,
        copertiCena:         r.fields['Coperti cena'] || 0,
        lunedi:              r.fields['Pren. Lunedì'] || 0,
        martedi:             r.fields['Pren. Martedì'] || 0,
        mercoledi:           r.fields['Pren. Mercoledì'] || 0,
        giovedi:             r.fields['Pren. Giovedì'] || 0,
        venerdi:             r.fields['Pren. Venerdì'] || 0,
        sabato:              r.fields['Pren. Sabato'] || 0,
        domenica:            r.fields['Pren. Domenica'] || 0,
        clientiUnici:        r.fields['Clienti unici'] || 0,
        clientiDiRitorno:    r.fields['Clienti di ritorno'] || 0,
        lastMinute:          r.fields['Prenotazioni last minute'] || 0,
        mediaCopertiGiorno:  r.fields['Media coperti per giorno'] || 0,
        giorniChiusi:        r.fields['Giorni chiusi'] || '',
        analisiAi:           r.fields['Analisi AI'] || '',
        analisiAiGlobale:    r.fields['Analisi AI Globale'] || '',
        trendPrenotazioni:   trendPren != null ? parseFloat(String(trendPren).replace('%', '')) : null,
        trendPersone:        trendPers != null ? parseFloat(String(trendPers).replace('%', '')) : null,
      }
    })

    // Deduplica per settimana: tieni il record con più prenotazioni
    const deduped = {}
    for (const s of mapped) {
      if (!deduped[s.settimana] || s.prenotazioni > deduped[s.settimana].prenotazioni) {
        deduped[s.settimana] = s
      }
    }
    const settimane = Object.values(deduped)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, settimane }),
    }
  } catch (err) {
    console.error('Errore get-statistiche:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) }
  }
}
