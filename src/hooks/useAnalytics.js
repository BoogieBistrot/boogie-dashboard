import { useState, useEffect, useCallback } from 'react'

const BASE_URL   = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/get-statistiche'
const CALC_URL   = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/statistiche-settimanali'
const STATS_SECRET = import.meta.env.VITE_STATS_SECRET || 'boogie-stats'

export function useAnalytics(limit = 12) {
  const [settimane, setSettimane] = useState([])
  const [loading, setLoading] = useState(true)
  const [ricalcolo, setRicalcolo] = useState(false)

  const carica = useCallback(() => {
    setLoading(true)
    fetch(`${BASE_URL}?limit=${limit}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setSettimane(json.settimane || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [limit])

  // date: "YYYY-MM-DD" opzionale — se omesso usa la settimana corrente
  const ricalcola = useCallback(async (date) => {
    setRicalcolo(true)
    try {
      const payload = { secret: STATS_SECRET }
      if (date) payload.date = date
      const res = await fetch(CALC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) await new Promise(r => setTimeout(r, 800))
      carica()
    } catch {
      setRicalcolo(false)
    }
  }, [carica])

  useEffect(() => { carica() }, [carica])

  return { settimane, loading, ricalcolo, ricarica: carica, ricalcola }
}
