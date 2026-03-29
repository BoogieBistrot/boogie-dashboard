import { useState } from 'react'
import { usePrenotazioni } from '../../hooks/usePrenotazioni'
import { IconRefresh, IconClose, IconCheck } from '../../icons/index.jsx'
import styles from './AttesaWidget.module.css'

const CONFERMA_BASE = 'https://www.boogiebistrot.com/conferma-prenotazione'
const NETLIFY_BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'

const GIORNI_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function formatData(dataStr) {
  if (!dataStr) return dataStr
  // dataStr formato YYYY-MM-DD
  const [y, m, d] = dataStr.split('-')
  const date = new Date(`${y}-${m}-${d}T12:00:00`)
  const giorno = GIORNI_SHORT[date.getDay()]
  return `${giorno} ${d}/${m}/${y}`
}

export default function AttesaWidget() {
  const { attesa, loading, ricarica } = usePrenotazioni()
  const [cancellando, setCancellando] = useState(null)
  const [confermaId, setConfermaId] = useState(null)

  async function handleCancella(id) {
    if (confermaId !== id) { setConfermaId(id); return }
    setCancellando(id); setConfermaId(null)
    try {
      await fetch(NETLIFY_BASE + '/cancella-prenotazione', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
      })
    } catch {}
    setCancellando(null); ricarica()
  }

  if (loading) return null
  if (!attesa.length) return null

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>
            Prenotazioni in attesa
            <span className={styles.badge}>{attesa.length}</span>
          </span>
        </div>
        <button className="btn-icon" onClick={ricarica} title="Aggiorna">
          <IconRefresh size={15} />
        </button>
      </div>
      <div className={styles.list}>
        {attesa.map(p => (
          <div key={p.id} className={styles.item}>
            <div className={styles.info}>
              <div className={styles.nome}>{p.nome}</div>
              <div className={styles.dettagli}>{formatData(p.data)} · {p.ora} · {p.persone} pers.</div>
              {p.note && <div className={styles.note}>{p.note}</div>}
            </div>
            <div className={styles.actions}>
              {confermaId === p.id ? (
                <div className={styles.confermaBox}>
                  <span className={styles.confermaText}>Sicuro?</span>
                  <button className="btn-danger" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => handleCancella(p.id)} disabled={cancellando === p.id}>Sì, cancella</button>
                  <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setConfermaId(null)}>No</button>
                </div>
              ) : (
                <>
                  <button className="btn-icon danger" onClick={() => setConfermaId(p.id)} disabled={cancellando === p.id} title="Cancella">
                    <IconClose size={14} weight="regular" />
                  </button>
                  <a href={CONFERMA_BASE + '?id=' + p.id} target="_blank" rel="noreferrer" className={`btn-primary ${styles.btnConferma}`}>
                    <IconCheck size={14} weight="regular" />
                    Conferma
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}