import { useState, useEffect, useCallback } from 'react'

const API = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/prenotazioni-giornaliere'

export function usePrenotazioniGiornaliere() {
  const [giorni, setGiorni] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      const json = await res.json()
      if (json.success) setGiorni(json.giorni)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  return { giorni, loading, carica }
}
