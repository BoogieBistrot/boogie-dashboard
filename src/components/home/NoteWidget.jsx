import { useState } from 'react'
import { useNote } from '../../hooks/useNote'
import { IconRefresh, IconClose, IconCheck } from '../../icons/index.jsx'
import styles from './NoteWidget.module.css'

const AUTORI = ['Andrea', 'Alessandra', 'Chiara']
const CATEGORIE = ['Generale', 'Da fare', 'Urgente', 'Idea']

const CATEGORIA_STYLE = {
  'Generale':  { bg: 'rgba(122,100,72,0.12)',  color: 'var(--text3)' },
  'Da fare':   { bg: 'rgba(184,130,10,0.12)',  color: 'var(--accent)' },
  'Urgente':   { bg: 'rgba(192,57,43,0.12)',   color: 'var(--danger)' },
  'Idea':      { bg: 'rgba(46,125,50,0.12)',   color: 'var(--success)' },
}

export default function NoteWidget() {
  const { note, loading, carica, aggiungi, toggleCompletata, elimina } = useNote()
  const [testo, setTesto] = useState('')
  const [autore, setAutore] = useState('Andrea')
  const [categoria, setCategoria] = useState('Generale')
  const [per, setPer] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [filtro, setFiltro] = useState('aperte')

  function togglePer(persona) {
    setPer(prev => prev.includes(persona) ? prev.filter(p => p !== persona) : [...prev, persona])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!testo.trim()) return
    setSubmitting(true)
    await aggiungi(testo.trim(), autore, categoria, per)
    setTesto('')
    setPer([])
    setSubmitting(false)
  }

  const noteAperte = note.filter(n => !n.completata)
  const noteCompletate = note.filter(n => n.completata)
  const noteFiltrate = filtro === 'aperte' ? noteAperte : noteCompletate

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Note del team</span>
        <div className={styles.headerRight}>
          <div className={styles.filtroGroup}>
            <button className={`btn-toggle ${filtro === 'aperte' ? 'active' : ''}`} onClick={() => setFiltro('aperte')}>
              Aperte {noteAperte.length > 0 && <span className={styles.count}>{noteAperte.length}</span>}
            </button>
            <button className={`btn-toggle ${filtro === 'completate' ? 'active' : ''}`} onClick={() => setFiltro('completate')}>
              Completate
            </button>
          </div>
          <button className="btn-icon" onClick={carica} title="Aggiorna">
            <IconRefresh size={15} />
          </button>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          value={testo}
          onChange={e => setTesto(e.target.value)}
          placeholder="Scrivi una nota..."
          rows={2}
        />
        {/* Riga 1: autore + categoria + bottone */}
        <div className={styles.formRow1}>
          <select className={styles.select} value={autore} onChange={e => setAutore(e.target.value)}>
            {AUTORI.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={styles.select} value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className={styles.perGroup}>
            <span className={styles.perLabel}>Per:</span>
            {AUTORI.map(p => (
              <button
                key={p}
                type="button"
                className={`${styles.perChip} ${per.includes(p) ? styles.perChipActive : ''}`}
                onClick={() => togglePer(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" style={{ flexShrink: 0 }} disabled={submitting || !testo.trim()}>
            {submitting ? '...' : 'Aggiungi'}
          </button>
        </div>
      </form>

      <div className={styles.lista}>
        {loading && <div className={styles.empty}>Caricamento...</div>}
        {!loading && noteFiltrate.length === 0 && (
          <div className={styles.empty}>{filtro === 'aperte' ? 'Nessuna nota aperta' : 'Nessuna nota completata'}</div>
        )}
        {noteFiltrate.map(n => (
          <div key={n.id} className={`${styles.nota} ${n.completata ? styles.notaCompletata : ''}`}>
            <button className={styles.checkBtn} onClick={() => toggleCompletata(n.id, !n.completata)} title={n.completata ? 'Riapri' : 'Completa'}>
              {n.completata ? <IconCheck size={14} weight="bold" /> : <span className={styles.checkEmpty} />}
            </button>
            <div className={styles.notaBody}>
              <div className={styles.notaTesto}>{n.testo}</div>
              <div className={styles.notaMeta}>
                <span className={styles.notaAutore}>{n.autore}</span>
                <span className={styles.notaData}>{n.data}</span>
                <span className={styles.notaCategoria} style={CATEGORIA_STYLE[n.categoria] || CATEGORIA_STYLE['Generale']}>
                  {n.categoria}
                </span>
                {n.per && n.per.length > 0 && (
                  <span className={styles.perDisplay}>→ {n.per.join(', ')}</span>
                )}
              </div>
            </div>
            <button className="btn-icon danger" onClick={() => elimina(n.id)} title="Elimina">
              <IconClose size={13} weight="regular" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
