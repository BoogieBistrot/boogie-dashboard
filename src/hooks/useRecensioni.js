import { useState, useEffect } from 'react'
export function useRecensioni() {
  const [dati, setDati] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('https://shimmering-sundae-54b044.netlify.app/.netlify/functions/dati-dashboard')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.dati) {
          const d = json.dati
          setDati({
            google: { votoAttuale: d.rating, recensioni: d.recensioni, diffSettimana: d.diffSettimana, diffMese: d.diffMese },
            tripadvisor: { votoAttuale: d.taRating, recensioni: d.taRecensioni, diffSettimana: d.diffSettimanaTA, diffMese: d.diffMeseTA }
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])
  return { dati, loading }
}
