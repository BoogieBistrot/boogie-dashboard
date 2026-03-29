import { useState, useEffect, useCallback } from 'react'

const NETLIFY_BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'

const STATO_COLORI = {
  'Confermata': '#2E7D32',
  'In attesa':  '#B8820A',
  'Nuova':      '#B8820A',
  'Cancellata': '#C0392B',
}

export function useCalendario() {
  const [eventi, setEventi] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(NETLIFY_BASE + '/get-prenotazioni')
      const json = await res.json()
      if (!json.success) throw new Error()
      setEventi(json.prenotazioni.map(p => {
        const [ore, minuti] = p.ora.split(':')
        const start = new Date(p.data + 'T' + ore.padStart(2,'0') + ':' + (minuti||'00').padStart(2,'0') + ':00')
        const colore = STATO_COLORI[p.stato] || '#7A6448'
        return {
          id: p.id,
          title: p.nome || 'Senza nome',
          start,
          end: new Date(start.getTime() + 90*60*1000),
          backgroundColor: colore,
          borderColor: colore,
          textColor: '#ffffff',
          extendedProps: { ora: p.ora, persone: p.persone, stato: p.stato, note: p.note, telefono: p.telefono }
        }
      }))
    } catch(err) { console.error(err) }
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])
  return { eventi, loading, ricarica: carica }
}
