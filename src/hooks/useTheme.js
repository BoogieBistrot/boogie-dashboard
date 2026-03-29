import { useEffect } from 'react'

export function useTheme() {
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme')
  }, [])

  // Tema fisso chiaro — nessun toggle
  return { theme: 'light', toggle: () => {} }
}
