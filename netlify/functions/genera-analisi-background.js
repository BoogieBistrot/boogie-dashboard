// netlify/functions/genera-analisi-background.js
// Funzione background (timeout 15 min) — genera analisi AI per tutte le settimane
// Trigger: POST { "secret": "<STATS_SECRET>" }
// Opzionale: { "force": true } per rigenerare anche settimane che hanno già l'analisi

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const STATS_TABLE      = 'tblQL9VX6Zx35yta5'
const BASE             = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`
const AT_HEADERS       = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

async function fetchAllRecords(url) {
  let records = [], offset = null
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

async function patchStatRecord(recordId, fields) {
  await fetch(`${BASE}/${STATS_TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: AT_HEADERS,
    body: JSON.stringify({ fields }),
  })
}

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.MY_NEW_GEMINI_KEY_2026
  if (!GEMINI_API_KEY) throw new Error('Gemini API key mancante')
  const modelli = ['gemini-2.5-flash', 'gemini-2.0-flash-lite-001']
  for (const modello of modelli) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      }
    )
    const json = await res.json()
    if (res.ok) return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }
  throw new Error('Gemini non disponibile')
}

async function generateWeeklyAnalysis(s) {
  const fmt = d => { const [,m,g] = d.split('-'); return `${g}/${m}` }
  return callGemini(`Sei l'assistente analitico del Boogie Bistrot, un bistrot italiano. Analizza i dati della settimana dal ${fmt(s.dataInizio)} al ${fmt(s.dataFine)} e scrivi un report professionale per le proprietarie del locale.

DATI SETTIMANA:
- Prenotazioni: ${s.prenotazioni} totali (sito web: ${s.prenotazioniSito}, telefono: ${s.prenotazioniTel}${s.prenotazioniEventi ? `, eventi: ${s.prenotazioniEventi}` : ''})
- Coperti: ${s.persone} totali (Pranzo: ${s.copertipranzo}, Aperitivo: ${s.copertiAperitivo}, Cena: ${s.copertiCena})
- Cancellazioni: ${s.cancellazioni} (${s.tassoCancellazione}%)
- Anticipo medio prenotazione: ${s.leadTime} giorni prima dell'arrivo
- Dimensione media gruppo: ${s.dimGruppo} persone
- Clienti: ${s.clientiUnici} unici (${s.clientiRitorno} di ritorno)
- Giorno più frequentato: ${s.giornopiuPieno} — meno frequentato: ${s.giornopiuVuoto}
- Slot più richiesto: ${s.slotPiuRichiesto} — fascia meno richiesta: ${s.fasciaMenoRichiesta}
- Prenotazioni last minute (stesso giorno o giorno prima): ${s.lastMinute}

Rispondi SOLO con questo formato esatto, senza introduzioni né conclusioni:

✅ PUNTI POSITIVI
• [punto]
• [punto]

⚠️ CRITICITÀ
• [punto]
• [punto]

💡 OPPORTUNITÀ PER LA PROSSIMA SETTIMANA
• [azione concreta]
• [azione concreta]

Massimo 2-3 bullet per sezione. Ogni bullet massimo 15 parole. Tono diretto e pratico.`)
}

