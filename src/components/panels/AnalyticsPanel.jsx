import { useState } from 'react'
import { useAnalytics } from '../../hooks/useAnalytics'
import { IconAnalytics } from '../../icons/index.jsx'
import styles from './AnalyticsPanel.module.css'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const GIORNI_KEYS = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica']
const PIE_COLORS = ['var(--accent)', 'var(--text2)', 'var(--text3)']

function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0 }
function sum(arr) { return arr.reduce((a, b) => a + b, 0) }
function mode(arr) {
  const freq = {}
  arr.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
}

function formatWeekLabel(s) {
  if (!s) return ''
  if (!s.dataInizio) return s.settimana
  const fmt = d => { const [, m, g] = d.split('-'); return `${g}/${m}` }
  return `${fmt(s.dataInizio)} – ${fmt(s.dataFine)}`
}

function TrendBadge({ value }) {
  if (value == null || isNaN(value)) return null
  const up = value >= 0
  return (
    <span className={`${styles.trendBadge} ${up ? styles.trendUp : styles.trendDown}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

function KpiCard({ label, value, sub, trend }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiValueRow}>
        <div className={styles.kpiValue}>{value ?? '—'}</div>
        {trend != null && <TrendBadge value={trend} />}
      </div>
      <div className={styles.kpiLabel}>{label}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

function BarChart({ items, maxVal }) {
  const max = maxVal ?? Math.max(...items.filter(i => !i.closed).map(i => i.value), 1)
  return (
    <div className={styles.barChart}>
      {items.map(({ label, value, accent, closed }) => (
        <div key={label} className={`${styles.barRow} ${closed ? styles.barRowClosed : ''}`}>
          <div className={styles.barLabel}>{label}</div>
          <div className={styles.barTrack}>
            {!closed && (
              <div
                className={`${styles.barFill} ${accent ? styles.barAccent : ''}`}
                style={{ width: `${Math.round((value / max) * 100)}%` }}
              />
            )}
          </div>
          <div className={styles.barValue}>{closed ? 'chiuso' : value}</div>
        </div>
      ))}
    </div>
  )
}

function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(cx, cy, r, start, end) {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

function PieChart({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total === 0) return <div className={styles.emptyChart}>Nessun dato</div>
  const cx = 70, cy = 70, r = 60
  let cursor = 0
  const slices = items.map((item, i) => {
    const angle = (item.value / total) * 360
    const path = slicePath(cx, cy, r, cursor, cursor + angle - 0.5)
    cursor += angle
    return { ...item, path, color: PIE_COLORS[i] }
  })
  return (
    <div className={styles.pieWrap}>
      <svg viewBox="0 0 140 140" className={styles.pieSvg}>
        {slices.map(slice => (
          <path key={slice.label} d={slice.path} fill={slice.color} opacity="0.9" />
        ))}
        <circle cx={cx} cy={cy} r={32} fill="var(--bg2)" />
      </svg>
      <div className={styles.pieLegend}>
        {slices.map(slice => (
          <div key={slice.label} className={styles.pieLegendItem}>
            <span className={styles.pieDot} style={{ background: slice.color }} />
            <span className={styles.pieLegendLabel}>{slice.label}</span>
            <span className={styles.pieLegendPct}>{Math.round(slice.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ settimane }) {
  const data = [...settimane].reverse()
  const W = 500, H = 120, padL = 36, padR = 12, padT = 16, padB = 28
  const vals = data.map(s => s.prenotazioni)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const xStep = (W - padL - padR) / Math.max(data.length - 1, 1)
  function xPos(i) { return padL + i * xStep }
  function yPos(v) { return padT + (1 - (v - minV) / range) * (H - padT - padB) }
  const points = data.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.prenotazioni).toFixed(1)}`).join(' ')
  const areaPoints = [
    `${xPos(0).toFixed(1)},${(H - padB).toFixed(1)}`,
    ...data.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.prenotazioni).toFixed(1)}`),
    `${xPos(data.length - 1).toFixed(1)},${(H - padB).toFixed(1)}`,
  ].join(' ')
  const gridVals = [minV, Math.round((minV + maxV) / 2), maxV]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.lineSvg} preserveAspectRatio="xMidYMid meet">
      {gridVals.map(v => (
        <g key={v}>
          <line x1={padL} y1={yPos(v).toFixed(1)} x2={W - padR} y2={yPos(v).toFixed(1)} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 4} y={yPos(v) + 4} textAnchor="end" fontSize="9" fill="var(--text3)">{v}</text>
        </g>
      ))}
      <polygon points={areaPoints} fill="var(--accent)" opacity="0.08" />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((s, i) => (
        <g key={s.settimana}>
          <circle cx={xPos(i)} cy={yPos(s.prenotazioni)} r="3.5" fill="var(--accent)" />
          <text x={xPos(i)} y={H - padB + 12} textAnchor="middle" fontSize="8.5" fill="var(--text3)">
            {formatWeekLabel(s).split('–')[0].trim()}
          </text>
        </g>
      ))}
    </svg>
  )
}

function AnalisiAI({ testo, titolo }) {
  if (!testo) return null

  const parseSection = (text, emoji) => {
    const match = text.match(new RegExp(`${emoji}[^\\n]*\\n([\\s\\S]*?)(?=✅|⚠️|💡|$)`))
    return (match?.[1] || '').trim().split('\n').filter(Boolean)
  }

  const pro  = parseSection(testo, '✅')
  const crit = parseSection(testo, '⚠️')
  const opp  = parseSection(testo, '💡')

  return (
    <div className={styles.analisiAi}>
      <div className={styles.analisiAiHeader}>
        <span className={styles.analisiAiIcon}>✦</span>
        <span className={styles.analisiAiTitolo}>{titolo || 'Analisi AI'}</span>
      </div>
      <div className={styles.analisiAiBoxes}>
        <div className={`${styles.analisiBox} ${styles.analisiBoxPro}`}>
          <div className={styles.analisiBoxTitle}>✅ PRO</div>
          <ul className={styles.analisiBoxList}>
            {pro.map((r, i) => <li key={i}>{r.replace(/^•\s*/, '')}</li>)}
          </ul>
        </div>
        <div className={`${styles.analisiBox} ${styles.analisiBoxCrit}`}>
          <div className={styles.analisiBoxTitle}>⚠️ CRITICITÀ</div>
          <ul className={styles.analisiBoxList}>
            {crit.map((r, i) => <li key={i}>{r.replace(/^•\s*/, '')}</li>)}
          </ul>
        </div>
        <div className={`${styles.analisiBox} ${styles.analisiBoxOpp}`}>
          <div className={styles.analisiBoxTitle}>💡 OPPORTUNITÀ & AZIONI</div>
          <div className={styles.analisiBoxActions}>
            {opp.map((r, i) => {
              const colonIdx = r.indexOf(':')
              const label = colonIdx > -1 ? r.slice(0, colonIdx) : r
              const value = colonIdx > -1 ? r.slice(colonIdx + 1).trim() : ''
              return (
                <div key={i} className={styles.analisiBoxAction}>
                  <span className={styles.analisiBoxActionLabel}>{label}</span>
                  {value && <span>{value}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function InsightChip({ label, value }) {
  return (
    <div className={styles.insightChip}>
      <div className={styles.insightLabel}>{label}</div>
      <div className={styles.insightValue}>{value || '—'}</div>
    </div>
  )
}

function vsMedia(value, media) {
  if (!media || media === 0) return null
  return Math.round((value - media) / media * 1000) / 10
}

// — Vista settimana singola
const GIORNI_NOME_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
// Mappa da nome abbreviato (Mon-first) al nome completo
const GIORNI_TO_NOME = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

function VistaSettimana({ s, medie }) {
  const chiusiSet = new Set(s.giorniChiusi ? s.giorniChiusi.split(', ') : [])
  const totaleCoperti = s.copertipranzo + s.copertiAperitivo + s.copertiCena
  const fasceBarre = [
    { label: 'Pranzo',    value: s.copertipranzo },
    { label: 'Aperitivo', value: s.copertiAperitivo },
    { label: 'Cena',      value: s.copertiCena, accent: true },
  ]
  const giorniBarre = GIORNI.map((label, i) => ({
    label,
    value: s[GIORNI_KEYS[i]],
    closed: chiusiSet.has(GIORNI_TO_NOME[i]),
  }))
  const canaliPie = [
    { label: 'Sito web',  value: s.prenotazioniSito },
    { label: 'Telefono',  value: s.prenotazioniTel },
  ]
  const fmt = d => { const [, m, g] = d.split('-'); return `${g}/${m}` }
  const periodoLabel = s.dataInizio
    ? `Settimana dal ${fmt(s.dataInizio)} al ${fmt(s.dataFine)}`
    : s.settimana

  return (
    <>
      <div className={styles.periodoLabel}>{periodoLabel}</div>
      <AnalisiAI testo={s.analisiAi} titolo="Analisi della settimana" />
      <div className={styles.kpiGrid}>
        <KpiCard label="Prenotazioni"      value={s.prenotazioni} trend={vsMedia(s.prenotazioni, medie?.prenotazioni)} />
        <KpiCard label="Coperti totali"    value={s.persone} trend={vsMedia(s.persone, medie?.persone)} />
        <KpiCard label="Cancellazioni"     value={`${s.tassoCancellazione}%`} sub={`${s.cancellazioni} tot.`} />
        <KpiCard label="Anticipo medio prenotazione" value={`${s.leadTime}g`} sub="giorni prima dell'arrivo" />
        <KpiCard label="Dim. media gruppo" value={s.dimGruppo} sub="persone" />
        <KpiCard label="Clienti unici"     value={s.clientiUnici} sub={s.clientiDiRitorno > 0 ? `${s.clientiDiRitorno} di ritorno` : undefined} />
      </div>
      <div className={`${styles.card} ${styles.cardFullWidth}`}>
        <div className={styles.cardTitle}>Insights settimana</div>
        <div className={styles.insightsGrid}>
          <InsightChip label="Giorno più pieno"      value={s.giornopiuPieno} />
          <InsightChip label="Giorno più vuoto"      value={s.giornopiuVuoto} />
          <InsightChip label="Slot più richiesto"    value={s.slotPiu} />
          <InsightChip label="Slot meno richiesto"   value={s.slotMeno} />
          <InsightChip label="Fascia meno richiesta" value={s.fasciaMenoRichiesta} />
          <InsightChip label="Last minute"           value={`${s.lastMinute} pren.`} />
        </div>
      </div>
      <div className={styles.chartsGrid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Coperti per fascia</div>
          <BarChart items={fasceBarre} />
          {totaleCoperti > 0 && (
            <div className={styles.cardFooter}>
              {fasceBarre.map(f => (
                <span key={f.label} className={styles.pct}>{f.label} {Math.round(f.value / totaleCoperti * 100)}%</span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Prenotazioni Lun–Dom</div>
          <BarChart items={giorniBarre} />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Canale di prenotazione</div>
          <PieChart items={canaliPie} />
        </div>
      </div>
    </>
  )
}

// — Vista globale con medie
function VistaGlobale({ settimane }) {
  const n = settimane.length

  const mediaPrenotazioni = avg(settimane.map(s => s.prenotazioni))
  const mediaCoperti      = avg(settimane.map(s => s.persone))
  const mediaCancellaz    = avg(settimane.map(s => s.tassoCancellazione))
  const mediaLeadTime     = avg(settimane.map(s => s.leadTime))
  const mediaDimGruppo    = avg(settimane.map(s => s.dimGruppo))
  const mediaClienti        = avg(settimane.map(s => s.clientiUnici))
  const mediaClientiRitorno = avg(settimane.map(s => s.clientiDiRitorno))

  const totPrenSito = sum(settimane.map(s => s.prenotazioniSito))
  const totPrenTel  = sum(settimane.map(s => s.prenotazioniTel))
  const totEventi   = sum(settimane.map(s => s.prenotazioniEventi))

  const totPranzo    = sum(settimane.map(s => s.copertipranzo))
  const totAperitivo = sum(settimane.map(s => s.copertiAperitivo))
  const totCena      = sum(settimane.map(s => s.copertiCena))
  const totCoperti   = totPranzo + totAperitivo + totCena

  // Media per giorno ponderata: esclude le settimane in cui quel giorno era chiuso
  const mediaGiorni = GIORNI.map((label, i) => {
    const nomeCompleto = GIORNI_TO_NOME[i]
    const settimaneAperte = settimane.filter(s => !s.giorniChiusi?.split(', ').includes(nomeCompleto))
    return {
      label,
      value: avg(settimaneAperte.map(s => s[GIORNI_KEYS[i]])),
    }
  })

  // Normalizza il giorno rimuovendo eventuale festività tra parentesi per il mode
  const normalizzaGiorno = v => v ? v.replace(/\s*\(.*\)/, '').trim() : v
  const giornoFrequente     = mode(settimane.map(s => normalizzaGiorno(s.giornopiuPieno)))
  const giornoVuoto         = mode(settimane.map(s => normalizzaGiorno(s.giornopiuVuoto)))
  const slotFrequente       = mode(settimane.map(s => s.slotPiu))
  const fasciaPocoRichiesta = mode(settimane.map(s => s.fasciaMenoRichiesta))
  const mediaLastMinute     = avg(settimane.map(s => s.lastMinute))

  const canaliPie = [
    { label: 'Sito web',  value: totPrenSito },
    { label: 'Telefono',  value: totPrenTel },
  ]
  const fasceBarre = [
    { label: 'Pranzo',    value: totPranzo },
    { label: 'Aperitivo', value: totAperitivo },
    { label: 'Cena',      value: totCena, accent: true },
  ]

  return (
    <>
      <div className={styles.globaleNote}>
        Media su <strong>{n} settimane</strong> di dati raccolti
      </div>
      <AnalisiAI testo={settimane[0]?.analisiAiGlobale} titolo="Analisi globale" />
      <div className={styles.kpiGrid}>
        <KpiCard label="Media pren./settimana"   value={mediaPrenotazioni} />
        <KpiCard label="Media coperti/settimana" value={mediaCoperti} />
        <KpiCard label="Tasso cancellazione"     value={`${mediaCancellaz}%`} sub="media" />
        <KpiCard label="Anticipo medio prenotazione" value={`${mediaLeadTime}g`} sub="giorni prima dell'arrivo" />
        <KpiCard label="Dim. media gruppo"       value={mediaDimGruppo} sub="persone" />
        <KpiCard label="Clienti unici/sett."     value={mediaClienti} sub={mediaClientiRitorno > 0 ? `media ${mediaClientiRitorno} di ritorno` : undefined} />
      </div>
      <div className={`${styles.card} ${styles.cardFullWidth}`}>
        <div className={styles.cardTitle}>Pattern ricorrenti</div>
        <div className={styles.insightsGrid}>
          <InsightChip label="Giorno più pieno (freq.)"   value={giornoFrequente} />
          <InsightChip label="Giorno più vuoto (freq.)"   value={giornoVuoto} />
          <InsightChip label="Slot più richiesto (freq.)" value={slotFrequente} />
          <InsightChip label="Fascia meno richiesta"      value={fasciaPocoRichiesta} />
          <InsightChip label="Media last minute/sett."    value={`${mediaLastMinute} pren.`} />
        </div>
      </div>
      <div className={styles.chartsGrid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Coperti per fascia — totale</div>
          <BarChart items={fasceBarre} />
          {totCoperti > 0 && (
            <div className={styles.cardFooter}>
              {fasceBarre.map(f => (
                <span key={f.label} className={styles.pct}>{f.label} {Math.round(f.value / totCoperti * 100)}%</span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Media prenotazioni per giorno</div>
          <BarChart items={mediaGiorni} />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Canale di prenotazione — totale</div>
          <PieChart items={canaliPie} />
        </div>
      </div>
      {settimane.length > 1 && (
        <div className={`${styles.card} ${styles.cardFullWidth}`}>
          <div className={styles.cardTitle}>Trend prenotazioni — ultime {settimane.length} settimane</div>
          <LineChart settimane={settimane} />
        </div>
      )}
    </>
  )
}

export default function AnalyticsPanel() {
  const { settimane, loading } = useAnalytics()
  const [vista, setVista] = useState('settimana')
  const [idx, setIdx] = useState(0)

  const s = settimane[Math.min(idx, settimane.length - 1)] || null
  const medie = settimane.length > 1 ? {
    prenotazioni: avg(settimane.map(s => s.prenotazioni)),
    persone:      avg(settimane.map(s => s.persone)),
  } : null

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelTitle}>
          <IconAnalytics size={20} />
          Analytics
        </h1>
        <div className={styles.headerRight}>
          {vista === 'settimana' && settimane.length > 0 && (
            <select
              className={styles.weekSelect}
              value={idx}
              onChange={e => setIdx(Number(e.target.value))}
            >
              {settimane.map((s, i) => (
                <option key={s.settimana} value={i}>
                  {i === 0 ? `Ultima (${formatWeekLabel(s)})` : formatWeekLabel(s)}
                </option>
              ))}
            </select>
          )}
          {settimane.length > 0 && (
            <div className={styles.vistaToggle}>
              <button
                className={`${styles.vistaBtn} ${vista === 'settimana' ? styles.vistaBtnActive : ''}`}
                onClick={() => setVista('settimana')}
              >
                Settimana
              </button>
              <button
                className={`${styles.vistaBtn} ${vista === 'globale' ? styles.vistaBtnActive : ''}`}
                onClick={() => setVista('globale')}
              >
                Globale
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && <div className={styles.loading}>Caricamento statistiche...</div>}

      {!loading && settimane.length === 0 && (
        <div className={styles.empty}>Nessuna statistica disponibile. Le statistiche vengono calcolate ogni domenica sera.</div>
      )}

      {!loading && settimane.length > 0 && (
        <div className={styles.body}>
          {vista === 'settimana' && s && <VistaSettimana s={s} medie={medie} />}
          {vista === 'globale' && <VistaGlobale settimane={settimane} />}
        </div>
      )}
    </div>
  )
}
