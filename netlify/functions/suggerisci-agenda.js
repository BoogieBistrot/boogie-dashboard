const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fasi(dataEvento) {
  return {
    teaser:       addDays(dataEvento, -14),
    prenotazioni: addDays(dataEvento, -10),
    lastMinute:   addDays(dataEvento, -3),
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  const { verifyToken } = require('./verifyToken')
  if (!verifyToken(event)) return { statusCode: 401, headers: CORS, body: JSON.stringify({ success: false, error: 'Non autorizzato' }) }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' }

  try {
    const { appuntamenti, festivita, dataOggi } = JSON.parse(event.body)

    // Filtra le festività già coperte (evento entro ±3 giorni)
    const festScoperte = festivita.filter(f => {
      const festData = new Date(f.date + 'T12:00:00')
      return !appuntamenti.some(a => {
        if (!a.data) return false
        const diff = Math.abs(new Date(a.data + 'T12:00:00') - festData) / (1000 * 60 * 60 * 24)
        return diff <= 3
      })
    })

    if (festScoperte.length === 0) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, suggerimenti: [] }) }
    }

    const oggiDate = new Date(dataOggi + 'T12:00:00')
    const festStr = festScoperte.map(f => {
      const giorni = Math.round((new Date(f.date + 'T12:00:00') - oggiDate) / 86400000)
      return `- ${f.date} (tra ${giorni} giorni): ${f.title}`
    }).join('\n')

    const prompt = `Sei un assistente per il ristorante "Boogie Bistrot".
Oggi è ${dataOggi}.

Queste festività non hanno ancora nulla in agenda (con quanti giorni mancano):
${festStr}

Per ognuna crea un suggerimento colloquiale e diretto, come se stessi parlando con le proprietarie.
Usa direttamente il nome della festività senza articoli ("Pasquetta", "25 aprile", "Primo Maggio").

Regole sui tempi (usa questo schema per calibrare il consiglio):
- Meno di 2 giorni: è troppo tardi per organizzare qualcosa — sii onesta, non ha senso spendere soldi in sponsorizzate adesso
- 2-4 giorni: pochissimo tempo — al massimo un post organico o Stories con link WhatsApp, niente di strutturato
- 5-14 giorni: finestra ideale — conviene muoversi subito, c'è ancora tempo utile
- Più di 21 giorni: è presto — meglio fare brand awareness senza chiedere prenotazioni

Rispondi SOLO con un JSON in questo formato:
{
  "suggerimenti": [
    {
      "festivita": "nome breve",
      "testo": "frase breve e diretta che tiene conto dell'urgenza",
      "evento": {
        "title": "titolo evento da creare",
        "data": "YYYY-MM-DD",
        "tipo": "Appuntamento"
      }
    }
  ]
}`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      })
    })

    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const parsed = JSON.parse(content)

    // Aggiungi la data certa della festività (non quella generata dall'AI) e le fasi
    const suggerimenti = (parsed.suggerimenti || []).map(s => {
      const fest = festScoperte.find(f =>
        f.title.toLowerCase().includes(s.festivita.toLowerCase()) ||
        s.festivita.toLowerCase().includes(f.title.toLowerCase())
      )
      const dataFestivita = fest?.date || s.evento?.data
      return {
        ...s,
        dataFestivita,
      }
    })

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, suggerimenti }) }
  } catch (e) {
    console.error('suggerisci-agenda error:', e.message?.slice(0, 300))
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: e.message }) }
  }
}
