import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../lib/authFetch'
const BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'
export function useChiusure() {
  const [chiusure, setChiusure] = useState([])
  const [loading, setLoading] = useState(true)
  const carica = useCallback(() => {
    setLoading(true)
    authFetch(BASE + '/get-chiusure')
      .then(r => r.json())
      .then(json => { if (json.success) setChiusure(json.chiusure || []); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { carica() }, [carica])
  const salva = useCallback(async (payload, id = null) => {
    const res = await authFetch(BASE + '/gestisci-chiusure', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id, ...payload } : payload)
    })
    return res.json()
  }, [])
  const elimina = useCallback(async (id) => {
    const res = await authFetch(`${BASE}/gestisci-chiusure?id=${id}`, { method: 'DELETE' })
    return res.json()
  }, [])
  return { chiusure, loading, ricarica: carica, salva, elimina }
}
