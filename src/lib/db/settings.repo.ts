import { db, initSettings } from './db'
import type { AppSettings, ThemePreference } from '@/types/models'

export async function getSettings(): Promise<AppSettings> {
  return initSettings()
}

export async function setTheme(theme: ThemePreference): Promise<void> {
  await db.settings.update('app', { theme })
}

export async function setLastWeekIdSeen(weekId: string): Promise<void> {
  await db.settings.update('app', { lastWeekIdSeen: weekId })
}

export async function setLastCleanupAt(ts: number): Promise<void> {
  await db.settings.update('app', { lastCleanupAt: ts })
}

export async function setOnboarded(): Promise<void> {
  await db.settings.update('app', { onboarded: true })
}
