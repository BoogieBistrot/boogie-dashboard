import { useState, useEffect } from 'react'
import { useOrari } from '../../hooks/useOrari'
import { IconClock } from '../../icons/index.jsx'
import styles from './OrariPanel.module.css'

const GIORNI = [
  { label: 'Lunedì',    value: 1 },
  { label: 'Martedì',   value: 2 },
  { label: 'Mercoledì', value: 3 },
  { label: 'Giovedì',   value: 4 },
  { label: 'Venerdì',   value: 5 },
  { label: 'Sabato',    value: 6 },
  { label: 'Domenica',  value: 0 },
]
const FASCE = ['Pranzo', 'Aperitivo', 'Cena']
const DEFAULT_CELL = { id: null, attivo: false, oraInizio: '', oraFine: '', intervallo: 15 }

function buildGrid(orari) {
  const grid = {}
  for (const g of GIORNI) {
    for (const f of FASCE) {
      grid[`${g.value}_${f}`] = { ...DEFAULT_CELL }
    }
  }
  for (const o of orari) {
    const key = `${o.giorno}_${o.fascia}`
    if (key in grid) {
      grid[key] = {
        id:         o.id,
        attivo:     o.attivo,
        oraInizio:  o.oraInizio,
        oraFine:    o.oraFine,
        intervallo: o.intervallo || 15,
      }
    }
  }
  return grid
}

export default function OrariPanel() {
  const { orari, loading, ricarica, salva, elimina } = useOrari()
  const [grid, setGrid] = useState({})
  const [originalIds, setOriginalIds] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!loading) {
      const g = buildGrid(orari)
      setGrid(g)
      const ids = {}
      for (const [key, cell] of Object.entries(g)) {
        if (cell.id) ids[key] = cell.id
      }
      setOriginalIds(ids)
    }
  }, [orari, loading])

  function updateCell(key, patch) {
    setGrid(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
    setMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const ops = []
      for (const g of GIORNI) {
        for (const f of FASCE) {
          const key = `${g.value}_${f}`
          const cell = grid[key]
          const existingId = originalIds[key] || null

          if (cell.attivo && cell.oraInizio && cell.oraFine) {
            const payload = {
              giorno:     g.value,
              fascia:     f,
              oraInizio:  cell.oraInizio,
              oraFine:    cell.oraFine,
              intervallo: cell.intervallo || 15,
            }
            ops.push(salva(payload, existingId))
          } else if (!cell.attivo && existingId) {
            ops.push(elimina(existingId))
          }
        }
      }
      await Promise.all(ops)
      setMsg({ type: 'ok', text: 'Orari salvati correttamente' })
      ricarica()
    } catch {
      setMsg({ type: 'err', text: 'Errore durante il salvataggio — riprova' })
    }
    setSaving(false)
  }

  if (loading) return <div className={styles.panel}><div className={styles.empty}>Caricamento...</div></div>

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconClock size={20} />
          Orari Ordinari
        </h1>
        <div className={styles.headerRight}>
          {msg && <span className={`${styles.inlineMsg} ${styles[msg.type]}`}>{msg.text}</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva orari'}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          <div className={styles.gridHeader}>
            <div className={styles.dayCol} />
            {FASCE.map(f => (
              <div key={f} className={styles.fasciaHeader}>{f}</div>
            ))}
          </div>

          {GIORNI.map(g => (
            <div key={g.value} className={styles.gridRow}>
              <div className={styles.dayLabel}>{g.label}</div>
              {FASCE.map(f => {
                const key = `${g.value}_${f}`
                const cell = grid[key] || DEFAULT_CELL
                return (
                  <div key={f} className={`${styles.cell} ${cell.attivo ? styles.cellActive : ''}`}>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${cell.attivo ? styles.toggleOn : ''}`}
                      onClick={() => updateCell(key, { attivo: !cell.attivo })}
                    >
                      <span className={styles.toggleDot} />
                      {cell.attivo ? 'Aperto' : 'Chiuso'}
                    </button>

                    {cell.attivo && (
                      <div className={styles.cellFields}>
                        <div className={styles.timeRow}>
                          <div className={styles.timeField}>
                            <label>Dalle</label>
                            <input
                              type="time"
                              value={cell.oraInizio}
                              onChange={e => updateCell(key, { oraInizio: e.target.value })}
                            />
                          </div>
                          <div className={styles.timeField}>
                            <label>Alle</label>
                            <input
                              type="time"
                              value={cell.oraFine}
                              onChange={e => updateCell(key, { oraFine: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className={styles.intervalField}>
                          <label>Slot ogni (min)</label>
                          <input
                            type="number"
                            min="5"
                            max="60"
                            step="5"
                            value={cell.intervallo}
                            onChange={e => updateCell(key, { intervallo: parseInt(e.target.value) || 15 })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
