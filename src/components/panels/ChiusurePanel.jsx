import { useState } from 'react'
import { useChiusure } from '../../hooks/useChiusure'
import { IconEdit, IconClose, IconLock, IconInfo } from '../../icons/index.jsx'
import styles from './ChiusurePanel.module.css'

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
            Questo pannello gestisce le <strong>eccezioni</strong> rispetto agli orari ordinari: chiusure straordinarie e aperture extra per date specifiche.
          </p>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>Chiusura</div>
            <p className={styles.infoText}>
              Blocca la disponibilità per un intervallo di date. Se non selezioni nessuna fascia, il giorno risulta completamente chiuso. Se selezioni una o più fasce, solo quelle vengono bloccate.
            </p>
          </div>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>Apertura straordinaria</div>
            <p className={styles.infoText}>
              Rende disponibile il ristorante in date che negli orari ordinari risulterebbero chiuse — ad esempio un lunedì di festa. Gli orari utilizzati sono quelli impostati nel pannello <em>Orari Ordinari</em> per le fasce selezionate.
            </p>
          </div>
          <div className={styles.infoSection}>
            <div className={styles.infoSectionTitle}>Priorità</div>
            <p className={styles.infoText}>
              Le aperture straordinarie hanno sempre la precedenza sulle chiusure. Se una data ha sia una chiusura che un'apertura straordinaria, il ristorante risulta aperto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const FASCE = ['Pranzo', 'Aperitivo', 'Cena']
const EMPTY_FORM = { descrizione: '', tipo: 'Data specifica', dataInizio: '', dataFine: '', fasce: [], tipoApertura: 'Chiusura' }

