import { useState, useRef } from 'react'
import styles from './RicaricaTab.module.css'
import sharedStyles from '../FidelityPanel.module.css'

export default function RicaricaTab({ cercaClienti, ricarica, onSuccess, modo = 'ricarica' }) {
  const isScala = modo === 'scala'
  const [query, setQuery] = useState('')
  const [dropdown, setDropdown] = useState([])
  const [cliente, setCliente] = useState(null)
  const [importo, setImporto] = useState('')
  const [puntiScala, setPuntiScala] = useState('')
  const [nota, setNota] = useState('')
  const [doppi, setDoppi] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const searchTimer = useRef(null)

  function onSearch(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setDropdown([]); return }
    searchTimer.current = setTimeout(async () => {
      const risultati = await cercaClienti(q)
      setDropdown(risultati)
    }, 400)
  }

  function seleziona(c) {
    setCliente(c); setQuery(c.nome + ' ' + c.cognome)
    setDropdown([]); setImporto(''); setPuntiScala(''); setMsg(null)
  }

  function calcolaPunti() {
    if (isScala) {
      const ps = parseInt(puntiScala) || 0
      return ps > 0 ? { valore: ps, label: `-${ps.toLocaleString('it-IT')}`, nuovo: Math.max(0, (cliente?.punti || 0) - ps) } : null
    }
    const imp = parseFloat(importo) || 0
    if (imp <= 0) return null
    const pts = Math.ceil(imp * 5) * (doppi ? 2 : 1)
    return { valore: pts, label: `+${pts.toLocaleString('it-IT')}`, nuovo: (cliente?.punti || 0) + pts }
  }

  const preview = calcolaPunti()

  async function handleSubmit() {
    if (!cliente) { setMsg({ type: 'err', text: 'Seleziona prima un cliente' }); return }
    if (isScala && (!puntiScala || parseInt(puntiScala) <= 0)) { setMsg({ type: 'err', text: 'Inserisci i punti da scalare' }); return }
    if (!isScala && (!importo || parseFloat(importo) <= 0)) { setMsg({ type: 'err', text: 'Inserisci un importo valido' }); return }
    setLoading(true); setMsg(null)
    const payload = isScala
      ? { email: cliente.email, importo: 0, nota, moltiplicatore: 1, scalaP: parseInt(puntiScala) }
      : { email: cliente.email, importo: parseFloat(importo), nota, moltiplicatore: doppi ? 2 : 1 }
    const res = await ricarica(payload)
    setLoading(false)
    if (res.success) {
      setMsg({ type: 'ok', text: isScala ? `-${parseInt(puntiScala)} punti scalati — Totale: ${res.nuoviPunti}` : `+${res.puntiAggiunti} punti aggiunti — Totale: ${res.nuoviPunti}` })
      setCliente(null); setQuery(''); setImporto(''); setPuntiScala(''); setNota(''); setDoppi(false)
      onSuccess?.()
    } else {
      setMsg({ type: 'err', text: 'Errore — riprova' })
    }
  }

  return (
    <div>
      <div className={sharedStyles.field} style={{ marginBottom: '10px' }}>
        <label>Cerca cliente (nome o email)</label>
        <div className={styles.searchWrap}>
          <input value={query} onChange={onSearch} placeholder="Es. Mario o mario@email.com" autoComplete="off" />
          {dropdown.length > 0 && (
            <div className={styles.dropdown}>
              {dropdown.map(c => (
                <div key={c.email} className={styles.dropItem} onClick={() => seleziona(c)}>
                  <div className={styles.dropNome}>{c.nome} {c.cognome}</div>
                  <div className={styles.dropEmail}>{c.email} · <span className={styles.dropPunti}>{c.punti.toLocaleString('it-IT')} pts</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {cliente && (
        <div className={styles.clienteBox}>
          <div>
            <div className={styles.clienteNome}>{cliente.nome} {cliente.cognome}</div>
            <div className={styles.clienteEmail}>{cliente.email}</div>
          </div>
          <div className={styles.clientePuntiBox}>
            <div className={styles.clientePuntiLabel}>Punti attuali</div>
            <div className={styles.clientePunti}>{cliente.punti.toLocaleString('it-IT')}</div>
          </div>
        </div>
      )}

      <div className={styles.importoRow}>
        <div className={sharedStyles.field}>
          <label>{isScala ? 'Punti da scalare' : 'Importo spesa (€)'}</label>
          {isScala
            ? <input type="number" value={puntiScala} onChange={e => setPuntiScala(e.target.value)} placeholder="Es. 500" min="0" />
            : <input type="number" value={importo} onChange={e => setImporto(e.target.value)} placeholder="0.00" min="0" step="0.01" />
          }
        </div>
        {!isScala && (
          <div className={sharedStyles.field}>
            <label>Punti da aggiungere</label>
            <div className={styles.preview}>
              <span className={`${styles.previewVal} ${preview ? styles.previewPos : ''}`}>
                {preview ? preview.label : '—'}
              </span>
              {preview && cliente && <span className={styles.previewTot}>→ tot. {preview.nuovo.toLocaleString('it-IT')}</span>}
            </div>
          </div>
        )}
      </div>

      {!isScala && (
        <div style={{ marginBottom: '14px' }}>
          <button type="button" className={`btn-toggle ${doppi ? 'active' : ''}`} style={{ flex: 'none' }} onClick={() => setDoppi(d => !d)}>
            Punti doppi 2×
          </button>
        </div>
      )}

      <div className={sharedStyles.field} style={{ marginBottom: '16px' }}>
        <label>Nota (opzionale)</label>
        <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Es. Cena del 20 marzo" />
      </div>

      <button type="button" className={`btn-primary${isScala ? ' ' + styles.btnScala : ''}`} disabled={loading} onClick={handleSubmit}>
        {loading ? '...' : isScala ? 'Scala punti e invia mail' : 'Aggiungi punti e invia mail'}
      </button>

      {msg && <div className={`${sharedStyles.msg} ${sharedStyles[msg.type]}`}>{msg.text}</div>}
    </div>
  )
}