import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'
import { useAppuntamenti } from '../../hooks/useAppuntamenti'
import { useMeteo } from '../../hooks/useMeteo'
import { IconClose } from '../../icons/index.jsx'
import { CalendarDots, Sparkle } from '@phosphor-icons/react'
import { authFetch } from '../../lib/authFetch'
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

const TIPO_COLORI_RICORRENTE = {
  'Appuntamento': '#7B5EA7',
  'Scadenza':     '#E67E22',
  'Promemoria':   '#00838F',
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
function ModalAppuntamento({ data, appuntamento, prefill, onSalva, onElimina, onClose }) {
  const isEdit = !!appuntamento
  const [title, setTitle] = useState(appuntamento?.title || prefill?.title || '')
  const [dataVal, setDataVal] = useState(appuntamento?.data || prefill?.data || data || '')
  const [ora, setOra] = useState(appuntamento?.ora || '')
  const [tipo, setTipo] = useState(appuntamento?.tipo || prefill?.tipo || 'Appuntamento')
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

const isMobile = () => window.innerWidth <= 768

function faseSpons(dataEvento) {
  if (!dataEvento) return null
  const oggi = new Date(); oggi.setHours(0,0,0,0)
  const evento = new Date(dataEvento + 'T00:00:00')
  const giorni = Math.round((evento - oggi) / 86400000)
  if (giorni < 2)  return { emoji: '❌', label: 'Troppo tardi per sponsorizzare', sub: 'Usa Stories + link WhatsApp', tipo: 'stop' }
  if (giorni < 5)  return { emoji: '⚠️', label: 'Solo retargeting', sub: 'Mostralo a chi ti conosce già', tipo: 'warning' }
  if (giorni <= 14) return { emoji: '✅', label: 'Momento perfetto — lancia ora!', sub: `${giorni} giorni all'evento`, tipo: 'go' }
  if (giorni <= 30) return { emoji: '⏸️', label: 'Troppo presto per vendere', sub: 'Fai brand awareness, non chiedere prenotazioni', tipo: 'wait' }
  return              { emoji: '⏸️', label: 'Aspetta ancora', sub: 'Torna quando mancano ~14 giorni', tipo: 'wait' }
}

// ─── Pannello principale ─────────────────────────────────────────────────────
export default function AgendaPanel() {
  const { appuntamenti, loading, aggiungi, aggiorna, elimina } = useAppuntamenti()
  const { dati: meteo } = useMeteo()
  const [modal, setModal] = useState(null)
  const [vistaAttiva, setVistaAttiva] = useState(isMobile() ? 'listWeek' : 'dayGridMonth')
  const [aiAperto, setAiAperto] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggerimenti, setAiSuggerimenti] = useState(null)
  const [aiIgnorate, setAiIgnorate] = useState([])
  const [ignorateAperte, setIgnorateAperte] = useState(false)
  const calRef = useRef(null)

  async function richiediSuggerimenti(force = false) {
    setAiAperto(true)
    if (aiSuggerimenti && !force) return
    setAiLoading(true)
    setAiSuggerimenti(null)
    const oggi = new Date()
    const fraduemesi = new Date(oggi)
    fraduemesi.setMonth(fraduemesi.getMonth() + 2)
    const appFiltrati = appuntamenti.filter(a => {
      if (!a.data) return false
      const d = new Date(a.data + 'T12:00:00')
      return d >= oggi && d <= fraduemesi
    })
    const festFiltrate = FESTIVITA.filter(f => {
      const d = new Date(f.date + 'T12:00:00')
      return d >= oggi && d <= fraduemesi
    }).map(f => ({ date: f.date, title: f.title.replace(/\p{Emoji}/gu, '').trim() }))
    try {
      const meteoPerData = {}
      if (meteo) {
        meteo.forEach(g => { meteoPerData[g.dateStr] = g })
      }

      const festivitaConMeteo = festFiltrate.map(f => {
        const m = meteoPerData[f.date]
        return {
          ...f,
          meteo: m ? { tMax: m.tMax, tMin: m.tMin, pioggia: m.pioggia, codice: m.codice } : null
        }
      })

      const res = await authFetch('/.netlify/functions/suggerisci-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appuntamenti: appFiltrati, festivita: festivitaConMeteo, dataOggi: oggi.toISOString().split('T')[0] })
      })
      const json = await res.json()
      setAiSuggerimenti(Array.isArray(json.suggerimenti) ? json.suggerimenti : [])
    } catch {
      setAiSuggerimenti([])
    }
    setAiLoading(false)
  }

  function ignoraSuggerimento(i) {
    const s = aiSuggerimenti[i]
    setAiSuggerimenti(prev => prev.filter((_, idx) => idx !== i))
    setAiIgnorate(prev => [...prev, s])
  }

  function ripristinaSuggerimento(i) {
    const s = aiIgnorate[i]
    setAiIgnorate(prev => prev.filter((_, idx) => idx !== i))
    setAiSuggerimenti(prev => [...(prev || []), s])
  }

  function seguiConsiglio(s) {
    setModal({ data: s.dataFestivita, appuntamento: null, prefill: { title: s.festivita, data: s.dataFestivita, tipo: 'Appuntamento' } })
    ignoraSuggerimento(aiSuggerimenti.indexOf(s))
  }

  function cambiaVista(vista) {
    setVistaAttiva(vista)
    calRef.current?.getApi().changeView(vista)
  }

  const viste = isMobile()
    ? [{ id: 'listDay', label: 'Giorno' }, { id: 'listWeek', label: 'Settimana' }, { id: 'listMonth', label: 'Mese' }]
    : [{ id: 'dayGridMonth', label: 'Mese' }, { id: 'timeGridWeek', label: 'Settimana' }, { id: 'timeGridDay', label: 'Giorno' }]

  const festivitaLabels = FESTIVITA.map(f => ({
    ...f,
    color: 'transparent',
    textColor: '#A0722A',
    classNames: ['fc-festivita-label'],
    editable: false,
  }))

  const appEvents = appuntamenti.flatMap(a => {
    const isRicorrente = a.ricorrenza && a.ricorrenza !== 'nessuna'
    const color = isRicorrente
      ? (TIPO_COLORI_RICORRENTE[a.tipo] || TIPO_COLORI_RICORRENTE['Appuntamento'])
      : (TIPO_COLORI[a.tipo] || TIPO_COLORI['Appuntamento'])
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

    const endRecur = a.dataFineRicorrenza || null

    if (a.ricorrenza === 'giornaliera') {
      const ev = { ...base, groupId: a.id, daysOfWeek: [0,1,2,3,4,5,6], startRecur: a.data }
      if (endRecur) ev.endRecur = endRecur
      return [ev]
    }

    if (a.ricorrenza === 'settimanale') {
      const giorni = a.giorniSettimana
        ? a.giorniSettimana.split(',').map(Number)
        : [new Date(a.data + 'T12:00:00').getDay()]
      const ev = { ...base, groupId: a.id, daysOfWeek: giorni, startRecur: a.data }
      if (endRecur) ev.endRecur = endRecur
      return [ev]
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
        <div className={styles.headerRight}>
          <div className={styles.vistaTabs}>
            {viste.map(v => (
              <button key={v.id} className={`btn-toggle ${vistaAttiva === v.id ? 'active' : ''}`} onClick={() => cambiaVista(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <button className={styles.btnAi} onClick={richiediSuggerimenti}>
            <Sparkle size={15} weight="fill" />
            <span className={styles.btnAiLabel}>Radar Festività</span>
          </button>
        </div>
      </div>

      <div className={`${styles.contentLayout} ${aiAperto ? styles.contentLayoutAi : ''}`}>
        <div className={styles.layout}>
          <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={vistaAttiva}
              locale={itLocale}
              height="auto"
              headerToolbar={{ left: 'prev', center: 'title', right: 'next' }}
              events={[...festivitaLabels, ...appEvents]}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              editable={false}
              dayMaxEvents={3}
              listDayFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
              listDaySideFormat={false}
              noEventsText="Nessun appuntamento"
            />
        </div>

        {aiAperto && (
          <div className={styles.aiPanel}>
            <div className={styles.aiHeader}>
              <span className={styles.aiTitolo}><Sparkle size={14} weight="fill" /> Radar Festività</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!aiLoading && <button className="btn-icon" title="Rigenera" onClick={() => richiediSuggerimenti(true)}>↺</button>}
                <button className="btn-icon" onClick={() => setAiAperto(false)}><IconClose size={14} /></button>
              </div>
            </div>
            <div className={styles.aiBody}>
              {aiLoading
                ? <span className={styles.aiLoading}>Elaborazione in corso...</span>
                : <>
                    {aiSuggerimenti && aiSuggerimenti.length === 0 && aiIgnorate.length === 0 && (
                      <span className={styles.aiLoading}>Nessuna festività scoperta nei prossimi 30 giorni.</span>
                    )}
                    {(aiSuggerimenti || []).map((s, i) => (
                      <div key={i} className={styles.aiCard}>
                        {(s.categoria || s.meteo_mood) && (
                          <div className={styles.aiMeta}>
                            {s.categoria && <span className={styles.aiCategoria}>{s.categoria}</span>}
                            {s.meteo_mood && <span className={styles.aiMeteo}>{s.meteo_mood}</span>}
                          </div>
                        )}
                        <p className={styles.aiTesto}><strong>{s.festivita}</strong> — {s.testo}</p>
                        {(s.dataFestivita || s.evento?.data) && (() => {
                          const f = faseSpons(s.dataFestivita || s.evento?.data)
                          return (
                            <div className={`${styles.faseBadge} ${styles[`faseBadge_${f.tipo}`]}`}>
                              <span>{f.emoji} {f.label}</span>
                              {f.sub && <span className={styles.faseSub}>{f.sub}</span>}
                            </div>
                          )
                        })()}
                        <div className={styles.aiActions}>
                          <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => ignoraSuggerimento(i)}>Ignora</button>
                          <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => seguiConsiglio(s)}>+ Aggiungi</button>
                        </div>
                      </div>
                    ))}
                    {aiIgnorate.length > 0 && (
                      <div className={styles.ignorateWrap}>
                        <button className={styles.ignorateToggle} onClick={() => setIgnorateAperte(p => !p)}>
                          {ignorateAperte ? '▲' : '▼'} Ignorate ({aiIgnorate.length})
                        </button>
                        {ignorateAperte && aiIgnorate.map((s, i) => (
                          <div key={i} className={styles.aiCardIgnorata}>
                            <p className={styles.aiTesto}><strong>{s.festivita}</strong> — {s.testo}</p>
                            <div className={styles.aiActions}>
                              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => ripristinaSuggerimento(i)}>Ripristina</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
              }
            </div>
          </div>
        )}
      </div>

      {modal && (
        <ModalAppuntamento
          data={modal.data}
          appuntamento={modal.appuntamento}
          prefill={modal.prefill}
          onSalva={handleSalva}
          onElimina={handleElimina}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
