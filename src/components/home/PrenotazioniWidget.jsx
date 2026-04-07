import { useState } from 'react'
import { usePrenotazioniGiornaliere } from '../../hooks/usePrenotazioniGiornaliere'
import { useOrari } from '../../hooks/useOrari'
import { useChiusure } from '../../hooks/useChiusure'
import { IconRefresh, IconCalendar } from '../../icons/index.jsx'
import styles from './PrenotazioniWidget.module.css'

const GIORNI_NOME = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MESI_NOME  = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function formatData(dataStr) {
  const d = new Date(dataStr + 'T12:00:00')
  return `${GIORNI_NOME[d.getDay()]} ${d.getDate()} ${MESI_NOME[d.getMonth()]}`
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function isOggi(dataStr) {
  return dataStr === localDateStr(new Date())
}

function isBesok(dataStr) {
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  return dataStr === localDateStr(domani)
}

function getLabelGiorno(dataStr) {
  if (isOggi(dataStr)) return 'Oggi'
  if (isBesok(dataStr)) return 'Domani'
  return formatData(dataStr)
}

function isGiornoChiuso(dateStr, orari, chiusure) {
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()

  const matchData = (c) =>
    (c.tipo === 'Data specifica' && c.dataInizio <= dateStr && dateStr <= c.dataFine) ||
    (c.tipo === 'Ricorrente' && c.giorno === dayOfWeek)

  // Apertura straordinaria: ha priorità su tutto
  if (chiusure.some(c => c.tipoApertura === 'Apertura' && !c.fascia && matchData(c))) return false

  // Chiusura straordinaria giornata intera
  if (chiusure.some(c => c.tipoApertura !== 'Apertura' && !c.fascia && matchData(c))) return true

  // Chiusura ordinaria: nessun orario attivo per questo giorno
  if (orari.length > 0 && !orari.some(o => o.giorno === dayOfWeek && o.attivo)) return true

  return false
}

function PrefBadge({ preferenza }) {
  if (!preferenza) return null
  const hasPizza  = preferenza.includes('Pizza')
  const hasCucina = preferenza.includes('Cucina')
  return (
    <span className={styles.prefBadge}>
      {hasPizza  && <span className={styles.prefPizza}>🍕</span>}
      {hasCucina && <span className={styles.prefCucina}>🍽️</span>}
    </span>
  )
}

function GiornoCard({ giorno, chiuso }) {
  const [aperto, setAperto] = useState(isOggi(giorno.data) && !chiuso)
  const label = getLabelGiorno(giorno.data)

  return (
    <div className={`${styles.giornoCard} ${isOggi(giorno.data) ? styles.oggi : ''}`}>
      <div className={styles.giornoHeader} onClick={() => !chiuso && setAperto(o => !o)}
        style={chiuso ? { cursor: 'default' } : {}}>
        <div className={styles.giornoInfo}>
          <span className={styles.giornoLabel}>{label}</span>
          <span className={styles.giornoData}>{formatData(giorno.data)}</span>
        </div>
        <div className={styles.giornoStats}>
          {chiuso ? (
            <span className={styles.chiusoBadge}>Chiuso</span>
          ) : giorno.totPrenotazioni > 0 ? (
            <>
              <span className={styles.statChip}>{giorno.totPrenotazioni} pren.</span>
              <span className={styles.statChip}>{giorno.totPersone} coperti</span>
              {giorno.pizza > 0 && <span className={styles.statChipPizza}>🍕 {giorno.pizza}</span>}
              {giorno.cucina > 0 && <span className={styles.statChipCucina}>🍽️ {giorno.cucina}</span>}
            </>
          ) : (
            <span className={styles.nessuna}>Nessuna prenotazione</span>
          )}
          {!chiuso && <span className={styles.chevron}>{aperto ? '▴' : '▾'}</span>}
        </div>
      </div>

      {aperto && !chiuso && giorno.totPrenotazioni > 0 && (
        <div className={styles.lista}>
          {giorno.prenotazioni
            .sort((a, b) => a.ora.localeCompare(b.ora))
            .map(p => (
              <div key={p.id} className={styles.pren}>
                <div className={styles.prenOra}>{p.ora}</div>
                <div className={styles.prenInfo}>
                  <div className={styles.prenNome}>
                    {p.nome}
                    <PrefBadge preferenza={p.preferenza} />
                  </div>
                  <div className={styles.prenMeta}>
                    {p.persone} pers.
                    {p.telefono && <a href={`tel:${p.telefono}`} className={styles.prenTel}>{p.telefono}</a>}
                    {p.note && <span className={styles.prenNote}>{p.note}</span>}
                  </div>
                </div>
                <div className={styles.prenStato} style={{
                  color: p.stato === 'Confermata' ? 'var(--success)' : 'var(--accent)'
                }}>
                  {p.stato}
                </div>
              </div>
            ))}
        </div>
      )}

      {aperto && !chiuso && giorno.totPrenotazioni === 0 && (
        <div className={styles.listaVuota}>Nessuna prenotazione per questo giorno</div>
      )}
    </div>
  )
}

export default function PrenotazioniWidget({ onNavigate }) {
  const { giorni, loading, carica } = usePrenotazioniGiornaliere()
  const { orari } = useOrari()
  const { chiusure } = useChiusure()

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>
          <IconCalendar size={16} />
          Prenotazioni — prossimi 3 giorni
        </span>
        <button className="btn-icon" onClick={carica} title="Aggiorna">
          <IconRefresh size={15} />
        </button>
      </div>

      {loading && <div className={styles.loading}>Caricamento...</div>}

      {!loading && (
        <>
          <div className={styles.giorni}>
            {giorni.map(g => (
              <GiornoCard
                key={g.data}
                giorno={g}
                chiuso={isGiornoChiuso(g.data, orari, chiusure)}
              />
            ))}
          </div>
          <div className={styles.footer}>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => onNavigate?.('calendario')}
            >
              <IconCalendar size={14} />
              Vai al calendario completo
            </button>
          </div>
        </>
      )}
    </div>
  )
}
