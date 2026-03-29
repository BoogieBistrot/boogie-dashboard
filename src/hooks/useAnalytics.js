import { useState, useEffect, useCallback } from 'react'

const BASE_URL = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/get-statistiche'

export function useAnalytics() {
  const [settimane, setSettimane] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(() => {
    setLoading(true)
    fetch(`${BASE_URL}?limit=12`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setSettimane(json.settimane || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { carica() }, [carica])

  return { settimane, loading, ricarica: carica }
}
