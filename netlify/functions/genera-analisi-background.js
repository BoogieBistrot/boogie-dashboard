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

async function generateWeeklyAnalysis(s, settimane = []) {
  const fmt   = d => { const [,m,g] = d.split('-'); return `${g}/${m}` }
  const round1 = v => Math.round(v * 10) / 10
  const avg   = arr => arr.length ? round1(arr.reduce((a,b) => a+b, 0) / arr.length) : null
  const arrow = (val, media, higherIsBetter = true) => {
    if (media === null || media === 0) return '='
    const diff = (val - media) / media
    if (Math.abs(diff) < 0.05) return '='
    return (diff > 0) === higherIsBetter ? '↑' : '↓'
  }

  const altre = settimane.filter(w => w.settimana !== s.settimana)
  const mPren  = avg(altre.map(w => w.prenotazioni || 0))
  const mCop   = avg(altre.map(w => w.persone || 0))
  const mCanc  = avg(altre.map(w => w.tassoCancellazione || 0))
  const mLead  = avg(altre.map(w => w.leadTime || 0))
  const mGruppo = avg(altre.map(w => w.dimGruppo || 0))
  const nRef   = altre.length

  const sintesi = nRef > 0
    ? `Coperti: ${s.persone} vs ${mCop} media ${arrow(s.persone, mCop)}
Prenotazioni: ${s.prenotazioni} vs ${mPren} media ${arrow(s.prenotazioni, mPren)}
Cancellazioni: ${s.tassoCancellazione}% vs ${mCanc}% media ${arrow(s.tassoCancellazione, mCanc, false)}
Lead time: ${s.leadTime}g vs ${mLead}g media ${arrow(s.leadTime, mLead)}
Dim. gruppo: ${s.dimGruppo} pers. vs ${mGruppo} pers. media ${arrow(s.dimGruppo, mGruppo)}`
    : `Coperti: ${s.persone} | Prenotazioni: ${s.prenotazioni} | Cancellazioni: ${s.tassoCancellazione}% | Lead time: ${s.leadTime}g`

  return callGemini(`Sei l'assistente analitico del Boogie Bistrot. Genera un report settimanale strutturato per le proprietarie.

DATI SETTIMANA (${fmt(s.dataInizio)} – ${fmt(s.dataFine)}):
- Prenotazioni: ${s.prenotazioni} totali (sito: ${s.prenotazioniSito}, tel: ${s.prenotazioniTel}${s.prenotazioniEventi ? `, eventi: ${s.prenotazioniEventi}` : ''})
- Coperti: ${s.persone} (Pranzo: ${s.copertipranzo}, Aperitivo: ${s.copertiAperitivo}, Cena: ${s.copertiCena})
- Cancellazioni: ${s.cancellazioni} (${s.tassoCancellazione}%)
- Lead time medio: ${s.leadTime} giorni
- Dimensione media gruppo: ${s.dimGruppo} persone
- Clienti: ${s.clientiUnici} unici, ${s.clientiRitorno} di ritorno
- Giorno più pieno: ${s.giornopiuPieno} — più vuoto: ${s.giornopiuVuoto}
- Slot più richiesto: ${s.slotPiuRichiesto} — fascia meno richiesta: ${s.fasciaMenoRichiesta}
- Last minute: ${s.lastMinute}

Rispondi ESCLUSIVAMENTE con questo formato, nessun testo aggiuntivo fuori dalla struttura:

📈 SINTESI RAPIDA — ${fmt(s.dataInizio)} / ${fmt(s.dataFine)} vs Media
${sintesi}
[Una frase sintetica sul trend principale. Max 20 parole.]

📦 DASHBOARD ANALITICA

✅ PRO
• [punto di forza 1 — max 15 parole]
• [punto di forza 2 — max 15 parole]

⚠️ CRITICITÀ
• [criticità 1 — max 15 parole]
• [criticità 2 — max 15 parole]

💡 OPPORTUNITÀ & AZIONI
Ottimizzazione Flussi: [1 azione concreta su prenotazioni/arrivi]
Gestione Staff: [1 azione concreta su turni/risorse]
Strategia di Crescita: [1 azione concreta per aumentare volume o fidelizzazione]`)
}

async function generateGlobalAnalysis(settimane) {
  const n    = settimane.length
  const avg  = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 0
  const mode = arr => {
    const freq = {}
    arr.forEach(v => { if(v) freq[v]=(freq[v]||0)+1 })
    return Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'
  }
  const fmt = d => { const [,m,g] = (d||'').split('-'); return `${g}/${m}` }

  const mPren   = avg(settimane.map(s => s.prenotazioni || 0))
  const mCop    = avg(settimane.map(s => s.persone || 0))
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

  return callGemini(`Sei l'assistente analitico del Boogie Bistrot. Genera un report globale strategico per le proprietarie.

PERIODO: ${n} settimane (${dal} – ${al})

MEDIE SETTIMANALI:
- Prenotazioni: ${mPren}/sett.
- Coperti: ${mCop}/sett.
- Tasso cancellazione: ${mCanc}%
- Lead time medio: ${mLead} giorni
- Dimensione media gruppo: ${mGruppo} persone
- Clienti unici: ${mClienti}/sett. (di ritorno: ${mRitorno})

PATTERN RICORRENTI:
- Giorno più frequentato: ${giornoTop}
- Slot più richiesto: ${slotTop}
- Fascia meno richiesta: ${fasciaMin}

Rispondi ESCLUSIVAMENTE con questo formato, nessun testo aggiuntivo fuori dalla struttura:

📈 TREND GLOBALE — ${n} settimane (${dal} – ${al})
Media coperti: ${mCop}/sett. | Media prenotazioni: ${mPren}/sett. | Cancellazioni: ${mCanc}% | Lead time: ${mLead}g
[Una frase sintetica sull'andamento generale del periodo. Max 20 parole.]

📦 DASHBOARD ANALITICA

✅ PUNTI DI FORZA
• [punto di forza ricorrente 1 — max 15 parole]
• [punto di forza ricorrente 2 — max 15 parole]

⚠️ CRITICITÀ RICORRENTI
• [criticità strutturale 1 — max 15 parole]
• [criticità strutturale 2 — max 15 parole]

💡 AZIONI STRATEGICHE
Ottimizzazione Flussi: [1 azione concreta basata sui pattern di prenotazione]
Gestione Staff: [1 azione concreta su organizzazione risorse]
Strategia di Crescita: [1 azione concreta per colmare i gap emersi dal periodo]`)
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
        const analisi = await generateWeeklyAnalysis(s, settimane)
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

    // Newsletter con l'ultima settimana (temporaneamente disabilitata)
    // if (ultimoRecord.analisiAi && analisiGlobal) {
    //   try {
    //     await sendNewsletter(ultimoRecord.analisiAi, analisiGlobal, ultimoRecord, settimane.length)
    //   } catch (e) { console.error('✗ Newsletter:', e.message) }
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, settimaneGenerate: generate, globaleGenerata: !!analisiGlobal }),
    }
  } catch (err) {
    console.error('Errore genera-analisi:', err)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) }
  }
}
