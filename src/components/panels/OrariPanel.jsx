import { useState, useEffect } from 'react'
import { useOrari } from '../../hooks/useOrari'
import { IconClock, IconInfo, IconClose, IconLock } from '../../icons/index.jsx'
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

const DEFAULT_FASCIA_ORARI = { oraInizio: '', oraFine: '', intervallo: 15 }

function buildState(orari) {
  const fasceOrari = {
    Pranzo:     { ...DEFAULT_FASCIA_ORARI },
    Aperitivo:  { ...DEFAULT_FASCIA_ORARI },
    Cena:       { ...DEFAULT_FASCIA_ORARI },
  }
  const grid = {}
  for (const g of GIORNI)
    for (const f of FASCE)
      grid[`${g.value}_${f}`] = { id: null, attivo: false }

  for (const o of orari) {
    // Prendi gli orari della fascia dal primo record disponibile
    if (o.fascia && o.oraInizio && fasceOrari[o.fascia] && !fasceOrari[o.fascia].oraInizio) {
      fasceOrari[o.fascia] = { oraInizio: o.oraInizio, oraFine: o.oraFine, intervallo: o.intervallo || 15 }
    }
    const key = `${o.giorno}_${o.fascia}`
    if (key in grid) grid[key] = { id: o.id, attivo: o.attivo }
  }
  return { fasceOrari, grid }
}

