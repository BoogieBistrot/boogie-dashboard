/**
 * Boogie Bistrot — Icone centralizzate
 * Tutte le icone usate nella dashboard passano da qui.
 * Per cambiare libreria o singola icona: modifica solo questo file.
 *
 * Libreria: @phosphor-icons/react (variante "light" di default)
 * npm install @phosphor-icons/react
 */

import {
  House,
  CalendarDots,
  Lock,
  CreditCard,
  Users,
  EnvelopeSimple,
  Star,
  CloudSun,
  CurrencyEur,
  Minus,
  PencilSimple,
  Note,
  ArrowCounterClockwise,
  X,
  Check,
  SignOut,
  List,
  ChartBar,
} from '@phosphor-icons/react'
import GoogleIcon from './GoogleIcon.jsx'
import TripAdvisorIcon from './TripAdvisorIcon.jsx'

// Dimensione e peso di default — cambia qui per aggiornare tutto il progetto
const DEFAULT_SIZE = 18
const DEFAULT_WEIGHT = 'light'

function icon(Component, defaultProps = {}) {
  return function Icon({ size = DEFAULT_SIZE, weight = DEFAULT_WEIGHT, ...props }) {
    return <Component size={size} weight={weight} {...defaultProps} {...props} />
  }
}

// — Navigazione
export const IconHome         = icon(House)
export const IconCalendar     = icon(CalendarDots)
export const IconLock         = icon(Lock)
export const IconFidelity     = icon(CreditCard)
export const IconClienti      = icon(Users)
export const IconMarketing    = icon(EnvelopeSimple)

// — Azioni UI
export const IconRefresh      = icon(ArrowCounterClockwise)
export const IconClose        = icon(X)
export const IconCheck        = icon(Check)
export const IconEdit         = icon(PencilSimple)
export const IconLogout       = icon(SignOut)
export const IconMenu         = icon(List)

// — Widgets
export const IconStar         = icon(Star)
export const IconGoogle       = ({ size = DEFAULT_SIZE, color = 'currentColor' }) => <GoogleIcon size={size} color={color} />
export const IconTripAdvisor  = ({ size = DEFAULT_SIZE, color = 'currentColor' }) => <TripAdvisorIcon size={size} color={color} />
export const IconWeather      = icon(CloudSun)
export const IconNote         = icon(Note)

// — Fidelity tabs
export const IconPuntiAdd     = icon(CurrencyEur)
export const IconPuntiRemove  = icon(Minus)

// — Analytics
export const IconAnalytics    = icon(ChartBar)

// — Agenda
export { CalendarDots as IconAgenda } from '@phosphor-icons/react'