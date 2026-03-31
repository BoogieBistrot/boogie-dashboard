import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../lib/authFetch'
const BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'

export function useOrari() {
  const [orari, setOrari] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(() => {
    setLoading(true)
    authFetch(BASE + '/get-orari')
      .then(r => r.json())
      .then(json => { if (json.success) setOrari(json.orari || []); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { carica() }, [carica])

  const salva = useCallback(async (payload, id = null) => {
    const res = await authFetch(BASE + '/gestisci-orari', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id, ...payload } : payload),
    })
    return res.json()
  }, [])

  const elimina = useCallback(async (id) => {
    const res = await authFetch(`${BASE}/gestisci-orari?id=${id}`, { method: 'DELETE' })
    return res.json()
  }, [])

  return { orari, loading, ricarica: carica, salva, elimina }
}
