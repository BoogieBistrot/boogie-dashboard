import { useState, useEffect } from 'react'
import { authFetch } from '../lib/authFetch'
import { useTag } from '../hooks/useTag'
import { IconClose, IconCheck } from '../icons/index.jsx'
import styles from './ModalPrenotazione.module.css'

const NETLIFY_BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'
const DISPONIBILITA_URL = `${NETLIFY_BASE}/disponibilita`
const GESTISCI_URL = `${NETLIFY_BASE}/gestisci-prenotazione`

const STATI = ['In attesa', 'Confermata', 'Cancellata']

const EMPTY_FORM = {
  nome: '', data: '', ora: '', persone: '', telefono: '', email: '', note: '', stato: 'In attesa', tags: []
}

export default function ModalPrenotazione({ prenotazione = null, onClose, onSuccess }) {
  const isEdit = !!prenotazione
  const { tag: tagDisponibili, loading: tagLoading } = useTag()
  const [form, setForm] = useState(EMPTY_FORM)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confermaSlotPieno, setConfermaSlotPieno] = useState(false)

  // Popola il form in modalità edit
  useEffect(() => {
    if (prenotazione) {
      setForm({
        nome:     prenotazione.nome || '',
        data:     prenotazione.data || '',
        ora:      prenotazione.ora || '',
        persone:  String(prenotazione.persone || ''),
        telefono: prenotazione.telefono || '',
        email:    prenotazione.email || '',
        note:     prenotazione.note || '',
        stato:    prenotazione.stato || 'In attesa',
        tags:     prenotazione.tags || [],
      })
      if (prenotazione.data) caricaSlots(prenotazione.data)
    }
  }, [prenotazione])

  async function caricaSlots(data) {
    if (!data) return
    setLoadingSlots(true)
    setSlots([])
    try {
      const res = await fetch(`${DISPONIBILITA_URL}?data=${data}`)
      const json = await res.json()
      if (!json.chiuso && json.fasce) setSlots(json.fasce)
    } catch {}
    setLoadingSlots(false)
  }

  function onDataChange(e) {
    const data = e.target.value
    setForm(f => ({ ...f, data, ora: '' }))
    caricaSlots(data)
  }

  function slotSelezionatoPieno() {
    if (!form.ora) return false
    return slots.some(f => f.slots.some(s => s.ora === form.ora && s.pieno && s.ora !== prenotazione?.ora))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome || !form.data || !form.ora || !form.persone) {
      setMsg({ type: 'err', text: 'Compila tutti i campi obbligatori' })
      return
    }
    if (slotSelezionatoPieno() && !confermaSlotPieno) {
      setConfermaSlotPieno(true)
      return
    }
    setConfermaSlotPieno(false)
    setSubmitting(true)
    setMsg(null)

    try {
      const payload = isEdit
        ? { action: 'edit', id: prenotazione.id, ...form }
        : { ...form }

      const res = await authFetch(GESTISCI_URL, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        setMsg({ type: 'ok', text: isEdit ? 'Prenotazione aggiornata' : 'Prenotazione inserita' })
        setTimeout(() => { onSuccess?.(); onClose() }, 800)
      } else {
        setMsg({ type: 'err', text: 'Errore — riprova' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Errore di connessione' })
    }
    setSubmitting(false)
  }

  // Data minima = oggi
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titolo}>
            {isEdit ? 'Modifica prenotazione' : 'Nuova prenotazione telefonica'}
          </div>
          <button className="btn-icon" onClick={onClose}>
            <IconClose size={16} weight="regular" />
          </button>
        </div>

        <form className={styles.body} onSubmit={handleSubmit}>
          <div className={styles.grid}>

            <div className={styles.field}>
              <label>Nome e cognome <span className={styles.req}>*</span></label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Mario Rossi" />
            </div>

            <div className={styles.field}>
              <label>Telefono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+39 333 000 0000" />
            </div>

            <div className={styles.field}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="mario@email.com" />
            </div>

            <div className={styles.field}>
              <label>N° Persone <span className={styles.req}>*</span></label>
              <select value={form.persone} onChange={e => setForm(f => ({ ...f, persone: e.target.value }))}>
                <option value="">—</option>
                {[...Array(100)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} {i === 0 ? 'persona' : 'persone'}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Data <span className={styles.req}>*</span></label>
              <input type="date" value={form.data} min={today} onChange={onDataChange} />
            </div>

            <div className={styles.field}>
              <label>Orario <span className={styles.req}>*</span></label>
              <select value={form.ora} onChange={e => { setForm(f => ({ ...f, ora: e.target.value })); setConfermaSlotPieno(false) }} disabled={!form.data || loadingSlots}>
                <option value="">{loadingSlots ? 'Caricamento...' : form.data ? 'Scegli orario' : 'Seleziona prima la data'}</option>
                {slots.map(({ fascia, slots: s }) => (
                  <optgroup key={fascia} label={fascia}>
                    {s.map(slot => (
                      <option key={slot.ora} value={slot.ora}>
                        {slot.ora}{slot.pieno && slot.ora !== form.ora ? ' — al completo' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {isEdit && form.ora && !slots.some(f => f.slots.some(s => s.ora === form.ora)) && (
                  <option value={form.ora}>{form.ora}</option>
                )}
              </select>
            </div>

            {isEdit && (
              <div className={styles.field}>
                <label>Stato</label>
                <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))}>
                  {STATI.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className={`${styles.field} ${styles.full}`}>
              <label>Tag <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.72rem' }}>— non visibile al cliente</span></label>
              <div className={styles.tagsRow}>
                {tagLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Caricamento...</span>}
                {!tagLoading && tagDisponibili.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text3)', fontStyle: 'italic' }}>Nessun tag disponibile</span>}
                {tagDisponibili.map(t => (
                  <label key={t.id} className={styles.tagChip}>
                    <input
                      type="checkbox"
                      checked={form.tags.includes(t.nome)}
                      onChange={e => setForm(f => ({
                        ...f,
                        tags: e.target.checked ? [...f.tags, t.nome] : f.tags.filter(x => x !== t.nome)
                      }))}
                    />
                    {t.nome}
                  </label>
                ))}
              </div>
            </div>

            <div className={`${styles.field} ${styles.full}`}>
              <label>Note</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Allergie, occasioni speciali..." />
            </div>

          </div>

          {msg && <div className={`${styles.msg} ${styles[msg.type]}`}>{msg.text}</div>}

          {confermaSlotPieno && (
            <div className={styles.warnBox}>
              <div className={styles.warnText}>
                ⚠️ Lo slot delle <strong>{form.ora}</strong> è già al completo. Vuoi aggiungere la prenotazione comunque?
              </div>
              <div className={styles.warnActions}>
                <button type="button" className="btn-secondary" onClick={() => setConfermaSlotPieno(false)}>No, cambia orario</button>
                <button type="submit" className="btn-primary">Sì, aggiungi comunque</button>
              </div>
            </div>
          )}

          {!confermaSlotPieno && <div className={styles.actions}>
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            {isEdit && (
              <button type="button" style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
                disabled={submitting || form.stato === 'Cancellata'}
                onClick={async () => {
                  setSubmitting(true)
                  setMsg(null)
                  try {
                    const res = await authFetch(GESTISCI_URL, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'edit', id: prenotazione.id, ...form, stato: 'Cancellata' }),
                    })
                    const json = await res.json()
                    if (json.success) {
                      setMsg({ type: 'ok', text: 'Prenotazione cancellata' })
                      setTimeout(() => { onSuccess?.(); onClose() }, 800)
                    } else {
                      setMsg({ type: 'err', text: 'Errore — riprova' })
                    }
                  } catch {
                    setMsg({ type: 'err', text: 'Errore di connessione' })
                  }
                  setSubmitting(false)
                }}
              >
                {form.stato === 'Cancellata' ? 'Già cancellata' : 'Cancella prenotazione'}
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Inserisci prenotazione'}
            </button>
          </div>}
        </form>
      </div>
    </div>
  )
}