async function generateGlobalAnalysis(settimane) {
  const n = settimane.length
  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 0
  const mode = arr => {
    const freq = {}
    arr.forEach(v => { if(v) freq[v]=(freq[v]||0)+1 })
    return Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'
  }
  const fmt = d => { const [,m,g] = (d||'').split('-'); return `${g}/${m}` }

  return callGemini(`Sei l'assistente analitico del Boogie Bistrot. Analizza i dati aggregati delle ultime ${n} settimane (dal ${fmt(settimane[settimane.length-1].dataInizio)} al ${fmt(settimane[0].dataFine)}) e scrivi un report strategico per le proprietarie.

MEDIE SETTIMANALI:
- Prenotazioni: ${avg(settimane.map(s=>s.prenotazioni))} a settimana
- Coperti: ${avg(settimane.map(s=>s.persone))} a settimana
- Tasso cancellazione: ${avg(settimane.map(s=>s.tassoCancellazione))}%
- Anticipo medio prenotazione: ${avg(settimane.map(s=>s.leadTime))} giorni
- Dimensione media gruppo: ${avg(settimane.map(s=>s.dimGruppo))} persone
- Clienti unici: ${avg(settimane.map(s=>s.clientiUnici))}/sett. (di ritorno: ${avg(settimane.map(s=>s.clientiRitorno))})

PATTERN RICORRENTI:
- Giorno più frequentato: ${mode(settimane.map(s=>(s.giornopiuPieno||'').replace(/\s*\(.*\)/,'')))}
- Slot più richiesto: ${mode(settimane.map(s=>s.slotPiuRichiesto))}
- Fascia meno richiesta: ${mode(settimane.map(s=>s.fasciaMenoRichiesta))}

Rispondi SOLO con questo formato esatto, senza introduzioni né conclusioni:

✅ PUNTI DI FORZA DEL PERIODO
• [punto]
• [punto]

⚠️ CRITICITÀ RICORRENTI
• [punto]
• [punto]

💡 AZIONI STRATEGICHE
• [azione concreta]
• [azione concreta]

Massimo 2-3 bullet per sezione. Ogni bullet massimo 15 parole. Tono diretto e strategico.`)
}

