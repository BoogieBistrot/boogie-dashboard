
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

let ultimaChiamata = 0

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  const { verifyToken } = require('./verifyToken')
  if (!verifyToken(event)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' }

  const ora = Date.now()
  if (ora - ultimaChiamata < 10000) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ success: false, error: 'Troppe richieste, riprova tra qualche secondo.' }) }
  }
  ultimaChiamata = ora

  const GEMINI_API_KEY = process.env.MY_NEW_GEMINI_KEY_2026
  console.log('Chiave API caricata:', GEMINI_API_KEY ? `SÌ (inizia con ${GEMINI_API_KEY.substring(0, 8)})` : 'NO — VARIABILE MANCANTE')

  if (!GEMINI_API_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Chiave API non configurata.' }) }
  }

  const { appuntamenti, festivita, dataOggi } = JSON.parse(event.body)

  const festScoperte = festivita.filter(f => {
    const festData = new Date(f.date + 'T12:00:00')
    return !appuntamenti.some(a => {
      if (!a.data) return false
      const diff = Math.abs(new Date(a.data + 'T12:00:00') - festData) / (1000 * 60 * 60 * 24)
      return diff <= 3
    })
  })

  console.log(`festività scoperte = ${festScoperte.length}, appuntamenti ricevuti = ${appuntamenti.length}`)

  if (festScoperte.length === 0) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, suggerimenti: [] }) }
  }

  const oggiDate = new Date(dataOggi + 'T12:00:00')

  const prime2 = festScoperte.slice(0, 2)
  const lista = prime2.map(f => {
    const giorni = Math.round((new Date(f.date + 'T12:00:00') - oggiDate) / 86400000)
    return `${f.title} (tra ${giorni} giorni)`
  }).join(', ')

  const prompt = `Sei l'assistente del Boogie Bistrot. Per queste festività: ${lista}, scrivi un consiglio strategico di max 15 parole ciascuna. Separa ogni consiglio con il simbolo |. Non aggiungere altro testo.`

  const modelli = ['gemini-2.5-flash', 'gemini-2.0-flash-lite-001']
  let res, json

  for (const modello of modelli) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${GEMINI_API_KEY}`
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      })
    })
    console.log(`STATUS GOOGLE (${modello}):`, res.status)
    json = await res.json()
    if (res.ok) break
    console.error(`ERRORE GOOGLE (${modello}):`, res.status, JSON.stringify(json?.error))
  }

  if (!res.ok) {
    const code = json?.error?.code
    if (code === 429) return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: false, error: 'Quota API esaurita, riprova più tardi.' }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: false, error: json?.error?.message || 'Errore API Gemini' }) }
  }

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
  console.log('Testo grezzo da Google:', raw)

  const consigli = raw.split('|').map(s => s.trim()).filter(Boolean)

  const suggerimenti = prime2.map((fest, i) => ({
    festivita: fest.title,
    testo: consigli[i] || '',
    categoria: '',
    dataFestivita: fest.date,
  }))

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, suggerimenti }) }
}
