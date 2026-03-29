import { useState } from 'react'
import { useMeteo, icona } from '../../hooks/useMeteo'
import { IconWeather } from '../../icons/index.jsx'
import styles from './MeteoWidget.module.css'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function GiornoCard({ g, isToday }) {
  return (
    <div className={`${styles.day} ${isToday ? styles.dayToday : ''}`}>
      <div className={styles.dow}>{isToday ? 'Oggi' : g.label}</div>
      <div className={styles.date}>{g.giorno} {MESI[new Date(g.dateStr + 'T12:00:00').getMonth()]}</div>
      <div className={styles.fasce}>
        {[
          { label: 'Matt', data: g.fasce.mat },
          { label: 'Pom',  data: g.fasce.pom },
          { label: 'Sera', data: g.fasce.ser },
        ].map(({ label, data }) => data ? (
          <div key={label} className={styles.fascia}>
            <div className={styles.fasciaLabel}>{label}</div>
            <div className={styles.fasciaIcon}>{icona(data.c)}</div>
            <div className={styles.fasciaTemp}>{data.t}°</div>
            {data.w > 0 && (
              <div className={`${styles.fasciaWind} ${data.w >= 35 ? styles.fasciaWindDanger : data.w >= 20 ? styles.fasciaWindWarning : ''}`}>
                {data.w >= 35 && '⚠️ '}{data.w} km/h
              </div>
            )}
          </div>
        ) : null)}
      </div>
      <div className={styles.footer}>
        <span className={styles.tMax}><span className={styles.tLabel}>max</span> {g.tMax}°</span>
        <span className={styles.tSep}>/</span>
        <span className={styles.tMin}><span className={styles.tLabel}>min</span> {g.tMin}°</span>
        {g.pioggia > 0 && <span className={styles.rain}>{g.pioggia.toFixed(1)}mm</span>}
      </div>
    </div>
  )
}

export default function MeteoWidget() {
  const { dati, loading } = useMeteo()
  const [mobileDay, setMobileDay] = useState(0)

  if (loading) return <div className={styles.widget}><div className={styles.loading}>Caricamento meteo...</div></div>
  if (!dati) return null

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>
          <IconWeather size={16} />
          Previsioni meteo
        </span>
        <span className={styles.loc}>Colle Brianza</span>
      </div>

      <div className={styles.grid}>
        {dati.map((g, i) => <GiornoCard key={i} g={g} isToday={i === 0} />)}
      </div>

      <div className={styles.mobileView}>
        <button
          className={styles.arrow}
          onClick={() => setMobileDay(d => Math.max(0, d - 1))}
          disabled={mobileDay === 0}
        >‹</button>
        <GiornoCard g={dati[mobileDay]} isToday={mobileDay === 0} />
        <button
          className={styles.arrow}
          onClick={() => setMobileDay(d => Math.min(dati.length - 1, d + 1))}
          disabled={mobileDay === dati.length - 1}
        >›</button>
      </div>
    </div>
  )
}