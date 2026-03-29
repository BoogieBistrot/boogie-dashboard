import { useState, useEffect, useCallback } from 'react'

const API = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/gestisci-appuntamenti'

export function useAppuntamenti() {
  const [appuntamenti, setAppuntamenti] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      const json = await res.json()
      if (json.success) setAppuntamenti(json.appuntamenti || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  async function aggiungi(dati) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati),
    })
    const json = await res.json()
    if (json.success) await carica()
    return json
  }

  async function aggiorna(dati) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati),
    })
    const json = await res.json()
    if (json.success) await carica()
    return json
  }

  async function elimina(id) {
    await fetch(API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await carica()
  }

  return { appuntamenti, loading, carica, aggiungi, aggiorna, elimina }
}