function FormFields({ form, setForm, toggleFascia }) {
  return (
    <>
      <div className={styles.field}>
        <label>Descrizione</label>
        <input value={form.descrizione} onChange={e => setForm(p => ({ ...p, descrizione: e.target.value }))} placeholder="Es. Chiuso per ferie" />
      </div>
      <div className={styles.field}>
        <label>È un'apertura o una chiusura?</label>
        <div className={styles.toggleGroup}>
          {['Chiusura', 'Apertura straordinaria'].map(t => (
            <button key={t} type="button"
              className={`btn-toggle ${form.tipoApertura === t ? (t === 'Apertura straordinaria' ? 'active-green' : 'active-danger') : ''}`}
              onClick={() => setForm(p => ({ ...p, tipoApertura: t }))}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t === 'Apertura straordinaria' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <label>Data inizio</label>
        <input type="date" value={form.dataInizio} onChange={e => setForm(p => ({ ...p, dataInizio: e.target.value }))} />
        <label style={{ marginTop: '10px' }}>Data fine</label>
        <input type="date" value={form.dataFine} onChange={e => setForm(p => ({ ...p, dataFine: e.target.value }))} />
      </div>
      <div className={styles.field}>
        <label>Fasce orarie (vuoto = tutto il giorno)</label>
        <div className={styles.toggleGroup}>
          {FASCE.map(f => (
            <button key={f} type="button"
              className={`btn-toggle ${form.fasce.includes(f) ? 'active' : ''}`}
              onClick={() => toggleFascia(f)}>{f}</button>
          ))}
        </div>
      </div>
    </>
  )
}

function EditModal({ form, setForm, toggleFascia, onSubmit, onClose, submitting, msg }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitolo}>
            <IconEdit size={16} />
            Modifica regola
          </div>
          <button className="btn-icon" onClick={onClose}>
            <IconClose size={16} weight="regular" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <FormFields form={form} setForm={setForm} toggleFascia={toggleFascia} />
          <div className={styles.formActions}>
            <button type="button" className="btn-primary" disabled={submitting} onClick={onSubmit}>
              {submitting ? 'Salvataggio...' : 'Aggiorna regola'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
          </div>
          {msg && <div className={`${styles.msg} ${styles[msg.type]}`}>{msg.text}</div>}
        </div>
      </div>
    </div>
  )
}

function RegolaItem({ ch, onEdit, onElimina }) {
  return (
    <div className={styles.item}>
      <div className={styles.itemLeft}>
        <span className={styles.itemDot} style={{ background: ch.tipoApertura === 'Apertura straordinaria' ? '#2E7D32' : '#C0392B' }} />
        <div>
          <div className={styles.itemDesc}>{ch.descrizione}</div>
          <div className={styles.itemMeta}>
            {`${ch.dataInizio}${ch.dataFine && ch.dataFine !== ch.dataInizio ? ` → ${ch.dataFine}` : ''}`}
            {ch.fasce?.length > 0 && ` · ${ch.fasce.join(', ')}`}
          </div>
        </div>
      </div>
      <div className={styles.itemActions}>
        <button className="btn-icon" onClick={() => onEdit(ch)}>
          <IconEdit size={14} />
        </button>
        <button className="btn-icon danger" onClick={() => onElimina(ch.id)}>
          <IconClose size={14} weight="regular" />
        </button>
      </div>
    </div>
  )
}

export default function ChiusurePanel() {
  const { chiusure, loading, ricarica, salva, elimina } = useChiusure()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [editMsg, setEditMsg] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  function toggleFascia(f) {
    setForm(prev => ({ ...prev, fasce: prev.fasce.includes(f) ? prev.fasce.filter(x => x !== f) : [...prev.fasce, f] }))
  }
  function toggleEditFascia(f) {
    setEditForm(prev => ({ ...prev, fasce: prev.fasce.includes(f) ? prev.fasce.filter(x => x !== f) : [...prev.fasce, f] }))
  }
  function startEdit(ch) {
    setEditId(ch.id)
    setEditForm({ descrizione: ch.descrizione || '', tipo: 'Data specifica', dataInizio: ch.dataInizio || '', dataFine: ch.dataFine || '', fasce: ch.fasce || [], tipoApertura: ch.tipoApertura || 'Chiusura' })
    setEditMsg(null)
  }
  function closeEdit() { setEditId(null); setEditForm(EMPTY_FORM); setEditMsg(null) }

  async function handleSubmitNew(e) {
    e.preventDefault()
    if (!form.descrizione) { setMsg({ type: 'err', text: 'Inserisci una descrizione' }); return }
    setSubmitting(true)
    const payload = { descrizione: form.descrizione, tipo: 'Data specifica', dataInizio: form.dataInizio || null, dataFine: form.dataFine || null, fasce: form.fasce, tipoApertura: form.tipoApertura }
    const res = await salva(payload, null)
    setSubmitting(false)
    if (res.success) { setMsg({ type: 'ok', text: 'Aggiunto' }); setForm(EMPTY_FORM); ricarica() }
    else { setMsg({ type: 'err', text: 'Errore — riprova' }) }
  }

  async function handleSubmitEdit() {
    if (!editForm.descrizione) { setEditMsg({ type: 'err', text: 'Inserisci una descrizione' }); return }
    setSubmitting(true)
    const payload = { descrizione: editForm.descrizione, tipo: 'Data specifica', dataInizio: editForm.dataInizio || null, dataFine: editForm.dataFine || null, fasce: editForm.fasce, tipoApertura: editForm.tipoApertura }
    const res = await salva(payload, editId)
    setSubmitting(false)
    if (res.success) { closeEdit(); ricarica() }
    else { setEditMsg({ type: 'err', text: 'Errore — riprova' }) }
  }

  async function handleElimina(id) {
    if (!confirm('Eliminare questa regola?')) return
    await elimina(id); ricarica()
  }

  const chiusureList  = chiusure.filter(ch => ch.tipoApertura !== 'Apertura straordinaria')
  const apertureList  = chiusure.filter(ch => ch.tipoApertura === 'Apertura straordinaria')

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconLock size={20} />
          Chiusure & Aperture straordinarie
        </h1>
        <button className="btn-icon" onClick={() => setInfoOpen(true)} title="Come funziona">
          <IconInfo size={18} />
        </button>
      </div>
      <div className={styles.body}>
        <form className={styles.form} onSubmit={handleSubmitNew}>
          <div className={styles.formTitle}>+ Nuova regola</div>
          <FormFields form={form} setForm={setForm} toggleFascia={toggleFascia} />
          <div className={styles.formActions}>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Salvataggio...' : 'Aggiungi regola'}
            </button>
          </div>
          {msg && <div className={`${styles.msg} ${styles[msg.type]}`}>{msg.text}</div>}
        </form>

        {loading && <div className={styles.empty}>Caricamento...</div>}
        {!loading && chiusure.length === 0 && <div className={styles.empty}>Nessuna regola configurata</div>}

        {!loading && chiusure.length > 0 && (
          <div className={styles.listeGrid}>
            <div className={styles.listaCol}>
              <div className={styles.listaTitle}>
                <span className={styles.listaDot} style={{ background: 'var(--danger)' }} />
                Chiusure straordinarie attive
              </div>
              <div className={styles.lista}>
                {chiusureList.length === 0
                  ? <div className={styles.empty}>Nessuna chiusura</div>
                  : chiusureList.map(ch => <RegolaItem key={ch.id} ch={ch} onEdit={startEdit} onElimina={handleElimina} />)
                }
              </div>
            </div>
            <div className={styles.listaCol}>
              <div className={styles.listaTitle}>
                <span className={styles.listaDot} style={{ background: 'var(--success)' }} />
                Aperture straordinarie attive
              </div>
              <div className={styles.lista}>
                {apertureList.length === 0
                  ? <div className={styles.empty}>Nessuna apertura straordinaria</div>
                  : apertureList.map(ch => <RegolaItem key={ch.id} ch={ch} onEdit={startEdit} onElimina={handleElimina} />)
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {editId && (
        <EditModal form={editForm} setForm={setEditForm} toggleFascia={toggleEditFascia}
          onSubmit={handleSubmitEdit} onClose={closeEdit} submitting={submitting} msg={editMsg} />
      )}
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
