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

  // Giorni chiusi della settimana (tutti i 7 giorni tranne quelli aperti)
  const giorniChiusi = [1,2,3,4,5,6,0]
    .filter(wd => !giorniAperti.has(wd))
    .map(wd => GIORNI_NOME[wd])
    .join(', ')

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
        'Giorni chiusi':                              giorniChiusi,
        ...(trendPrenotazioni != null && { 'Prenotazioni ultima settimana vs precedente (%)': trendPrenotazioni }),
        ...(trendPersone      != null && { 'Persone ultima settimana vs precedente (%)':      trendPersone }),
      }
    })
  })

  if (!statsRes.ok) throw new Error(await statsRes.text())
  const statsJson = await statsRes.json()

  return {
    prenotazioni: totPrenotazioni,
    persone:      totPersone,
    recordId:     statsJson.id,
    statsForAI: {
      dataInizio, dataFine, settimana,
      prenotazioni:        totPrenotazioni,
      persone:             totPersone,
      prenotazioniSito:    totSito,
      prenotazioniTel:     totTelefono,
      prenotazioniEventi:  totEventi,
      cancellazioni:       totCancellate,
      tassoCancellazione,
      leadTime:            leadTimeMedio,
      dimGruppo:           dimMediaGruppo,
      clientiUnici,
      clientiRitorno,
      giornopiuPieno,
      giornopiuVuoto,
      slotPiuRichiesto,
      fasciaMenoRichiesta,
      lastMinute,
      copertipranzo:    perFascia.Pranzo.coperti,
      copertiAperitivo: perFascia.Aperitivo.coperti,
      copertiCena:      perFascia.Cena.coperti,
    },
  }
}

