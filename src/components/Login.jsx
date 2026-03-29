import { useState } from 'react'
import styles from './Login.module.css'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (password === 'Colle2026!$') {
      localStorage.setItem('bb-auth-token', 'authenticated')
      onLogin()
    } else {
      setError(true); setShake(true); setPassword('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.box} ${shake ? styles.shake : ''}`}>
        <div className={styles.logo}>
          <img src="/Logo-Black.svg" alt="Boogie Bistrot" className={styles.logoImg} />
        </div>
        <h1 className={styles.title}>Boogie Bistrot</h1>
        <p className={styles.subtitle}>Pannello di gestione</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="••••••••" autoFocus
              className={error ? styles.inputError : ''} />
            {error && <span className={styles.errorMsg}>Password errata</span>}
          </div>
          <button type="submit" className={styles.btn}>Accedi →</button>
        </form>
      </div>
    </div>
  )
}
