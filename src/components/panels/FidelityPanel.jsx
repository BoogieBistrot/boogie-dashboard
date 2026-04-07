import { useState, useEffect } from 'react'
import { useFidelity } from '../../hooks/useFidelity'
import IscriviTab from './fidelity/IscriviTab'
import RicaricaTab from './fidelity/RicaricaTab'
import GestisciTagTab from './fidelity/GestisciTagTab'
import { IconFidelity, IconClienti, IconPuntiAdd, IconPuntiRemove, IconRefresh, IconTag } from '../../icons/index.jsx'
import styles from './FidelityPanel.module.css'

export default function FidelityPanel() {
  const [tab, setTab] = useState('iscrivi')
  const [mostraTutti, setMostraTutti] = useState(false)
  const { clienti, loading, caricaClienti, cercaClienti, iscrivi, ricarica } = useFidelity()

  useEffect(() => { caricaClienti() }, [caricaClienti])

  const tabs = [
    { id: 'iscrivi',  Icon: IconClienti,     label: 'Iscrivi cliente' },
    { id: 'ricarica', Icon: IconPuntiAdd,    label: 'Ricarica punti' },
    { id: 'scala',    Icon: IconPuntiRemove, label: 'Scala punti' },
    // { id: 'tag',      Icon: IconTag,         label: 'Gestisci tag' },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconFidelity size={20} />
          Programma Fidelity
        </h1>
      </div>
      <div className={styles.body}>
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`} onClick={() => setTab(t.id)}>
              <t.Icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.tabContent}>
          {tab === 'iscrivi'  && <IscriviTab iscrivi={iscrivi} onSuccess={caricaClienti} />}
          {tab === 'ricarica' && <RicaricaTab cercaClienti={cercaClienti} ricarica={ricarica} onSuccess={caricaClienti} modo="ricarica" />}
          {tab === 'scala'    && <RicaricaTab cercaClienti={cercaClienti} ricarica={ricarica} onSuccess={caricaClienti} modo="scala" />}
          {/* {tab === 'tag'      && <GestisciTagTab />} */}
        </div>
        <div className={styles.listaBox}>
          <div className={styles.listaHeader}>
            <div className={styles.listaTitle}>
              <IconClienti size={15} />
              Iscritti al programma
              {!loading && clienti.length > 0 && (
                <span className={styles.listaCount}>{clienti.length}</span>
              )}
            </div>
            <button className="btn-icon" onClick={caricaClienti} title="Aggiorna">
              <IconRefresh size={14} />
            </button>
          </div>
          {loading && <div className={styles.empty}>Caricamento...</div>}
          {!loading && clienti.length === 0 && <div className={styles.empty}>Nessun iscritto</div>}
          <div className={styles.lista}>
            {(mostraTutti ? clienti : clienti.slice(0, 5)).map(c => (
              <div key={c.email} className={styles.clienteItem}>
                <div>
                  <div className={styles.clienteNome}>{c.nome} {c.cognome}</div>
                  <div className={styles.clienteEmail}>{c.email}</div>
                </div>
                <div className={styles.clientePuntiBox}>
                  <div className={styles.clientePunti}>{c.punti.toLocaleString('it-IT')}</div>
                  <div className={styles.clientePuntiLabel}>punti</div>
                </div>
              </div>
            ))}
          </div>
          {!loading && clienti.length > 5 && (
            <button className={styles.mostraTuttiBtn} onClick={() => setMostraTutti(v => !v)}>
              {mostraTutti ? 'Mostra meno' : `Mostra tutti (${clienti.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}