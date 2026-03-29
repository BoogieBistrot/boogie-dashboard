import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { useCalendario } from '../../hooks/useCalendario'
import { IconNote, IconClose, IconCalendar, IconRefresh, IconEdit } from '../../icons/index.jsx'
import ModalPrenotazione from '../ModalPrenotazione.jsx'
import styles from './CalendarioPanel.module.css'

const STATO_INFO = {
  'Confermata': { color: '#2E7D32', bg: 'rgba(46,125,50,0.1)' },
  'In attesa':  { color: '#B8820A', bg: 'rgba(184,130,10,0.1)' },
  'Nuova':      { color: '#B8820A', bg: 'rgba(184,130,10,0.1)' },
  'Cancellata': { color: '#C0392B', bg: 'rgba(192,57,43,0.1)' },
}

const STATO_COLORI = {
  'Confermata': '#2E7D32',
  'In attesa':  '#B8820A',
  'Nuova':      '#B8820A',
  'Cancellata': '#C0392B',
}

const isMobile = () => window.innerWidth <= 768

function EventoContenuto({ info }) {
  const { ora, persone, stato, note } = info.event.extendedProps
  const bg = STATO_COLORI[stato] || '#7A6448'
  return (
    <div style={{ background: bg, borderRadius: '4px', padding: '2px 6px', width: '100%', cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {info.event.title}
        </span>
        {note && <IconNote size={11} color="rgba(255,255,255,0.85)" />}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', marginTop: '1px' }}>
        {ora} · {persone} pers.
      </div>
    </div>
  )
}

function ModalDettaglio({ evento, onClose, onEdit }) {
  if (!evento) return null
  const { ora, persone, stato, note, telefono } = evento.extendedProps
  const statoInfo = STATO_INFO[stato] || { color: '#7A6448', bg: 'rgba(122,100,72,0.1)' }
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitolo}>{evento.title}</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn-icon" onClick={onEdit} title="Modifica">
              <IconEdit size={15} />
            </button>
            <button className="btn-icon" onClick={onClose}>
              <IconClose size={16} weight="regular" />
            </button>
          </div>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalChip} style={{ background: statoInfo.bg, color: statoInfo.color }}>{stato}</div>
          <div className={styles.modalRiga}><span className={styles.modalLabel}>Orario</span><span className={styles.modalVal}>{ora}</span></div>
          <div className={styles.modalRiga}><span className={styles.modalLabel}>Persone</span><span className={styles.modalVal}>{persone}</span></div>
          {telefono && <div className={styles.modalRiga}><span className={styles.modalLabel}>Telefono</span><a href={`tel:${telefono}`} className={styles.modalTel}>{telefono}</a></div>}
          {note && (
            <div className={styles.modalNote}>
              <span className={styles.modalLabel}>Note</span>
              <p className={styles.modalNoteText}>{note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CalendarioPanel() {
  const { eventi, loading, ricarica } = useCalendario()
  const calRef = useRef(null)
  const [vistaAttiva, setVistaAttiva] = useState(isMobile() ? 'listWeek' : 'dayGridMonth')
  const [eventoSelezionato, setEventoSelezionato] = useState(null)
  const [prenotazioneEdit, setPrenotazioneEdit] = useState(null)

  function cambiaVista(vista) {
    setVistaAttiva(vista)
    calRef.current?.getApi().changeView(vista)
  }

  function apriEdit() {
    if (!eventoSelezionato) return
    const { ora, persone, stato, note, telefono, email } = eventoSelezionato.extendedProps
    setPrenotazioneEdit({
      id:   eventoSelezionato.id,
      nome: eventoSelezionato.title,
      data: eventoSelezionato.startStr?.split('T')[0],
      ora, persone, stato, note, telefono, email: email || '',
    })
    setEventoSelezionato(null)
  }

  const viste = isMobile()
    ? [{ id: 'listWeek', label: 'Settimana' }, { id: 'listMonth', label: 'Mese' }]
    : [{ id: 'dayGridMonth', label: 'Mese' }, { id: 'timeGridWeek', label: 'Settimana' }]

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconCalendar size={20} />
          Calendario prenotazioni
        </h1>
        <div className={styles.headerActions}>
          <div className={styles.vistaTabs}>
            {viste.map(v => (
              <button key={v.id} className={`btn-toggle ${vistaAttiva === v.id ? 'active' : ''}`} onClick={() => cambiaVista(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <button className="btn-icon" onClick={ricarica} title="Aggiorna">
            <IconRefresh size={15} />
          </button>
        </div>
      </div>
      {loading && <div className={styles.loading}>Caricamento prenotazioni...</div>}
      <div className={styles.calWrap}>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={vistaAttiva}
          locale="it"
          events={eventi}
          eventContent={(info) => <EventoContenuto info={info} />}
          eventClick={(info) => setEventoSelezionato(info.event)}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          buttonText={{ today: 'Vai ad oggi' }}
          height="auto"
          slotMinTime="11:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          firstDay={1}
          nowIndicator={true}
          dayMaxEvents={3}
          listDayFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
          listDaySideFormat={false}
          noEventsText="Nessuna prenotazione"
        />
      </div>

      <ModalDettaglio
        evento={eventoSelezionato}
        onClose={() => setEventoSelezionato(null)}
        onEdit={apriEdit}
      />

      {prenotazioneEdit && (
        <ModalPrenotazione
          prenotazione={prenotazioneEdit}
          onClose={() => setPrenotazioneEdit(null)}
          onSuccess={ricarica}
        />
      )}
    </div>
  )
}
