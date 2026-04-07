import { useState } from 'react'
import { useTag } from '../../../hooks/useTag'
import styles from './GestisciTagTab.module.css'
import sharedStyles from '../FidelityPanel.module.css'

export default function GestisciTagTab() {
  const { tag, loading, aggiungi, elimina } = useTag()
  const [nuovoTag, setNuovoTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleAggiungi(e) {
    e.preventDefault()
    const nome = nuovoTag.trim()
    if (!nome) return
    setSaving(true)
    setMsg(null)
    const res = await aggiungi(nome)
    setSaving(false)
    if (res.success) { setNuovoTag(''); setMsg({ type: 'ok', text: `Tag "${nome}" aggiunto` }) }
    else setMsg({ type: 'err', text: 'Errore — riprova' })
  }

  async function handleElimina(t) {
    if (!confirm(`Eliminare il tag "${t.nome}"?`)) return
    await elimina(t.id)
  }

  return (
    <div>
      <form className={styles.addRow} onSubmit={handleAggiungi}>
        <input
          value={nuovoTag}
          onChange={e => setNuovoTag(e.target.value)}
          placeholder="Nome del nuovo tag..."
          className={styles.addInput}
        />
        <button type="submit" className="btn-primary" disabled={saving || !nuovoTag.trim()}>
          {saving ? '...' : 'Aggiungi'}
        </button>
      </form>
      {msg && <div className={`${sharedStyles.msg} ${sharedStyles[msg.type]}`}>{msg.text}</div>}

      {loading && <div className={sharedStyles.empty}>Caricamento...</div>}
      {!loading && tag.length === 0 && <div className={sharedStyles.empty}>Nessun tag — aggiungine uno sopra</div>}
      <div className={styles.lista}>
        {tag.map(t => (
          <div key={t.id} className={styles.tagRow}>
            <span className={styles.tagNome}>{t.nome}</span>
            <button
              className="btn-icon danger"
              onClick={() => handleElimina(t)}
              title="Elimina"
            >✕</button>
          </div>
        ))}
      </div>
      <p className={styles.nota}>I tag sono usati internamente per il marketing. Non sono visibili ai clienti.</p>
    </div>
  )
}
