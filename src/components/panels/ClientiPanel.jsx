import { useState, useEffect, useRef } from 'react'
import { IconClienti } from '../../icons/index.jsx'
import styles from './ClientiPanel.module.css'

const NETLIFY_BASE = 'https://shimmering-sundae-54b044.netlify.app/.netlify/functions'
const LIMIT = 50

export default function ClientiPanel() {
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [totale, setTotale] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cerca, setCerca] = useState('')
  const searchTimer = useRef(null)

  function carica(p = 1, q = '') {
    setLoading(true)
    fetch(NETLIFY_BASE + '/get-clienti?page=' + p + '&limit=' + LIMIT + '&q=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(json => { if (json.success) { setClienti(json.clienti || []); setTotale(json.totale || 0); setPagina(p) } setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { carica(1, '') }, [])

  function onCerca(e) {
    const q = e.target.value; setCerca(q)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => carica(1, q), 500)
  }

  const totPagine = Math.ceil(totale / LIMIT)

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconClienti size={20} />
          Database Clienti
        </h1>
        <div className={styles.headerRight}>
          <span className={styles.count}>{totale} contatti totali</span>
          <a href="https://app.brevo.com/contact/list-listing/id/3" target="_blank" rel="noreferrer" className={`btn-secondary ${styles.brevoLink}`}>↗ Apri in Brevo</a>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.searchRow}>
          <input type="text" placeholder="Cerca per nome o email..." value={cerca} onChange={onCerca} className={styles.searchInput} />
          <span className={styles.risultati}>{loading ? 'Caricamento...' : clienti.length + ' risultati'}</span>
        </div>
        {!loading && clienti.length === 0 && <div className={styles.empty}>Nessun risultato</div>}
        {clienti.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Nome</th><th>Email</th><th>Telefono</th><th>Punti</th><th>Fidelity</th><th>Marketing</th></tr></thead>
              <tbody>
                {clienti.map(c => (
                  <tr key={c.email}>
                    <td className={styles.tdNome}>{c.nome} {c.cognome}</td>
                    <td className={styles.tdEmail}>{c.email}</td>
                    <td className={styles.tdEmail}>{c.telefono || '—'}</td>
                    <td className={styles.tdPunti}>{c.fidelity ? <span className={styles.puntiChip}>{c.punti}</span> : '—'}</td>
                    <td><span className={`${styles.chip} ${c.fidelity ? styles.chipSi : styles.chipNo}`}>{c.fidelity ? '✓' : '✕'}</span></td>
                    <td><span className={`${styles.chip} ${c.marketing ? styles.chipSi : styles.chipNo}`}>{c.marketing ? '✓' : '✕'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totPagine > 1 && !cerca && (
          <div className={styles.paginazione}>
            <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => carica(pagina - 1, cerca)} disabled={pagina === 1 || loading}>← Prev</button>
            <span className={styles.pageInfo}>Pagina {pagina} di {totPagine}</span>
            <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => carica(pagina + 1, cerca)} disabled={pagina >= totPagine || loading}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}