async function sendNewsletter(analisiWeek, analisiGlobal, s, nSettimane) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const EMAIL_FROM    = process.env.EMAIL_FROM || 'noreply@boogiebistrot.com'
  if (!BREVO_API_KEY) { console.warn('Brevo non configurato'); return }

  const fmt = d => { const [,m,g] = d.split('-'); return `${g}/${m}` }
  const toP = text => text.split('\n').filter(Boolean).map(p => `<p style="margin:0 0 12px;">${p}</p>`).join('')
  const kpi = (val, label) => `<div style="background:#f5f5f5;padding:12px 18px;border-radius:6px;min-width:110px;display:inline-block;margin:0 8px 8px 0;"><div style="font-size:22px;font-weight:bold;color:#c8a96e;">${val}</div><div style="font-size:10px;text-transform:uppercase;color:#888;margin-top:3px;">${label}</div></div>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Georgia,serif;color:#333;background:#f9f9f9;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#1a1a1a;color:#fff;padding:28px 32px;text-align:center;">
    <div style="font-size:11px;letter-spacing:4px;color:#c8a96e;margin-bottom:8px;text-transform:uppercase;">Boogie Bistrot</div>
    <div style="font-size:20px;font-weight:bold;letter-spacing:1px;">Report Settimanale</div>
    <div style="font-size:13px;color:#aaa;margin-top:6px;">${fmt(s.dataInizio)} – ${fmt(s.dataFine)}</div>
  </div>
  <div style="padding:28px 32px;border-bottom:1px solid #eee;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:16px;">Dati della settimana</div>
    ${kpi(s.prenotazioni,'Prenotazioni')}${kpi(s.persone,'Coperti')}${kpi(s.tassoCancellazione+'%','Cancellazioni')}${kpi(s.leadTime+'g','Anticipo medio')}
  </div>
  <div style="padding:28px 32px;border-bottom:1px solid #eee;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:16px;">Analisi della settimana</div>
    <div style="line-height:1.75;font-size:15px;">${toP(analisiWeek)}</div>
  </div>
  <div style="padding:28px 32px;border-bottom:1px solid #eee;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:6px;">Analisi globale</div>
    <div style="font-size:12px;color:#bbb;margin-bottom:14px;">${nSettimane} settimane analizzate</div>
    <div style="line-height:1.75;font-size:15px;">${toP(analisiGlobal)}</div>
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
  if (!res.ok) console.error('Errore newsletter:', await res.text())
  else console.log('Newsletter inviata')
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { /* noop */ }
  const secret = process.env.STATS_SECRET || 'boogie-stats'
  if (body.secret !== secret) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Unauthorized' }) }
  }

  const force = body.force === true

  try {
    // Recupera tutti i record statistiche
    const fields = ['Settimana','Data inizio','Data fine','Prenotazioni totali','Persone totali',
      'Prenotazioni sito','Prenotazioni telefono','Prenotazioni eventi',
      'Cancellazioni','Tasso cancellazione','Lead time medio (giorni)','Dimensione media gruppo',
      'Clienti unici','Clienti di ritorno','Giorno più pieno','Giorno più vuoto',
      'Slot più richiesto','Fascia meno richiesta','Coperti pranzo','Coperti aperitivo','Coperti cena',
      'Prenotazioni last minute','Analisi AI']
      .map(f => `fields[]=${encodeURIComponent(f)}`).join('&')

    const records = await fetchAllRecords(
      `${BASE}/${STATS_TABLE}?sort[0][field]=Data%20inizio&sort[0][direction]=asc&${fields}`
    )

    console.log(`Trovati ${records.length} record. force=${force}`)

    const settimane = records.map(r => ({
      id:                r.id,
      dataInizio:        r.fields['Data inizio'] || '',
      dataFine:          r.fields['Data fine'] || '',
      settimana:         r.fields['Settimana'] || '',
      prenotazioni:      r.fields['Prenotazioni totali'] || 0,
      persone:           r.fields['Persone totali'] || 0,
      prenotazioniSito:  r.fields['Prenotazioni sito'] || 0,
      prenotazioniTel:   r.fields['Prenotazioni telefono'] || 0,
      prenotazioniEventi:r.fields['Prenotazioni eventi'] || 0,
      cancellazioni:     r.fields['Cancellazioni'] || 0,
      tassoCancellazione:parseFloat(String(r.fields['Tasso cancellazione']||'0').replace('%','')) || 0,
      leadTime:          r.fields['Lead time medio (giorni)'] || 0,
      dimGruppo:         r.fields['Dimensione media gruppo'] || 0,
      clientiUnici:      r.fields['Clienti unici'] || 0,
      clientiRitorno:    r.fields['Clienti di ritorno'] || 0,
      giornopiuPieno:    r.fields['Giorno più pieno'] || '',
      giornopiuVuoto:    r.fields['Giorno più vuoto'] || '',
      slotPiuRichiesto:  r.fields['Slot più richiesto'] || '',
      fasciaMenoRichiesta:r.fields['Fascia meno richiesta'] || '',
      copertipranzo:     r.fields['Coperti pranzo'] || 0,
      copertiAperitivo:  r.fields['Coperti aperitivo'] || 0,
      copertiCena:       r.fields['Coperti cena'] || 0,
      lastMinute:        r.fields['Prenotazioni last minute'] || 0,
      analisiAi:         r.fields['Analisi AI'] || '',
    }))

    // Genera analisi settimanale per ogni record che ne è privo (o force=true)
    let generate = 0
    for (const s of settimane) {
      if (!force && s.analisiAi) { console.log(`Skip ${s.settimana} (ha già analisi)`); continue }
      try {
        console.log(`Genero analisi per ${s.settimana}…`)
        const analisi = await generateWeeklyAnalysis(s)
        await patchStatRecord(s.id, { 'Analisi AI': analisi })
        s.analisiAi = analisi
        generate++
        console.log(`✓ ${s.settimana} fatto`)
      } catch (e) { console.error(`✗ ${s.settimana}:`, e.message) }
    }

    // Analisi globale — salvata sull'ultimo record (il più recente)
    const ultimoRecord = settimane[settimane.length - 1]
    let analisiGlobal = ''
    try {
      console.log('Genero analisi globale…')
      analisiGlobal = await generateGlobalAnalysis([...settimane].reverse())
      await patchStatRecord(ultimoRecord.id, { 'Analisi AI Globale': analisiGlobal })
      console.log('✓ Analisi globale salvata')
    } catch (e) { console.error('✗ Analisi globale:', e.message) }

    // Newsletter con l'ultima settimana
    if (ultimoRecord.analisiAi && analisiGlobal) {
      try {
        await sendNewsletter(ultimoRecord.analisiAi, analisiGlobal, ultimoRecord, settimane.length)
      } catch (e) { console.error('✗ Newsletter:', e.message) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, settimaneGenerate: generate, globaleGenerata: !!analisiGlobal }),
    }
  } catch (err) {
    console.error('Errore genera-analisi:', err)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) }
  }
}
