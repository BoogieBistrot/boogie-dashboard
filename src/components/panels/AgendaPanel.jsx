import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'
import { useAppuntamenti } from '../../hooks/useAppuntamenti'
import { useNote } from '../../hooks/useNote'
import { IconClose, IconEdit, IconCheck, IconRefresh } from '../../icons/index.jsx'
import { CalendarDots, NotePencil } from '@phosphor-icons/react'
import styles from './AgendaPanel.module.css'

// ─── Festività italiane 2024-2028 ───────────────────────────────────────────
const FESTIVITA = [
  // Fisse
  ...['2024','2025','2026','2027','2028'].flatMap(y => [
    { title: '🎆 Capodanno',           date: `${y}-01-01` },
    { title: '👑 Epifania',            date: `${y}-01-06` },
    { title: '🌸 Festa della Liberazione', date: `${y}-04-25` },
    { title: '⚒️ Festa del Lavoro',    date: `${y}-05-01` },
    { title: '🇮🇹 Festa della Repubblica', date: `${y}-06-02` },
    { title: '☀️ Ferragosto',          date: `${y}-08-15` },
    { title: '🕯️ Ognissanti',         date: `${y}-11-01` },
    { title: '✨ Immacolata',          date: `${y}-12-08` },
    { title: '🎄 Natale',              date: `${y}-12-25` },
    { title: '🎁 Santo Stefano',       date: `${y}-12-26` },
  ]),
  // Pasqua (mobile)
  { title: '🐣 Pasqua',     date: '2024-03-31' },
  { title: '🐣 Pasquetta',  date: '2024-04-01' },
  { title: '🐣 Pasqua',     date: '2025-04-20' },
  { title: '🐣 Pasquetta',  date: '2025-04-21' },
  { title: '🐣 Pasqua',     date: '2026-04-05' },
  { title: '🐣 Pasquetta',  date: '2026-04-06' },
  { title: '🐣 Pasqua',     date: '2027-03-28' },
  { title: '🐣 Pasquetta',  date: '2027-03-29' },
  { title: '🐣 Pasqua',     date: '2028-04-16' },
  { title: '🐣 Pasquetta',  date: '2028-04-17' },
]

const TIPO_COLORI = {
  'Appuntamento': 'var(--accent)',
  'Scadenza':     '#C0392B',
  'Promemoria':   '#1565C0',
}

const TIPI = ['Appuntamento', 'Scadenza', 'Promemoria']
const AUTORI = ['Andrea', 'Alessandra', 'Chiara']
const CATEGORIE = ['Generale', 'Da fare', 'Urgente', 'Idea']
const CATEGORIA_STYLE = {
  'Generale': { bg: 'rgba(122,100,72,0.12)',  color: 'var(--text3)' },
  'Da fare':  { bg: 'rgba(184,130,10,0.12)',  color: 'var(--accent)' },
  'Urgente':  { bg: 'rgba(192,57,43,0.12)',   color: '#C0392B' },
  'Idea':     { bg: 'rgba(46,125,50,0.12)',   color: '#2E7D32' },
}

