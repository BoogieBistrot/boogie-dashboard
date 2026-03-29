import React, { useState } from 'react'
import styles from './Sidebar.module.css'
import {
  IconHome, IconCalendar, IconLock, IconFidelity,
  IconClienti, IconMarketing, IconLogout, IconMenu, IconClose, IconAnalytics, IconAgenda,
} from '../icons/index.jsx'

const NAV_ITEMS = [
  { id: 'home',       Icon: IconHome,      label: 'Home' },
  { id: 'separator',  section: 'Prenotazioni' },
  { id: 'calendario', Icon: IconCalendar,  label: 'Calendario Prenotazioni' },
  { id: 'chiusure',   Icon: IconLock,      label: 'Chiusure & Aperture' },
  { id: 'separator2', section: 'Clienti' },
  { id: 'fidelity',   Icon: IconFidelity,  label: 'Programma Fidelity' },
  { id: 'clienti',    Icon: IconClienti,   label: 'Database Clienti' },
  { id: 'separator3', section: 'Gestione' },
  { id: 'agenda',     Icon: IconAgenda,    label: 'Agenda & Note' },
  { id: 'analytics',  Icon: IconAnalytics, label: 'Analytics' },
  { id: 'separator4', section: 'Marketing' },
  { id: 'marketing',  Icon: IconMarketing, label: 'Mail massive (Brevo)', href: 'https://app.brevo.com' },
]

export default function Sidebar({ view, onNav, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleNav(id) { onNav(id); setMobileOpen(false) }

  const navContent = (
    <>
      <div className={styles.logo}>
        <img src="/Logo-Gold.svg" alt="Boogie Bistrot" className={styles.logoImg} />
        <div>
          <div className={styles.logoText}>Boogie Bistrot</div>
          <div className={styles.logoSub}>Gestionale</div>
        </div>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          if (item.section) return (
            <React.Fragment key={item.id}>
              <div className={styles.divider} />
              <div className={styles.sectionLabel}>{item.section}</div>
            </React.Fragment>
          )
          if (item.href) return (
            <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className={styles.item}>
              <span className={styles.icon}><item.Icon /></span>
              <span className={styles.label}>{item.label}</span>
            </a>
          )
          return (
            <button key={item.id} className={`${styles.item} ${view === item.id ? styles.active : ''}`} onClick={() => handleNav(item.id)}>
              <span className={styles.icon}><item.Icon /></span>
              <span className={styles.label}>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className={styles.bottom}>
        <button className={styles.logoutBtn} onClick={onLogout}>
          <IconLogout size={15} />
          Esci
        </button>
      </div>
    </>
  )

  return (
    <>
      <aside className={styles.sidebar}>{navContent}</aside>
      <div className={styles.mobileBar}>
        <div className={styles.mobileLogoRow}>
          <img src="/Logo-Gold.svg" alt="" style={{ height: '24px' }} />
          <span className={styles.mobileTitle}>Boogie Bistrot</span>
        </div>
        <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <IconClose size={20} weight="regular" /> : <IconMenu size={20} weight="regular" />}
        </button>
      </div>
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)}>
          <div className={styles.mobileMenu} onClick={e => e.stopPropagation()}>
            {navContent}
          </div>
        </div>
      )}
    </>
  )
}