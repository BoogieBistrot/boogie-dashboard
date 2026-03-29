import { useRecensioni } from '../../hooks/useRecensioni'
import { IconStar, IconGoogle, IconTripAdvisor } from '../../icons/index.jsx'
import styles from './RecensioniWidget.module.css'

function Diff({ val }) {
  if (val === null || val === undefined) return <span className={styles.nd}>N/D</span>
  const pos = val >= 0
  return (
    <span className={pos ? styles.pos : styles.neg}>
      {pos ? '+' : ''}{val}
    </span>
  )
}

function Piattaforma({ nome, IconComponent, voto, recensioni, diffSettimana, diffMese }) {
  return (
    <div className={styles.piattaforma}>
      <div className={styles.pHeader}>
        <span className={styles.pEmoji}><IconComponent size={16} /></span>
        <span className={styles.pNome}>{nome}</span>
        {voto && <span className={styles.pVoto}>★ {voto}</span>}
      </div>
      {recensioni && <div className={styles.pCount}>{recensioni} recensioni</div>}
      <div className={styles.pStats}>
        <div className={styles.pStat}>
          <span className={styles.pStatLabel}>vs settimana scorsa</span>
          <Diff val={diffSettimana} />
        </div>
        <div className={styles.pStat}>
          <span className={styles.pStatLabel}>vs mese scorso</span>
          <Diff val={diffMese} />
        </div>
      </div>
    </div>
  )
}

export default function RecensioniWidget() {
  const { dati, loading } = useRecensioni()

  if (loading) return null
  if (!dati) return null

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>
          <IconStar size={16} />
          Recensioni
        </span>
      </div>
      <div className={styles.grid}>
        <Piattaforma
          nome="Google"
          IconComponent={IconGoogle}
          voto={dati.google?.votoAttuale}
          recensioni={dati.google?.recensioni}
          diffSettimana={dati.google?.diffSettimana}
          diffMese={dati.google?.diffMese}
        />
        <Piattaforma
          nome="TripAdvisor"
          IconComponent={IconTripAdvisor}
          voto={dati.tripadvisor?.votoAttuale}
          recensioni={dati.tripadvisor?.recensioni}
          diffSettimana={dati.tripadvisor?.diffSettimana}
          diffMese={dati.tripadvisor?.diffMese}
        />
      </div>
    </div>
  )
}