// Aggiorna un record esistente con nuovi campi
async function patchStatRecord(recordId, fields) {
  await fetch(`${BASE}/${STATS_TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: AT_HEADERS,
    body: JSON.stringify({ fields }),
  })
}

// Chiama Gemini e restituisce il testo generato
async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error('Gemini API key mancante')
  const modelli = ['gemini-2.5-flash', 'gemini-2.0-flash']
  for (const modello of modelli) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    )
    const json = await res.json()
    if (res.ok) return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }
  throw new Error('Gemini non disponibile')
}

// Genera analisi settimanale
async function generateWeeklyAnalysis(s, settimane = []) {
  const fmt = d => { const [,m,g] = d.split('-'); return `${g}/${m}` }

  return callGemini(`Sei l'assistente analitico del Boogie Bistrot. Analizza i dati della settimana ${fmt(s.dataInizio)}–${fmt(s.dataFine)} e produci un report per le proprietarie.

DATI:
- Prenotazioni: ${s.prenotazioni} (sito: ${s.prenotazioniSito}, tel: ${s.prenotazioniTel}${s.prenotazioniEventi ? `, eventi: ${s.prenotazioniEventi}` : ''})
- Coperti: ${s.persone} (Pranzo: ${s.copertipranzo}, Aperitivo: ${s.copertiAperitivo}, Cena: ${s.copertiCena})
- Cancellazioni: ${s.cancellazioni} (${s.tassoCancellazione}%) — Lead time: ${s.leadTime}g — Gruppo medio: ${s.dimGruppo} pers.
- Clienti: ${s.clientiUnici} unici, ${s.clientiRitorno} di ritorno — Last minute: ${s.lastMinute}
- Giorno più pieno: ${s.giornopiuPieno} — più vuoto: ${s.giornopiuVuoto}
- Slot più richiesto: ${s.slotPiuRichiesto} — fascia meno richiesta: ${s.fasciaMenoRichiesta}

Rispondi ESCLUSIVAMENTE con questo formato, nessun testo fuori dalla struttura:

✅ PRO
• [punto di forza 1 — max 12 parole]
• [punto di forza 2 — max 12 parole]

⚠️ CRITICITÀ
• [criticità 1 — max 12 parole]
• [criticità 2 — max 12 parole]

💡 OPPORTUNITÀ & AZIONI
Ottimizzazione Flussi: [azione concreta — max 15 parole]
Gestione Staff: [azione concreta — max 15 parole]
Strategia di Crescita: [azione concreta — max 15 parole]`)
}

// Genera analisi globale su tutte le settimane
async function generateGlobalAnalysis(settimane) {
  const n    = settimane.length
  const avg  = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 0
  const mode = arr => {
    const freq = {}
    arr.forEach(v => { if(v) freq[v] = (freq[v]||0)+1 })
    return Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'
  }
  const fmt = d => { const [,m,g] = (d||'').split('-'); return `${g}/${m}` }

  const mPren   = avg(settimane.map(s => s.prenotazioniTotali || 0))
  const mCop    = avg(settimane.map(s => s.personeTotali || 0))
  const mCanc   = avg(settimane.map(s => s.tassoCancellazione || 0))
  const mLead   = avg(settimane.map(s => s.leadTime || 0))
  const mGruppo = avg(settimane.map(s => s.dimGruppo || 0))
  const mClienti = avg(settimane.map(s => s.clientiUnici || 0))
  const mRitorno = avg(settimane.map(s => s.clientiRitorno || 0))
  const giornoTop = mode(settimane.map(s => (s.giornopiuPieno||'').replace(/\s*\(.*\)/,'')))
  const slotTop   = mode(settimane.map(s => s.slotPiuRichiesto))
  const fasciaMin = mode(settimane.map(s => s.fasciaMenoRichiesta))
  const dal = fmt(settimane[settimane.length-1].dataInizio)
  const al  = fmt(settimane[0].dataFine)

  return callGemini(`Sei l'assistente analitico del Boogie Bistrot. Analizza ${n} settimane (${dal}–${al}) e produci un report strategico per le proprietarie.

MEDIE: ${mPren} pren./sett. — ${mCop} coperti/sett. — ${mCanc}% cancellazioni — lead time ${mLead}g — gruppo ${mGruppo} pers. — ${mClienti} clienti unici/sett. (${mRitorno} di ritorno)
PATTERN: giorno top ${giornoTop} — slot top ${slotTop} — fascia debole ${fasciaMin}

Rispondi ESCLUSIVAMENTE con questo formato, nessun testo fuori dalla struttura:

✅ PRO
• [punto di forza ricorrente 1 — max 12 parole]
• [punto di forza ricorrente 2 — max 12 parole]

⚠️ CRITICITÀ
• [criticità strutturale 1 — max 12 parole]
• [criticità strutturale 2 — max 12 parole]

💡 OPPORTUNITÀ & AZIONI
Ottimizzazione Flussi: [azione concreta — max 15 parole]
Gestione Staff: [azione concreta — max 15 parole]
Strategia di Crescita: [azione concreta — max 15 parole]`)
}

// Recupera tutti i record statistiche per l'analisi globale
async function fetchAllStatsRecords() {
  const fields = ['Settimana','Data inizio','Data fine','Prenotazioni totali','Persone totali',
    'Tasso cancellazione','Lead time medio (giorni)','Dimensione media gruppo',
    'Clienti unici','Clienti di ritorno','Giorno più pieno','Slot più richiesto','Fascia meno richiesta']
    .map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
  const records = await fetchAllRecords(
    `${BASE}/${STATS_TABLE}?sort[0][field]=Data%20inizio&sort[0][direction]=desc&${fields}`
  )
  return records.map(r => ({
    dataInizio:          r.fields['Data inizio'] || '',
    dataFine:            r.fields['Data fine'] || '',
    prenotazioniTotali:  r.fields['Prenotazioni totali'] || 0,
    personeTotali:       r.fields['Persone totali'] || 0,
    tassoCancellazione:  parseFloat(String(r.fields['Tasso cancellazione']||'0').replace('%','')) || 0,
    leadTime:            r.fields['Lead time medio (giorni)'] || 0,
    dimGruppo:           r.fields['Dimensione media gruppo'] || 0,
    clientiUnici:        r.fields['Clienti unici'] || 0,
    clientiRitorno:      r.fields['Clienti di ritorno'] || 0,
    giornopiuPieno:      r.fields['Giorno più pieno'] || '',
    slotPiuRichiesto:    r.fields['Slot più richiesto'] || '',
    fasciaMenoRichiesta: r.fields['Fascia meno richiesta'] || '',
  }))
}

// Invia newsletter via Brevo
async function sendNewsletter(analisiWeek, analisiGlobal, s, nSettimane) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const EMAIL_FROM    = process.env.EMAIL_FROM || 'noreply@boogiebistrot.com'
  if (!BREVO_API_KEY) { console.warn('Brevo non configurato, newsletter saltata'); return }

  const fmt = d => { const [,m,g] = d.split('-'); return `${g}/${m}` }
  const kpi = (val, label) => `<td style="padding:0 8px 8px 0;"><div style="background:#f5f5f5;padding:12px 18px;border-radius:6px;text-align:center;"><div style="font-size:22px;font-weight:bold;color:#c8a96e;">${val}</div><div style="font-size:10px;text-transform:uppercase;color:#888;margin-top:3px;">${label}</div></div></td>`

  const parseSection = (text, emoji) => {
    const match = text.match(new RegExp(`${emoji}[^\\n]*\\n([\\s\\S]*?)(?=✅|⚠️|💡|$)`))
    return (match?.[1] || '').trim().split('\n').filter(Boolean)
      .map(l => `<div style="margin-bottom:8px;font-size:14px;line-height:1.5;">${l}</div>`).join('')
  }

  const box = (emoji, title, content, bg, border) =>
    `<td style="width:33%;vertical-align:top;padding:0 6px;">
      <div style="background:${bg};border-top:3px solid ${border};border-radius:6px;padding:16px 14px;height:100%;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:${border};margin-bottom:12px;">${emoji} ${title}</div>
        ${content}
      </div>
    </td>`

  const buildBoxes = (text) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
      <tr>
        ${box('✅','PRO', parseSection(text,'✅'), '#f0faf0', '#2e7d32')}
        ${box('⚠️','CRITICITÀ', parseSection(text,'⚠️'), '#fff8f0', '#e65100')}
        ${box('💡','OPPORTUNITÀ', parseSection(text,'💡'), '#f0f4ff', '#1565c0')}
      </tr>
    </table>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Georgia,serif;color:#333;background:#f9f9f9;margin:0;padding:0;">
<div style="max-width:640px;margin:0 auto;background:#fff;">
  <div style="background:#1a1a1a;color:#fff;padding:28px 32px;text-align:center;">
    <div style="font-size:11px;letter-spacing:4px;color:#c8a96e;margin-bottom:8px;text-transform:uppercase;">Boogie Bistrot</div>
    <div style="font-size:20px;font-weight:bold;letter-spacing:1px;">Report Settimanale</div>
    <div style="font-size:13px;color:#aaa;margin-top:6px;">${fmt(s.dataInizio)} – ${fmt(s.dataFine)}</div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <table cellpadding="0" cellspacing="0">
      <tr>
        ${kpi(s.prenotazioni,'Prenotazioni')}${kpi(s.persone,'Coperti')}${kpi(s.tassoCancellazione+'%','Cancellazioni')}${kpi(s.leadTime+'g','Anticipo medio')}
      </tr>
    </table>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:16px;">Analisi settimana</div>
    ${buildBoxes(analisiWeek)}
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:4px;">Trend globale</div>
    <div style="font-size:12px;color:#bbb;margin-bottom:16px;">${nSettimane} settimane analizzate</div>
    ${buildBoxes(analisiGlobal)}
  </div>
  <div style="padding:20px 32px;text-align:center;font-size:11px;color:#bbb;">
    Report automatico generato ogni domenica sera • Boogie Bistrot Analytics
  </div>
</div></body></html>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      sender:      { email: EMAIL_FROM, name: 'Boogie Bistrot Analytics' },
      to:          [{ email: 'info@boogiebistrot.com', name: 'Boogie Bistrot' }],
      subject:     `Report settimanale Boogie Bistrot — ${fmt(s.dataInizio)} / ${fmt(s.dataFine)}`,
      htmlContent: html,
    }),
  })
  if (!res.ok) console.error('Errore invio newsletter:', await res.text())
  else console.log('Newsletter inviata a info@boogiebistrot.com')
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
        const result = await calcAndSaveWeek(dataInizio, dataFine, w.label, prevStats)
        prevStats = result
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

    // Fetch storico per analisi AI (usato sia per weekly che per global)
    let tutteSettimane = []
    try {
      tutteSettimane = await fetchAllStatsRecords()
    } catch (e) { console.error('fetchAllStatsRecords fallita:', e.message) }

    // Analisi AI settimanale
    let analisiWeek = ''
    try {
      analisiWeek = await generateWeeklyAnalysis(result.statsForAI, tutteSettimane)
      await patchStatRecord(result.recordId, { 'Analisi AI': analisiWeek })
      console.log('Analisi AI settimanale salvata')
    } catch (e) { console.error('Analisi AI settimanale fallita:', e.message) }

    // Analisi AI globale (su tutte le settimane) salvata nel record corrente
    let analisiGlobal = ''
    try {
      analisiGlobal = await generateGlobalAnalysis(tutteSettimane)
      await patchStatRecord(result.recordId, { 'Analisi AI Globale': analisiGlobal })
      console.log('Analisi AI globale salvata')
    } catch (e) { console.error('Analisi AI globale fallita:', e.message) }

    // Newsletter
    if (analisiWeek) {
      try {
        await sendNewsletter(analisiWeek, analisiGlobal, result.statsForAI, tutteSettimane.length)
      } catch (e) { console.error('Newsletter fallita:', e.message) }
    }

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
