import { useState, useEffect, useCallback } from 'react'

const API = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions/note'

export function useNote() {
  const [note, setNote] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      const json = await res.json()
      if (json.success) setNote(json.note)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  async function aggiungi(testo, autore, categoria, per) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo, autore, categoria, per }),
    })
    const json = await res.json()
    if (json.success) carica()
    return json
  }

  async function toggleCompletata(id, completata) {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id, completata }),
    })
    carica()
  }

  async function elimina(id) {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    carica()
  }

  return { note, loading, carica, aggiungi, toggleCompletata, elimina }
}
