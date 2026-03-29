import { useState } from 'react'
import styles from '../FidelityPanel.module.css'

export default function IscriviTab({ iscrivi, onSuccess }) {
  const [form, setForm] = useState({ nome: '', cognome: '', email: '' })
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome || !form.email) { setMsg({ type: 'err', text: 'Nome e email obbligatori' }); return }
    setLoading(true); setMsg(null)
    const res = await iscrivi({ ...form, consenso_privacy: true })
    setLoading(false)
    if (res.alreadyMember) {
      setMsg({ type: 'neutral', text: 'Cliente già iscritto al programma' })
    } else if (res.success) {
      setMsg({ type: 'ok', text: '✓ Iscritto con successo' })
      setForm({ nome: '', cognome: '', email: '' })
      onSuccess?.()
    } else {
      setMsg({ type: 'err', text: 'Errore — riprova' })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label>Nome</label>
          <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Mario" />
        </div>
        <div className={styles.field}>
          <label>Cognome</label>
          <input value={form.cognome} onChange={e => setForm(p => ({ ...p, cognome: e.target.value }))} placeholder="Rossi" />
        </div>
      </div>
      <div className={styles.field} style={{ marginBottom: '16px' }}>
        <label>Email</label>
        <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="mario@email.com" />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Iscrizione...' : 'Iscrivi cliente'}
      </button>
      {msg && <div className={`${styles.msg} ${styles[msg.type]}`}>{msg.text}</div>}
    </form>
  )
}