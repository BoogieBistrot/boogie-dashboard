import { useState, useCallback } from 'react'
const BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'
export function useFidelity() {
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(false)
  const caricaClienti = useCallback(() => {
    setLoading(true)
    fetch(BASE + '/fidelity-clienti')
      .then(r => r.json())
      .then(json => { if (json.success) setClienti(json.clienti || []); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])
  const cercaClienti = useCallback(async (q) => {
    if (!q || q.length < 2) return []
    const res = await fetch(BASE + '/fidelity-clienti?q=' + encodeURIComponent(q))
    const json = await res.json()
    return json.success ? json.clienti : []
  }, [])
  const iscrivi = useCallback(async (payload) => {
    const res = await fetch(BASE + '/fidelity-iscrizione', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.json()
  }, [])
  const ricarica = useCallback(async (payload) => {
    const res = await fetch(BASE + '/fidelity-ricarica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.json()
  }, [])
  return { clienti, loading, caricaClienti, cercaClienti, iscrivi, ricarica }
}
