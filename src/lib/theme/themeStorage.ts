import type { ThemePreference } from '@/types/models'

/**
 * Theme is persisted in two places on purpose:
 *  - IndexedDB (AppSettings.theme) is the source of truth and travels with
 *    backup/export.
 *  - localStorage holds a small mirror so the pre-paint inline script in
 *    index.html can avoid a flash of the wrong theme — IndexedDB reads are
 *    always async and can't run before first paint.
 */
const KEY = 'momentum-theme'

export function readLocalThemeHint(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === '"light"' || raw === '"dark"' || raw === '"system"') return JSON.parse(raw)
    return 'system'
  } catch {
    return 'system'
  }
}

export function writeLocalThemeHint(theme: ThemePreference): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(theme))
  } catch {
    // Ignore storage failures (private browsing, quota) — Dexie remains the source of truth.
  }
}

export function resolveIsDark(theme: ThemePreference): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
