import { useState, useEffect, useCallback } from 'react'
export function usePrenotazioni() {
  const [attesa, setAttesa] = useState([])
  const [loading, setLoading] = useState(true)
  const carica = useCallback(() => {
    setLoading(true)
    fetch('https://shimmering-sundae-54b044.netlify.app/.netlify/functions/prenotazioni-attesa')
      .then(r => r.json())
      .then(json => { if (json.success) setAttesa(json.prenotazioni || []); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { carica() }, [carica])
  return { attesa, loading, ricarica: carica }
}