// ─── Modal appuntamento ──────────────────────────────────────────────────────
function ModalAppuntamento({ data, appuntamento, onSalva, onElimina, onClose }) {
  const isEdit = !!appuntamento
  const [title, setTitle] = useState(appuntamento?.title || '')
  const [dataVal, setDataVal] = useState(appuntamento?.data || data || '')
  const [ora, setOra] = useState(appuntamento?.ora || '')
  const [tipo, setTipo] = useState(appuntamento?.tipo || 'Appuntamento')
  const [note, setNote] = useState(appuntamento?.note || '')
  const [loading, setLoading] = useState(false)

  async function handleSalva() {
    if (!title.trim()) return
    setLoading(true)
    await onSalva({ id: appuntamento?.id, title: title.trim(), data: dataVal, ora, tipo, note })
    setLoading(false)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitolo}>{isEdit ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</div>
          <button className="btn-icon" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Titolo</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Riunione fornitori" autoFocus />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Data</label>
              <input type="date" value={dataVal} onChange={e => setDataVal(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Ora (opzionale)</label>
              <input type="time" value={ora} onChange={e => setOra(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label>Tipo</label>
            <div className={styles.tipoGroup}>
              {TIPI.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.tipoBtn} ${tipo === t ? styles.tipoBtnActive : ''}`}
                  style={tipo === t ? { background: TIPO_COLORI[t], borderColor: TIPO_COLORI[t] } : {}}
                  onClick={() => setTipo(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>Note (opzionale)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Dettagli aggiuntivi..." />
          </div>
        </div>
        <div className={styles.modalFooter}>
          {isEdit && (
            <button className={styles.btnElimina} onClick={() => onElimina(appuntamento.id)}>
              Elimina
            </button>
          )}
          <button className="btn-primary" onClick={handleSalva} disabled={loading || !title.trim()}>
            {loading ? '...' : isEdit ? 'Salva modifiche' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sezione Note ────────────────────────────────────────────────────────────
function SezioneNote() {
  const { note, loading, carica, aggiungi, toggleCompletata, elimina } = useNote()
  const [testo, setTesto] = useState('')
  const [autore, setAutore] = useState('Andrea')
  const [categoria, setCategoria] = useState('Generale')
  const [submitting, setSubmitting] = useState(false)
  const [filtro, setFiltro] = useState('aperte')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!testo.trim()) return
    setSubmitting(true)
    await aggiungi(testo.trim(), autore, categoria, [])
    setTesto('')
    setSubmitting(false)
  }

  const noteAperte    = note.filter(n => !n.completata)
  const noteCompletate = note.filter(n => n.completata)
  const noteFiltrate  = filtro === 'aperte' ? noteAperte : noteCompletate

  return (
    <div className={styles.noteSezione}>
      <div className={styles.noteHeader}>
        <span className={styles.noteTitolo}>
          <NotePencil size={16} weight="light" />
          Note del team
        </span>
        <div className={styles.noteFiltri}>
          <button className={`btn-toggle ${filtro === 'aperte' ? 'active' : ''}`} onClick={() => setFiltro('aperte')}>
            Aperte {noteAperte.length > 0 && <span className={styles.badge}>{noteAperte.length}</span>}
          </button>
          <button className={`btn-toggle ${filtro === 'completate' ? 'active' : ''}`} onClick={() => setFiltro('completate')}>
            Fatte
          </button>
          <button className="btn-icon" onClick={carica} title="Aggiorna"><IconRefresh size={14} /></button>
        </div>
      </div>

      <form className={styles.noteForm} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          value={testo}
          onChange={e => setTesto(e.target.value)}
          placeholder="Scrivi una nota..."
          rows={2}
        />
        <div className={styles.noteFormRow}>
          <select className={styles.select} value={autore} onChange={e => setAutore(e.target.value)}>
            {AUTORI.map(a => <option key={a}>{a}</option>)}
          </select>
          <select className={styles.select} value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIE.map(c => <option key={c}>{c}</option>)}
          </select>
          <button type="submit" className="btn-primary" disabled={submitting || !testo.trim()}>
            {submitting ? '...' : 'Aggiungi'}
          </button>
        </div>
      </form>

      <div className={styles.noteLista}>
        {loading && <div className={styles.empty}>Caricamento...</div>}
        {!loading && noteFiltrate.length === 0 && (
          <div className={styles.empty}>{filtro === 'aperte' ? 'Nessuna nota aperta' : 'Nessuna nota completata'}</div>
        )}
        {noteFiltrate.map(n => (
          <div key={n.id} className={`${styles.nota} ${n.completata ? styles.notaFatta : ''}`}>
            <button className={styles.checkBtn} onClick={() => toggleCompletata(n.id, !n.completata)}>
              {n.completata
                ? <IconCheck size={13} weight="bold" />
                : <span className={styles.checkEmpty} />}
            </button>
            <div className={styles.notaBody}>
              <div className={styles.notaTesto}>{n.testo}</div>
              <div className={styles.notaMeta}>
                <span className={styles.notaAutore}>{n.autore}</span>
                <span className={styles.notaData}>{n.data}</span>
                <span className={styles.notaCategoria} style={CATEGORIA_STYLE[n.categoria] || CATEGORIA_STYLE['Generale']}>
                  {n.categoria}
                </span>
              </div>
            </div>
            <button className="btn-icon danger" onClick={() => elimina(n.id)}>
              <IconClose size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pannello principale ─────────────────────────────────────────────────────
export default function AgendaPanel() {
  const { appuntamenti, loading, aggiungi, aggiorna, elimina } = useAppuntamenti()
  const [modal, setModal] = useState(null) // null | { data, appuntamento }
  const calRef = useRef(null)

  const festivitaEvents = FESTIVITA.map(f => ({
    ...f,
    color: 'rgba(180,100,0,0.18)',
    textColor: '#8B5E1A',
    classNames: ['fc-festivita'],
    editable: false,
    display: 'background',
  }))

  const festivitaLabels = FESTIVITA.map(f => ({
    ...f,
    color: 'transparent',
    textColor: '#A0722A',
    classNames: ['fc-festivita-label'],
    editable: false,
  }))

  const appEvents = appuntamenti.map(a => ({
    id:    a.id,
    title: (a.ora ? `${a.ora} ` : '') + a.title,
    date:  a.data,
    backgroundColor: TIPO_COLORI[a.tipo] || TIPO_COLORI['Appuntamento'],
    borderColor:     TIPO_COLORI[a.tipo] || TIPO_COLORI['Appuntamento'],
    textColor: '#fff',
    extendedProps: a,
  }))

  function handleDateClick(info) {
    setModal({ data: info.dateStr, appuntamento: null })
  }

  function handleEventClick(info) {
    if (info.event.classNames.includes('fc-festivita-label')) return
    setModal({ data: null, appuntamento: info.event.extendedProps })
  }

  async function handleSalva(dati) {
    if (dati.id) await aggiorna(dati)
    else await aggiungi(dati)
    setModal(null)
  }

  async function handleElimina(id) {
    await elimina(id)
    setModal(null)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <CalendarDots size={20} weight="light" />
          Agenda & Note
        </h1>
      </div>

      <div className={styles.layout}>
        {/* Calendario */}
        <div className={styles.calendarioCol}>
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={itLocale}
            height="auto"
            headerToolbar={{ left: 'prev', center: 'title', right: 'next' }}
            events={[...festivitaEvents, ...festivitaLabels, ...appEvents]}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            editable={false}
            dayMaxEvents={3}
          />
          <div className={styles.legenda}>
            <span className={styles.legendaItem}>
              <span className={styles.legendaDot} style={{ background: 'rgba(160,114,42,0.5)' }} />
              Festività
            </span>
            {TIPI.map(t => (
              <span key={t} className={styles.legendaItem}>
                <span className={styles.legendaDot} style={{ background: TIPO_COLORI[t] }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Note */}
        <SezioneNote />
      </div>

      {modal && (
        <ModalAppuntamento
          data={modal.data}
          appuntamento={modal.appuntamento}
          onSalva={handleSalva}
          onElimina={handleElimina}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
