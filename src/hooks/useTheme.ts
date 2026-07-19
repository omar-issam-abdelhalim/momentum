import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/db'
import { setTheme as persistTheme } from '@/lib/db/settings.repo'
import { readLocalThemeHint, resolveIsDark, writeLocalThemeHint } from '@/lib/theme/themeStorage'
import type { ThemePreference } from '@/types/models'

export function useTheme(): { theme: ThemePreference; setTheme: (t: ThemePreference) => void } {
  // Plain read only — liveQuery's tracking function must never write, and
  // the settings row is created once, imperatively, by useAppInit.
  const settings = useLiveQuery(() => db.settings.get('app'), [])
  const theme = settings?.theme ?? readLocalThemeHint()

  useEffect(() => {
    const apply = () => {
      document.documentElement.classList.toggle('dark', resolveIsDark(theme))
    }
    apply()

    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])

  const setTheme = (next: ThemePreference) => {
    writeLocalThemeHint(next)
    void persistTheme(next)
  }

  return { theme, setTheme }
}
