// netlify/functions/statistiche-settimanali.js
// Scheduled: ogni domenica alle 23:00  →  netlify.toml: schedule = "0 23 * * 0"
// Manual trigger: POST con body { "secret": "<STATS_SECRET>" }
// Rebuild:        POST con body { "secret": "<STATS_SECRET>", "rebuildAll": true }

const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID
const AIRTABLE_TABLE    = process.env.AIRTABLE_TABLE    || 'Prenotazioni'
const AIRTABLE_ORARI    = process.env.AIRTABLE_ORARI    || 'Orari'
const AIRTABLE_CHIUSURE = process.env.AIRTABLE_CHIUSURE || 'Chiusure'
const STATS_TABLE       = 'tblQL9VX6Zx35yta5'
const BASE             = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`
const AT_HEADERS       = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

const GIORNI_NOME = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const FASCE_ORA = {
  Pranzo:    { start: 11 * 60, end: 15 * 60 },
  Aperitivo: { start: 15 * 60, end: 19 * 60 },
  Cena:      { start: 19 * 60, end: 24 * 60 },
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
  const day = d.getDay()
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

function calcTrend(current, previous) {
  if (previous == null || previous === 0) return null
  return Math.round((current - previous) / previous * 1000) / 10
}

async function fetchAllRecords(url) {
  let records = []
  let offset = null
  do {
    const fullUrl = offset ? `${url}&offset=${offset}` : url
    const res = await fetch(fullUrl, { headers: AT_HEADERS })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    records = [...records, ...(json.records || [])]
    offset = json.offset
  } while (offset)
  return records
}

// Cancella tutti i record della tabella statistiche
async function deleteAllStats() {
  const records = await fetchAllRecords(`${BASE}/${STATS_TABLE}?fields[]=Settimana`)
  const ids = records.map(r => r.id)
  for (let i = 0; i < ids.length; i += 10) {
    const params = ids.slice(i, i + 10).map(id => `records[]=${id}`).join('&')
    const res = await fetch(`${BASE}/${STATS_TABLE}?${params}`, { method: 'DELETE', headers: AT_HEADERS })
    if (!res.ok) throw new Error(await res.text())
  }
  return ids.length
}

// Cancella eventuali record esistenti per una settimana (upsert)
async function deleteStatRecordForWeek(settimana) {
  const formula = encodeURIComponent(`{Settimana} = "${settimana}"`)
  const res = await fetch(`${BASE}/${STATS_TABLE}?filterByFormula=${formula}&fields[]=Settimana`, { headers: AT_HEADERS })
  if (!res.ok) return
  const json = await res.json()
  const ids = (json.records || []).map(r => r.id)
  if (ids.length === 0) return
  for (let i = 0; i < ids.length; i += 10) {
    const params = ids.slice(i, i + 10).map(id => `records[]=${id}`).join('&')
    await fetch(`${BASE}/${STATS_TABLE}?${params}`, { method: 'DELETE', headers: AT_HEADERS })
  }
}

// Trova tutte le settimane uniche presenti in Prenotazioni, ordinate cronologicamente
async function getAllWeeksFromPrenotazioni() {
  const campi = `fields[]=${encodeURIComponent('Data')}`
  const records = await fetchAllRecords(`${BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?${campi}`)
  const weekMap = {}
  for (const r of records) {
    if (!r.fields.Data) continue
    const { mon, sun } = getWeekRange(r.fields.Data + 'T12:00:00')
    const label = getWeekLabel(mon)
    if (!weekMap[label]) weekMap[label] = { mon, sun, label }
  }
  return Object.values(weekMap).sort((a, b) => a.mon - b.mon)
}

// Se il giorno più pieno cade su un'apertura straordinaria, restituisce la descrizione
function getFestivita(weekday, mon, chiusure) {
  const d = new Date(mon)
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1)
  const dateStr = formatDate(d)
  return chiusure.find(c =>
    c.tipo === 'Data specifica' &&
    c.tipoApertura === 'Apertura straordinaria' &&
    c.dataInizio && c.dataFine &&
    dateStr >= c.dataInizio && dateStr <= c.dataFine
  )?.descrizione || null
}

// Recupera orari e chiusure da Airtable
async function fetchOrariEChiusure() {
  const [resOrari, resChiusure] = await Promise.all([
    fetch(`${BASE}/${encodeURIComponent(AIRTABLE_ORARI)}`, { headers: AT_HEADERS }),
    fetch(`${BASE}/${encodeURIComponent(AIRTABLE_CHIUSURE)}`, { headers: AT_HEADERS }),
  ])
  const [jsonOrari, jsonChiusure] = await Promise.all([resOrari.json(), resChiusure.json()])

  const orari = (jsonOrari.records || []).map(r => ({
    giorno: Array.isArray(r.fields['Giorni']) ? parseInt(r.fields['Giorni'][0]) : null,
    attivo: r.fields['Attivo'] || false,
  }))
  const chiusure = (jsonChiusure.records || []).map(r => ({
    descrizione:  r.fields['Descrizione'] || '',
    tipo:         r.fields['Tipo'] || '',
    tipoApertura: r.fields['Tipo apertura'] || 'Chiusura',
    giorno:       r.fields['Giorno'] != null ? r.fields['Giorno'] : null,
    dataInizio:   r.fields['Data inizio'] || '',
    dataFine:     r.fields['Data fine'] || '',
  }))
  return { orari, chiusure }
}

// Restituisce un Set con i numeri dei giorni aperti (0=Dom … 6=Sab) per la settimana data
function getGiorniAperti(mon, sun, orari, chiusure) {
  const aperti = new Set()
  const d = new Date(mon)
  while (d <= sun) {
    const weekday = d.getDay()
    const dateStr = formatDate(d)

    // 1. Base: aperto se esiste almeno un orario attivo per questo giorno
    let isOpen = orari.some(o => o.giorno === weekday && o.attivo)

    // 2. Chiusure ricorrenti (override base)
    const ricorrente = chiusure.find(c => c.tipo === 'Giorno ricorrente' && c.tipoApertura === 'Chiusura' && c.giorno === weekday)
    if (ricorrente) isOpen = false

    // 3. Regole su data specifica (priorità massima)
    for (const c of chiusure) {
      if (c.tipo === 'Data specifica' && c.dataInizio && c.dataFine) {
        if (dateStr >= c.dataInizio && dateStr <= c.dataFine) {
          isOpen = c.tipoApertura === 'Apertura straordinaria'
        }
      }
    }

    if (isOpen) aperti.add(weekday)
    d.setDate(d.getDate() + 1)
  }
  return aperti
}

// Calcola e salva le statistiche per una settimana
// prevStats: { prenotazioni, persone } della settimana precedente (per il trend)
async function calcAndSaveWeek(dataInizio, dataFine, settimana, prevStats) {
  const mon = new Date(dataInizio + 'T12:00:00')
  const sun = new Date(dataFine   + 'T12:00:00')

  const { orari, chiusure } = await fetchOrariEChiusure()
  const giorniAperti = getGiorniAperti(mon, sun, orari, chiusure)

  const formula = encodeURIComponent(
    `AND(DATETIME_FORMAT({Data},'YYYY-MM-DD') >= "${dataInizio}", DATETIME_FORMAT({Data},'YYYY-MM-DD') <= "${dataFine}")`
  )
  const campi = ['Nome','Data','Ora','Persone','Stato','Canale','Evento','Timestamp','Email']
    .map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
  const records = await fetchAllRecords(
    `${BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${formula}&${campi}`
  )

  const prenotazioni = records.map(r => ({
    data:      r.fields.Data      || '',
    ora:       r.fields.Ora       || '',
    persone:   parseInt(r.fields.Persone) || 0,
    stato:     r.fields.Stato     || '',
    canale:    r.fields.Canale    || '',
    evento:    r.fields.Evento    || '',
    timestamp: r.fields.Timestamp || '',
    email:     r.fields.Email     || '',
  }))

  const totali    = prenotazioni.filter(p => p.stato !== 'Cancellata')
  const cancellate = prenotazioni.filter(p => p.stato === 'Cancellata')

  const totPrenotazioni = totali.length
  const totPersone      = totali.reduce((s, p) => s + p.persone, 0)
  const totEventi       = totali.filter(p => p.evento).length
  const totSito         = totali.filter(p => p.canale === 'Sito web').length
  const totTelefono     = totali.filter(p => p.canale === 'Telefono').length
  const totCancellate   = cancellate.length
  const tassoCancellazione = prenotazioni.length > 0
    ? Math.round((totCancellate / prenotazioni.length) * 100) : 0

  const dimMediaGruppo = totPrenotazioni > 0
    ? Math.round((totPersone / totPrenotazioni) * 10) / 10 : 0

  const leadTimes = totali
    .filter(p => p.timestamp && p.data)
    .map(p => {
      const ts   = new Date(p.timestamp)
      const data = new Date(p.data + 'T12:00:00')
      return Math.max(0, Math.round((data - ts) / 86400000))
    })
  const leadTimeMedio = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((s, l) => s + l, 0) / leadTimes.length * 10) / 10 : 0

  const perGiorno = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  totali.forEach(p => {
    const d = new Date(p.data + 'T12:00:00')
    if (!isNaN(d)) perGiorno[d.getDay()]++
  })
  // Solo giorni aperti per pieno/vuoto e media
  const giorniApertiEntries = Object.entries(perGiorno).filter(([wd]) => giorniAperti.has(parseInt(wd)))
  const giorniSorted = giorniApertiEntries.length > 0
    ? giorniApertiEntries.sort((a, b) => b[1] - a[1])
    : Object.entries(perGiorno).sort((a, b) => b[1] - a[1])
  const weekdayPieno = parseInt(giorniSorted[0][0])
  const festivita = getFestivita(weekdayPieno, mon, chiusure)
  const giornopiuPieno = festivita
    ? `${GIORNI_NOME[weekdayPieno]} (${festivita})`
    : GIORNI_NOME[weekdayPieno]
  const giornopiuVuoto = GIORNI_NOME[parseInt(giorniSorted[giorniSorted.length - 1][0])]

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

  const perSlot = {}
  totali.forEach(p => { if (p.ora) perSlot[p.ora] = (perSlot[p.ora] || 0) + 1 })
  const slotSorted = Object.entries(perSlot).sort((a, b) => b[1] - a[1])
  const slotPiuRichiesto  = slotSorted[0]?.[0] || ''
  const slotMenoRichiesto = slotSorted[slotSorted.length - 1]?.[0] || ''

  const emailUniche = new Set(totali.filter(p => p.email).map(p => p.email.toLowerCase()))
  const clientiUnici = emailUniche.size

  let clientiRitorno = 0
  if (emailUniche.size > 0) {
    const formulaPrecedenti = encodeURIComponent(
      `AND(DATETIME_FORMAT({Data},'YYYY-MM-DD') < "${dataInizio}", NOT({Stato}='Cancellata'))`
    )
    const recPrecedenti = await fetchAllRecords(
      `${BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${formulaPrecedenti}&fields[]=${encodeURIComponent('Email')}`
    )
    const emailPrecedenti = new Set(
      recPrecedenti.filter(r => r.fields.Email).map(r => r.fields.Email.toLowerCase())
    )
    emailUniche.forEach(e => { if (emailPrecedenti.has(e)) clientiRitorno++ })
  }

  const lastMinute = totali.filter(p => {
    if (!p.timestamp || !p.data) return false
    const ts   = new Date(p.timestamp)
    const data = new Date(p.data + 'T12:00:00')
    return Math.round((data - ts) / 86400000) <= 1
  }).length

  const nGiorniAperti = giorniAperti.size || 1
  const mediaCopertiGiorno = Math.round((totPersone / nGiorniAperti) * 10) / 10

  const trendPrenotazioni = calcTrend(totPrenotazioni, prevStats?.prenotazioni)
  const trendPersone      = calcTrend(totPersone, prevStats?.persone)

  const statsRes = await fetch(`${BASE}/${STATS_TABLE}`, {
    method: 'POST',
    headers: AT_HEADERS,
    body: JSON.stringify({
      fields: {
        'Settimana':                                  settimana,
        'Data inizio':                                dataInizio,
        'Data fine':                                  dataFine,
        'Prenotazioni totali':                        totPrenotazioni,
        'Persone totali':                             totPersone,
        'Prenotazioni sito':                          totSito,
        'Prenotazioni telefono':                      totTelefono,
        'Prenotazioni eventi':                        totEventi,
        'Cancellazioni':                              totCancellate,
        'Tasso cancellazione':                        tassoCancellazione,
        'Lead time medio (giorni)':                   leadTimeMedio,
        'Dimensione media gruppo':                    dimMediaGruppo,
        'Slot più richiesto':                         slotPiuRichiesto,
        'Slot meno richiesto':                        slotMenoRichiesto,
        'Giorno più pieno':                           giornopiuPieno,
        'Giorno più vuoto':                           giornopiuVuoto,
        'Fascia meno richiesta':                      fasciaMenoRichiesta,
        'Coperti pranzo':                             perFascia.Pranzo.coperti,
        'Coperti aperitivo':                          perFascia.Aperitivo.coperti,
        'Coperti cena':                               perFascia.Cena.coperti,
        'Pren. Lunedì':                               perGiorno[1],
        'Pren. Martedì':                              perGiorno[2],
        'Pren. Mercoledì':                            perGiorno[3],
        'Pren. Giovedì':                              perGiorno[4],
        'Pren. Venerdì':                              perGiorno[5],
        'Pren. Sabato':                               perGiorno[6],
        'Pren. Domenica':                             perGiorno[0],
        'Clienti unici':                              clientiUnici,
        'Clienti di ritorno':                         clientiRitorno,
        'Media coperti per giorno':                   mediaCopertiGiorno,
        ...(trendPrenotazioni != null && { 'Prenotazioni ultima settimana vs precedente (%)': trendPrenotazioni }),
        ...(trendPersone      != null && { 'Persone ultima settimana vs precedente (%)':      trendPersone }),
      }
    })
  })

  if (!statsRes.ok) throw new Error(await statsRes.text())

  return { prenotazioni: totPrenotazioni, persone: totPersone }
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

  if (event?.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const isManual = event?.httpMethod === 'POST'
  let body = {}
  if (isManual) {
    try { body = JSON.parse(event.body || '{}') } catch { /* noop */ }
    const secret = process.env.STATS_SECRET || 'boogie-stats'
    if (body.secret !== secret) {
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) }
    }
  }

  try {
    // — Modalità rebuildAll: cancella tutto e ricalcola settimana per settimana —
    if (body.rebuildAll) {
      const deleted = await deleteAllStats()
      console.log(`[REBUILD] Cancellati ${deleted} record esistenti`)

      const weeks = await getAllWeeksFromPrenotazioni()
      console.log(`[REBUILD] Trovate ${weeks.length} settimane da ricalcolare`)

      const results = []
      let prevStats = null
      for (const w of weeks) {
        const dataInizio = formatDate(w.mon)
        const dataFine   = formatDate(w.sun)
        console.log(`[REBUILD] Calcolo ${w.label} (${dataInizio} → ${dataFine})`)
        prevStats = await calcAndSaveWeek(dataInizio, dataFine, w.label, prevStats)
        results.push(w.label)
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `Rebuild completato: ${results.length} settimane ricalcolate`, settimane: results }),
      }
    }

    // — Modalità singola settimana (schedulata o manuale) —
    let oggi = new Date()
    if (isManual) {
      if (body.date) oggi = new Date(body.date + 'T12:00:00')
    } else {
      oggi.setDate(oggi.getDate() - 1)
    }
    const { mon, sun } = getWeekRange(oggi)
    const dataInizio = formatDate(mon)
    const dataFine   = formatDate(sun)
    const settimana  = getWeekLabel(mon)

    console.log(`[${isManual ? 'MANUALE' : 'SCHEDULATO'}] Statistiche ${settimana} (${dataInizio} → ${dataFine})`)

    // Upsert: cancella eventuale record esistente per questa settimana
    await deleteStatRecordForWeek(settimana)

    // Cerca il record della settimana precedente per il trend
    const monPrec = new Date(mon)
    monPrec.setDate(monPrec.getDate() - 7)
    const settimanaPrec = getWeekLabel(monPrec)
    let prevStats = null
    try {
      const formula = encodeURIComponent(`{Settimana} = "${settimanaPrec}"`)
      const res = await fetch(`${BASE}/${STATS_TABLE}?filterByFormula=${formula}&fields[]=${encodeURIComponent('Prenotazioni totali')}&fields[]=${encodeURIComponent('Persone totali')}`, { headers: AT_HEADERS })
      if (res.ok) {
        const json = await res.json()
        const rec = json.records?.[0]
        if (rec) prevStats = { prenotazioni: rec.fields['Prenotazioni totali'] || 0, persone: rec.fields['Persone totali'] || 0 }
      }
    } catch { /* trend non disponibile */ }

    const result = await calcAndSaveWeek(dataInizio, dataFine, settimana, prevStats)
    const msg = `Statistiche ${settimana} salvate (${result.prenotazioni} prenotazioni, ${result.persone} persone)`
    console.log(msg)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: msg, settimana, ...result }),
    }

  } catch (err) {
    console.error('Errore statistiche:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}
