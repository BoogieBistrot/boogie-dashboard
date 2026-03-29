import styles from './FloatingButton.module.css'
import { IconCalendar } from '../icons/index.jsx'

export default function FloatingButton({ onClick }) {
  return (
    <button className={styles.fab} onClick={onClick} title="Nuova prenotazione">
      <span className={styles.plus}>+</span>
      <IconCalendar size={18} weight="regular" />
      <span className={styles.label}>Prenotazione</span>
    </button>
  )
}
