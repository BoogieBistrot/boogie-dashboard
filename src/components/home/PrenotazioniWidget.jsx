import { useState } from 'react'
import { usePrenotazioniGiornaliere } from '../../hooks/usePrenotazioniGiornaliere'
import { IconRefresh, IconCalendar } from '../../icons/index.jsx'
import styles from './PrenotazioniWidget.module.css'

const GIORNI_NOME = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MESI_NOME  = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function formatData(dataStr) {
  const d = new Date(dataStr + 'T12:00:00')
  return `${GIORNI_NOME[d.getDay()]} ${d.getDate()} ${MESI_NOME[d.getMonth()]}`
}

function isOggi(dataStr) {
  return dataStr === new Date().toISOString().split('T')[0]
}

function isBesok(dataStr) {
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  return dataStr === domani.toISOString().split('T')[0]
}

function getLabelGiorno(dataStr) {
  if (isOggi(dataStr)) return 'Oggi'
  if (isBesok(dataStr)) return 'Domani'
  return formatData(dataStr)
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

function GiornoCard({ giorno }) {
  const [aperto, setAperto] = useState(isOggi(giorno.data))
  const label = getLabelGiorno(giorno.data)

  return (
    <div className={`${styles.giornoCard} ${isOggi(giorno.data) ? styles.oggi : ''}`}>
      <div className={styles.giornoHeader} onClick={() => setAperto(o => !o)}>
        <div className={styles.giornoInfo}>
          <span className={styles.giornoLabel}>{label}</span>
          <span className={styles.giornoData}>{formatData(giorno.data)}</span>
        </div>
        <div className={styles.giornoStats}>
          {giorno.totPrenotazioni > 0 ? (
            <>
              <span className={styles.statChip}>{giorno.totPrenotazioni} pren.</span>
              <span className={styles.statChip}>{giorno.totPersone} coperti</span>
              {giorno.pizza > 0 && <span className={styles.statChipPizza}>🍕 {giorno.pizza}</span>}
              {giorno.cucina > 0 && <span className={styles.statChipCucina}>🍽️ {giorno.cucina}</span>}
            </>
          ) : (
            <span className={styles.nessuna}>Nessuna prenotazione</span>
          )}
          <span className={styles.chevron}>{aperto ? '▴' : '▾'}</span>
        </div>
      </div>

      {aperto && giorno.totPrenotazioni > 0 && (
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

      {aperto && giorno.totPrenotazioni === 0 && (
        <div className={styles.listaVuota}>Nessuna prenotazione per questo giorno</div>
      )}
    </div>
  )
}

export default function PrenotazioniWidget({ onNavigate }) {
  const { giorni, loading, carica } = usePrenotazioniGiornaliere()

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
            {giorni.map(g => <GiornoCard key={g.data} giorno={g} />)}
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
