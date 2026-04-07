import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../lib/authFetch'

const BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'

export function useTag() {
  const [tag, setTag] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(() => {
    setLoading(true)
    authFetch(BASE + '/get-tag')
      .then(r => r.json())
      .then(json => { if (json.success) setTag(json.tag || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { carica() }, [carica])

  const aggiungi = useCallback(async (nome) => {
    const res = await authFetch(BASE + '/gestisci-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome })
    })
    const json = await res.json()
    if (json.success) carica()
    return json
  }, [carica])

  const elimina = useCallback(async (id) => {
    const res = await authFetch(`${BASE}/gestisci-tag?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) carica()
    return json
  }, [carica])

  return { tag, loading, carica, aggiungi, elimina }
}
