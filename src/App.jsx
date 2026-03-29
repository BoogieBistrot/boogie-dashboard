import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import AttesaWidget from './components/home/AttesaWidget'
import MeteoWidget from './components/home/MeteoWidget'
import RecensioniWidget from './components/home/RecensioniWidget'
import PrenotazioniWidget from './components/home/PrenotazioniWidget'
import ChiusurePanel from './components/panels/ChiusurePanel'
import FidelityPanel from './components/panels/FidelityPanel'
import ClientiPanel from './components/panels/ClientiPanel'
import CalendarioPanel from './components/panels/CalendarioPanel'
import AnalyticsPanel from './components/panels/AnalyticsPanel'
import AgendaPanel from './components/panels/AgendaPanel'
import FloatingButton from './components/FloatingButton'
import ModalPrenotazione from './components/ModalPrenotazione'
import styles from './App.module.css'

export default function App() {
  const [view, setView] = useState('home')
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('bb-auth-token'))
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshCalendario, setRefreshCalendario] = useState(0)

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  function handleLogout() {
    localStorage.removeItem('bb-auth-token')
    setAuthed(false)
  }

  function renderContent() {
    switch (view) {
      case 'home': return (
        <div>
          <AttesaWidget />
          <PrenotazioniWidget onNavigate={setView} />
          <MeteoWidget />
          <RecensioniWidget />
        </div>
      )
      case 'calendario': return <CalendarioPanel key={refreshCalendario} />
      case 'chiusure':   return <ChiusurePanel />
      case 'fidelity':   return <FidelityPanel />
      case 'clienti':    return <ClientiPanel />
      case 'analytics':  return <AnalyticsPanel />
      case 'agenda':     return <AgendaPanel />
      default: return null
    }
  }

  return (
    <div className={styles.layout}>
      <Sidebar view={view} onNav={setView} onLogout={handleLogout} />
      <div className={styles.main}>
        <main className={styles.content}>
          {renderContent()}
        </main>
      </div>

      <FloatingButton onClick={() => setModalOpen(true)} />

      {modalOpen && (
        <ModalPrenotazione
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false)
            setRefreshCalendario(r => r + 1)
          }}
        />
      )}
    </div>
  )
}
