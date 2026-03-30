import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'
import { useAppuntamenti } from '../../hooks/useAppuntamenti'
import { IconClose } from '../../icons/index.jsx'
import { CalendarDots } from '@phosphor-icons/react'
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
const RICORRENZE = ['nessuna', 'giornaliera', 'settimanale', 'mensile']
const GIORNI_SETT = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
]

// ─── Modal appuntamento ──────────────────────────────────────────────────────
function ModalAppuntamento({ data, appuntamento, onSalva, onElimina, onClose }) {
  const isEdit = !!appuntamento
  const [title, setTitle] = useState(appuntamento?.title || '')
  const [dataVal, setDataVal] = useState(appuntamento?.data || data || '')
  const [ora, setOra] = useState(appuntamento?.ora || '')
  const [tipo, setTipo] = useState(appuntamento?.tipo || 'Appuntamento')
  const [note, setNote] = useState(appuntamento?.note || '')
  const [ricorrenza, setRicorrenza] = useState(appuntamento?.ricorrenza || 'nessuna')
  const [giorniSett, setGiorniSett] = useState(() => {
    if (appuntamento?.giorniSettimana) return appuntamento.giorniSettimana.split(',').map(Number)
    if (appuntamento?.data) return [new Date(appuntamento.data + 'T12:00:00').getDay()]
    return []
  })
  const [dataFine, setDataFine] = useState(appuntamento?.dataFineRicorrenza || '')
  const [loading, setLoading] = useState(false)

  function toggleGiorno(v) {
    setGiorniSett(prev => prev.includes(v) ? prev.filter(g => g !== v) : [...prev, v])
  }

  // Quando si seleziona settimanale e non ci sono giorni, pre-seleziona il giorno della data scelta
  function handleRicorrenza(r) {
    setRicorrenza(r)
    if (r === 'settimanale' && giorniSett.length === 0 && dataVal) {
      setGiorniSett([new Date(dataVal + 'T12:00:00').getDay()])
    }
  }

  async function handleSalva() {
    if (!title.trim()) return
    setLoading(true)
    await onSalva({
      id: appuntamento?.id,
      title: title.trim(),
      data: dataVal,
      ora,
      tipo,
      note,
      ricorrenza,
      giorniSettimana: ricorrenza === 'settimanale' ? giorniSett.sort((a,b)=>a-b).join(',') : '',
      dataFineRicorrenza: ricorrenza !== 'nessuna' ? dataFine : '',
    })
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
              <label>{ricorrenza !== 'nessuna' ? 'Data inizio' : 'Data'}</label>
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
                <button key={t} type="button"
                  className={`${styles.tipoBtn} ${tipo === t ? styles.tipoBtnActive : ''}`}
                  style={tipo === t ? { background: TIPO_COLORI[t], borderColor: TIPO_COLORI[t] } : {}}
                  onClick={() => setTipo(t)}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Ricorrenza */}
          <div className={styles.field}>
            <label>Ricorrenza</label>
            <div className={styles.tipoGroup}>
              {RICORRENZE.map(r => (
                <button key={r} type="button"
                  className={`${styles.tipoBtn} ${ricorrenza === r ? styles.tipoBtnActive : ''}`}
                  style={ricorrenza === r ? { background: 'var(--text2)', borderColor: 'var(--text2)' } : {}}
                  onClick={() => handleRicorrenza(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {ricorrenza === 'settimanale' && (
            <div className={styles.field}>
              <label>Giorni</label>
              <div className={styles.giorniGroup}>
                {GIORNI_SETT.map(g => (
                  <button key={g.value} type="button"
                    className={`${styles.giornoBtn} ${giorniSett.includes(g.value) ? styles.giornoBtnActive : ''}`}
                    onClick={() => toggleGiorno(g.value)}
                  >{g.label}</button>
                ))}
              </div>
            </div>
          )}

          {ricorrenza !== 'nessuna' && (
            <div className={styles.field}>
              <label>Fino a (opzionale)</label>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} />
            </div>
          )}

          <div className={styles.field}>
            <label>Note (opzionale)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Dettagli aggiuntivi..." />
          </div>
        </div>
        <div className={styles.modalFooter}>
          {isEdit && (
            <button className={styles.btnElimina} onClick={() => onElimina(appuntamento.id)}>
              {ricorrenza !== 'nessuna' ? 'Elimina tutte le occorrenze' : 'Elimina'}
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

// ─── Pannello principale ─────────────────────────────────────────────────────
export default function AgendaPanel() {
  const { appuntamenti, loading, aggiungi, aggiorna, elimina } = useAppuntamenti()
  const [modal, setModal] = useState(null) // null | { data, appuntamento }
  const calRef = useRef(null)

  const festivitaLabels = FESTIVITA.map(f => ({
    ...f,
    color: 'transparent',
    textColor: '#A0722A',
    classNames: ['fc-festivita-label'],
    editable: false,
  }))

  const appEvents = appuntamenti.flatMap(a => {
    const color = TIPO_COLORI[a.tipo] || TIPO_COLORI['Appuntamento']
    const base = {
      title:           (a.ora ? `${a.ora} ` : '') + a.title,
      backgroundColor: color,
      borderColor:     color,
      textColor:       '#fff',
      extendedProps:   a,
    }

    if (!a.ricorrenza || a.ricorrenza === 'nessuna') {
      return [{ ...base, id: a.id, date: a.data }]
    }

    const endRecur = a.dataFineRicorrenza || undefined

    if (a.ricorrenza === 'giornaliera') {
      return [{ ...base, groupId: a.id, daysOfWeek: [0,1,2,3,4,5,6], startRecur: a.data, endRecur }]
    }

    if (a.ricorrenza === 'settimanale') {
      const giorni = a.giorniSettimana
        ? a.giorniSettimana.split(',').map(Number)
        : [new Date(a.data + 'T12:00:00').getDay()]
      return [{ ...base, groupId: a.id, daysOfWeek: giorni, startRecur: a.data, endRecur }]
    }

    if (a.ricorrenza === 'mensile') {
      const dayOfMonth = new Date(a.data + 'T12:00:00').getDate()
      const limit = endRecur ? new Date(endRecur + 'T12:00:00') : new Date(new Date().getFullYear() + 2, 11, 31)
      const events = []
      let d = new Date(a.data + 'T12:00:00')
      while (d <= limit) {
        const dateStr = d.toISOString().split('T')[0]
        events.push({ ...base, id: `${a.id}-${dateStr}`, date: dateStr })
        d = new Date(d.getFullYear(), d.getMonth() + 1, dayOfMonth)
      }
      return events
    }

    return [{ ...base, id: a.id, date: a.data }]
  })

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
        <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={itLocale}
            height="auto"
            headerToolbar={{ left: 'prev', center: 'title', right: 'next' }}
            events={[...festivitaLabels, ...appEvents]}
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
