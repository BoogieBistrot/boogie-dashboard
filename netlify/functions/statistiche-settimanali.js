// netlify/functions/statistiche-settimanali.js
// Scheduled function — ogni domenica alle 23:00
// netlify.toml: schedule = "0 23 * * 0"

const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID
const AIRTABLE_TABLE    = process.env.AIRTABLE_TABLE || 'Prenotazioni'
const STATS_TABLE       = 'tblQL9VX6Zx35yta5'
const BASE              = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`
const AT_HEADERS        = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

const GIORNI_NOME = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const FASCE_ORA = {
  Pranzo:     { start: 11 * 60, end: 15 * 60 },
  Aperitivo:  { start: 15 * 60, end: 19 * 60 },
  Cena:       { start: 19 * 60, end: 24 * 60 },
}

function oraToMinuti(ora) {
  const [h, m] = ora.split(':').map(Number)
  return h * 60 + m
}

function getFasciaOra(ora) {
  if (!ora) return null
  const min = oraToMinuti(ora)
  for (const [fascia, { start, end }] of Object.entries(FASCE_ORA)) {
    if (min >= start && min < end) return fascia
  }
  return 'Cena'
}

function getWeekRange(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Dom
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { mon, sun }
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function getWeekLabel(mon) {
  const year = mon.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNo = Math.ceil(((mon - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

exports.handler = async () => {
  try {
    // Settimana appena finita (lunedì-domenica scorsi)
    const oggi = new Date()
    oggi.setDate(oggi.getDate() - 1) // ieri = domenica
    const { mon, sun } = getWeekRange(oggi)
    const dataInizio = formatDate(mon)
    const dataFine   = formatDate(sun)
    const settimana  = getWeekLabel(mon)

    console.log(`Calcolo statistiche per ${settimana} (${dataInizio} → ${dataFine})`)

    // Fetch prenotazioni della settimana
    const formula = encodeURIComponent(
      `AND(DATETIME_FORMAT({Data},'YYYY-MM-DD') >= "${dataInizio}", DATETIME_FORMAT({Data},'YYYY-MM-DD') <= "${dataFine}")`
    )
    const fields = ['Nome','Data','Ora','Persone','Stato','Canale','Preferenza','Timestamp','Email'].map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
    const url = `${BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${formula}&${fields}`

    const res = await fetch(url, { headers: AT_HEADERS })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    const records = json.records || []

    const prenotazioni = records.map(r => ({
      nome:       r.fields.Nome || '',
      data:       r.fields.Data || '',
      ora:        r.fields.Ora || '',
      persone:    parseInt(r.fields.Persone) || 0,
      stato:      r.fields.Stato || '',
      canale:     r.fields.Canale || '',
      preferenza: r.fields.Preferenza || '',
      timestamp:  r.fields.Timestamp || '',
      email:      r.fields.Email || '',
    }))

    const totali      = prenotazioni.filter(p => p.stato !== 'Cancellata')
    const cancellate  = prenotazioni.filter(p => p.stato === 'Cancellata')

    // Contatori base
    const totPrenotazioni = totali.length
    const totPersone      = totali.reduce((s, p) => s + p.persone, 0)
    const totSito         = totali.filter(p => p.canale === 'Sito web').length
    const totTelefono     = totali.filter(p => p.canale === 'Telefono').length
    const totEventi       = totali.filter(p => p.canale && p.canale !== 'Sito web' && p.canale !== 'Telefono').length
    const totCancellate   = cancellate.length
    const tassoCancellazione = prenotazioni.length > 0
      ? Math.round((totCancellate / prenotazioni.length) * 100)
      : 0

    // Dimensione media gruppo
    const dimMediaGruppo = totPrenotazioni > 0
      ? Math.round((totPersone / totPrenotazioni) * 10) / 10
      : 0

    // Lead time medio
    const leadTimes = totali
      .filter(p => p.timestamp && p.data)
      .map(p => {
        const ts   = new Date(p.timestamp)
        const data = new Date(p.data + 'T12:00:00')
        return Math.max(0, Math.round((data - ts) / 86400000))
      })
    const leadTimeMedio = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((s, l) => s + l, 0) / leadTimes.length * 10) / 10
      : 0

    // Per giorno
    const perGiorno = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    totali.forEach(p => {
      const d = new Date(p.data + 'T12:00:00')
      perGiorno[d.getDay()]++
    })
    const giorniSorted = Object.entries(perGiorno).sort((a, b) => b[1] - a[1])
    const giornopiuPieno = GIORNI_NOME[giorniSorted[0][0]]
    const giornopiuVuoto = GIORNI_NOME[giorniSorted[giorniSorted.length - 1][0]]

    // Per fascia
    const perFascia = { Pranzo: { pren: 0, coperti: 0 }, Aperitivo: { pren: 0, coperti: 0 }, Cena: { pren: 0, coperti: 0 } }
    totali.forEach(p => {
      const fascia = getFasciaOra(p.ora)
      if (fascia && perFascia[fascia]) {
        perFascia[fascia].pren++
        perFascia[fascia].coperti += p.persone
      }
    })
    const fasceSorted = Object.entries(perFascia).sort((a, b) => b[1].pren - a[1].pren)
    const fasciaMenoRichiesta = fasceSorted[fasceSorted.length - 1][0]

    // Slot più/meno richiesto
    const perSlot = {}
    totali.forEach(p => {
      if (p.ora) perSlot[p.ora] = (perSlot[p.ora] || 0) + 1
    })
    const slotSorted = Object.entries(perSlot).sort((a, b) => b[1] - a[1])
    const slotPiuRichiesto  = slotSorted[0]?.[0] || ''
    const slotMenoRichiesto = slotSorted[slotSorted.length - 1]?.[0] || ''

    // Preferenze pizza/cucina
    const prefPizza  = totali.filter(p => p.preferenza?.includes('Pizza')).length
    const prefCucina = totali.filter(p => p.preferenza?.includes('Cucina')).length

    // Clienti unici (per email)
    const emailUniche = new Set(totali.filter(p => p.email).map(p => p.email.toLowerCase()))
    const clientiUnici = emailUniche.size

    // Last minute (prenotati il giorno stesso o il giorno prima)
    const lastMinute = totali.filter(p => {
      if (!p.timestamp || !p.data) return false
      const ts   = new Date(p.timestamp)
      const data = new Date(p.data + 'T12:00:00')
      const diff = Math.round((data - ts) / 86400000)
      return diff <= 1
    }).length

    // Media coperti per giorno (solo giorni con prenotazioni)
    const giorniConPren = Object.values(perGiorno).filter(v => v > 0).length
    const mediaCopertiGiorno = giorniConPren > 0
      ? Math.round((totPersone / giorniConPren) * 10) / 10
      : 0

    // Salva su Airtable Statistiche
    const statsRes = await fetch(`${BASE}/${STATS_TABLE}`, {
      method: 'POST',
      headers: AT_HEADERS,
      body: JSON.stringify({
        fields: {
          'Settimana':                        settimana,
          'Data inizio':                      dataInizio,
          'Data fine':                        dataFine,
          'Prenotazioni totali':              totPrenotazioni,
          'Persone totali':                   totPersone,
          'Prenotazioni sito':                totSito,
          'Prenotazioni telefono':            totTelefono,
          'Prenotazioni eventi':              totEventi,
          'Cancellazioni':                    totCancellate,
          'Tasso cancellazione':              tassoCancellazione,
          'Lead time medio (giorni)':         leadTimeMedio,
          'Dimensione media gruppo':          dimMediaGruppo,
          'Slot più richiesto':               slotPiuRichiesto,
          'Slot meno richiesto':              slotMenoRichiesto,
          'Giorno più pieno':                 giornopiuPieno,
          'Giorno più vuoto':                 giornopiuVuoto,
          'Fascia meno richiesta':            fasciaMenoRichiesta,
          'Coperti pranzo':                   perFascia.Pranzo.coperti,
          'Coperti aperitivo':                perFascia.Aperitivo.coperti,
          'Coperti cena':                     perFascia.Cena.coperti,
          'Pren. Lunedì':                     perGiorno[1],
          'Pren. Martedì':                    perGiorno[2],
          'Pren. Mercoledì':                  perGiorno[3],
          'Pren. Giovedì':                    perGiorno[4],
          'Pren. Venerdì':                    perGiorno[5],
          'Pren. Sabato':                     perGiorno[6],
          'Pren. Domenica':                   perGiorno[0],
          'Clienti unici':                    clientiUnici,
          'Preferenza pizza':                 prefPizza,
          'Preferenza cucina':                prefCucina,
          'Prenotazioni last minute':         lastMinute,
          'Media coperti per giorno':         mediaCopertiGiorno,
        }
      })
    })

    if (!statsRes.ok) throw new Error(await statsRes.text())

    console.log(`Statistiche ${settimana} salvate con successo.`)
    return { statusCode: 200, body: `Statistiche ${settimana} salvate` }

  } catch (err) {
    console.error('Errore statistiche:', err)
    return { statusCode: 500, body: err.message }
  }
}
