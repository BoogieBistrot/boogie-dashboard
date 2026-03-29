import { useState, useEffect } from 'react'

const LAT = 45.7833
const LON = 9.3667
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=temperature_2m,weathercode,windspeed_10m&timezone=Europe/Rome&forecast_days=5`

export function icona(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code <= 3) return '☁️'
  if (code <= 49) return '🌫'
  if (code <= 59) return '🌦'
  if (code <= 69) return '🌧'
  if (code <= 79) return '🌨'
  if (code <= 82) return '🌧'
  if (code <= 84) return '🌨'
  if (code <= 99) return '⛈'
  return '🌡'
}

export function useMeteo() {
  const [dati, setDati] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(json => {
        const { daily, hourly } = json

        function getHourlyIdx(dateStr, hour) {
          const target = `${dateStr}T${String(hour).padStart(2, '0')}:00`
          return hourly.time.indexOf(target)
        }

        const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
        const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

        const previsioni = daily.time.map((dateStr, i) => {
          const data = new Date(dateStr + 'T12:00:00')
          const idxMat = getHourlyIdx(dateStr, 9)
          const idxPom = getHourlyIdx(dateStr, 14)
          const idxSer = getHourlyIdx(dateStr, 19)

          function fascia(idx) {
            if (idx < 0) return null
            return {
              t: Math.round(hourly.temperature_2m[idx]),
              c: hourly.weathercode[idx],
              w: Math.round(hourly.windspeed_10m[idx]),
            }
          }

          return {
            dateStr,
            label: i === 0 ? 'Oggi' : giorni[data.getDay()],
            giorno: data.getDate(),
            mese: mesi[data.getMonth()],
            codice: daily.weathercode[i],
            tMax: Math.round(daily.temperature_2m_max[i]),
            tMin: Math.round(daily.temperature_2m_min[i]),
            pioggia: daily.precipitation_sum[i],
            fasce: {
              mat: fascia(idxMat),
              pom: fascia(idxPom),
              ser: fascia(idxSer),
            }
          }
        })

        setDati(previsioni)
        setLoading(false)
      })
      .catch(err => {
        console.error('Meteo error:', err)
        setError(err)
        setLoading(false)
      })
  }, [])

  return { dati, loading, error }
}