function InfoModal({ onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitolo}><IconInfo size={16} /> Come funziona</div>
          <button className="btn-icon" onClick={onClose}><IconClose size={16} weight="regular" /></button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.infoText}>
            Questo pannello definisce gli <strong>orari ordinari</strong> del ristorante, ovvero la settimana tipo.
          </p>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>1 — Imposta gli orari per fascia</div>
            <p className={styles.infoText}>
              Nella parte in alto trovi tre box, uno per Pranzo, Aperitivo e Cena. Per ciascuno imposta l'orario di apertura, chiusura e ogni quanti minuti generare uno slot prenotabile. Questi orari valgono per tutti i giorni in cui la fascia è attiva.
            </p>
          </div>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>2 — Scegli i giorni di apertura</div>
            <p className={styles.infoText}>
              Nella griglia in basso, per ogni giorno della settimana puoi attivare o disattivare singolarmente ciascuna fascia. Un giorno con tutte le fasce chiuse risulterà non disponibile per le prenotazioni.
            </p>
          </div>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>3 — Salva</div>
            <p className={styles.infoText}>
              Clicca <strong>Salva orari</strong> per applicare le modifiche. Le variazioni straordinarie (chiusure o aperture eccezionali per date specifiche) si gestiscono nel pannello <em>Chiusure & Aperture</em>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrariPanel() {
  const { orari, loading, ricarica, salva, elimina } = useOrari()
  const [fasceOrari, setFasceOrari] = useState({
    Pranzo:    { ...DEFAULT_FASCIA_ORARI },
    Aperitivo: { ...DEFAULT_FASCIA_ORARI },
    Cena:      { ...DEFAULT_FASCIA_ORARI },
  })
  const [grid, setGrid] = useState({})
  const [originalIds, setOriginalIds] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [editEnabled, setEditEnabled] = useState(false)
  const [lockModalOpen, setLockModalOpen] = useState(false)

  function abilitaModifica() { setEditEnabled(true); setMsg(null) }
  function annullaModifica() {
    const { fasceOrari: fo, grid: g } = buildState(orari)
    setFasceOrari(fo)
    setGrid(g)
    setEditEnabled(false)
    setMsg(null)
  }

  useEffect(() => {
    if (!loading) {
      const { fasceOrari: fo, grid: g } = buildState(orari)
      setFasceOrari(fo)
      setGrid(g)
      const ids = {}
      for (const [key, cell] of Object.entries(g))
        if (cell.id) ids[key] = cell.id
      setOriginalIds(ids)
    }
  }, [orari, loading])

  function updateFascia(fascia, patch) {
    setFasceOrari(prev => ({ ...prev, [fascia]: { ...prev[fascia], ...patch } }))
    setMsg(null)
  }

  function toggleCell(key) {
    setGrid(prev => ({ ...prev, [key]: { ...prev[key], attivo: !prev[key].attivo } }))
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
          const orarioFascia = fasceOrari[f]

          if (cell.attivo && orarioFascia.oraInizio && orarioFascia.oraFine) {
            const payload = {
              giorno:     g.value,
              fascia:     f,
              oraInizio:  orarioFascia.oraInizio,
              oraFine:    orarioFascia.oraFine,
              intervallo: orarioFascia.intervallo || 15,
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
          <button className="btn-icon" onClick={() => setInfoOpen(true)} title="Come funziona">
            <IconInfo size={18} />
          </button>
          {msg && <span className={`${styles.inlineMsg} ${styles[msg.type]}`}>{msg.text}</span>}
          {!editEnabled
            ? <button className="btn-secondary" onClick={abilitaModifica}>Abilita modifica</button>
            : <>
                <button className="btn-secondary" onClick={annullaModifica} disabled={saving}>Annulla</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvataggio...' : 'Salva orari'}
                </button>
              </>
          }
        </div>
      </div>

      <div className={styles.body}>
        {/* — Orari per fascia — */}
        <div className={styles.fasceRow}>
          {FASCE.map(f => (
            <div key={f} className={`${styles.fasciaCard} ${!editEnabled ? styles.fasciaCardLocked : ''}`}
              onClick={() => !editEnabled && setLockModalOpen(true)}>
              <div className={styles.fasciaCardTitle}>{f}</div>
              <div className={styles.fasciaCardFields}>
                <div className={styles.timeField}>
                  <label>Dalle</label>
                  <input type="time" value={fasceOrari[f].oraInizio} disabled={!editEnabled}
                    onChange={e => updateFascia(f, { oraInizio: e.target.value })} />
                </div>
                <div className={styles.timeField}>
                  <label>Alle</label>
                  <input type="time" value={fasceOrari[f].oraFine} disabled={!editEnabled}
                    onChange={e => updateFascia(f, { oraFine: e.target.value })} />
                </div>
                <div className={styles.timeField}>
                  <label>Slot ogni (min)</label>
                  <input type="number" min="5" max="60" step="5" disabled={!editEnabled}
                    value={fasceOrari[f].intervallo}
                    onChange={e => updateFascia(f, { intervallo: parseInt(e.target.value) || 15 })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* — Griglia giorni — */}
        <div className={styles.gridWrap}>
        <div className={styles.grid}>
          <div className={styles.gridHeader}>
            <div className={styles.dayCol} />
            {FASCE.map(f => <div key={f} className={styles.fasciaHeader}>{f}</div>)}
          </div>
          {GIORNI.map(g => (
            <div key={g.value} className={styles.gridRow}>
              <div className={styles.dayLabel}>{g.label}</div>
              <div className={styles.cellsRow}>
                {FASCE.map(f => {
                  const key = `${g.value}_${f}`
                  const cell = grid[key] || { attivo: false }
                  return (
                    <div key={f} className={styles.cell}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${cell.attivo ? styles.toggleOn : ''} ${!editEnabled ? styles.toggleLocked : ''}`}
                        onClick={() => editEnabled ? toggleCell(key) : setLockModalOpen(true)}
                      >
                        {!editEnabled
                          ? <IconLock size={13} className={styles.lockIconSmall} />
                          : <span className={styles.toggleDot} />
                        }
                        {cell.attivo ? 'Aperto' : 'Chiuso'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

      {lockModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setLockModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitolo}><IconLock size={16} /> Modifiche disabilitate</div>
              <button className="btn-icon" onClick={() => setLockModalOpen(false)}><IconClose size={16} weight="regular" /></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.infoText}>Per modificare gli orari, clicca prima su <strong>Abilita modifica</strong> in alto a destra.</p>
              <button
                className="btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => { abilitaModifica(); setLockModalOpen(false) }}
              >
                Abilita modifica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
