import { db } from '@/lib/db/db'
import { APP_CONFIG } from '@/config/app.config'
import type { AppSettings, BackupFile, Goal, Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'

export async function buildBackup(): Promise<BackupFile> {
  const [goals, habits, habitCompletions, weeklySnapshots, settings] = await Promise.all([
    db.goals.toArray(),
    db.habits.toArray(),
    db.habitCompletions.toArray(),
    db.weeklySnapshots.toArray(),
    db.settings.toArray(),
  ])

  return {
    schemaVersion: APP_CONFIG.schemaVersion,
    exportedAt: Date.now(),
    appVersion: APP_CONFIG.version,
    data: { goals, habits, habitCompletions, weeklySnapshots, settings },
  }
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date(backup.exportedAt).toISOString().slice(0, 10)
  a.href = url
  a.download = `${APP_CONFIG.name.toLowerCase()}-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArrayOf(v: unknown, check: (item: unknown) => boolean): v is unknown[] {
  return Array.isArray(v) && v.every(check)
}

const isGoal = (v: unknown): v is Goal =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  (v.type === 'daily' || v.type === 'weekly') &&
  typeof v.createdAt === 'number' &&
  typeof v.completed === 'boolean' &&
  typeof v.originalWeekId === 'string' &&
  typeof v.currentWeekId === 'string'

const isHabit = (v: unknown): v is Habit =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  (v.frequency === 'daily' || v.frequency === 'weekly') &&
  typeof v.active === 'boolean'

const isHabitCompletion = (v: unknown): v is HabitCompletion =>
  isPlainObject(v) && typeof v.id === 'string' && typeof v.habitId === 'string' && typeof v.periodId === 'string'

const isWeeklySnapshot = (v: unknown): v is WeeklySnapshot =>
  isPlainObject(v) && typeof v.weekId === 'string' && typeof v.totalPlanned === 'number'

const isSettings = (v: unknown): v is AppSettings =>
  isPlainObject(v) && v.id === 'app' && (v.theme === 'light' || v.theme === 'dark' || v.theme === 'system')

export function validateBackupFile(raw: unknown): ValidationResult {
  const errors: string[] = []

  if (!isPlainObject(raw)) {
    return { valid: false, errors: ['File is not a valid JSON object.'] }
  }
  if (typeof raw.schemaVersion !== 'number') errors.push('Missing or invalid schemaVersion.')
  if (typeof raw.exportedAt !== 'number') errors.push('Missing or invalid exportedAt.')
  if (!isPlainObject(raw.data)) {
    errors.push('Missing data section.')
    return { valid: false, errors }
  }

  const data = raw.data
  if (!isArrayOf(data.goals, isGoal)) errors.push('goals data is missing or malformed.')
  if (!isArrayOf(data.habits, isHabit)) errors.push('habits data is missing or malformed.')
  if (!isArrayOf(data.habitCompletions, isHabitCompletion)) errors.push('habitCompletions data is missing or malformed.')
  if (!isArrayOf(data.weeklySnapshots, isWeeklySnapshot)) errors.push('weeklySnapshots data is missing or malformed.')
  if (!isArrayOf(data.settings, isSettings)) errors.push('settings data is missing or malformed.')

  return { valid: errors.length === 0, errors }
}

/** Replaces all local data with the contents of a validated backup. */
export async function importBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.goals, db.habits, db.habitCompletions, db.weeklySnapshots, db.settings, async () => {
    await Promise.all([
      db.goals.clear(),
      db.habits.clear(),
      db.habitCompletions.clear(),
      db.weeklySnapshots.clear(),
      db.settings.clear(),
    ])
    await Promise.all([
      db.goals.bulkAdd(backup.data.goals),
      db.habits.bulkAdd(backup.data.habits),
      db.habitCompletions.bulkAdd(backup.data.habitCompletions),
      db.weeklySnapshots.bulkAdd(backup.data.weeklySnapshots),
      db.settings.bulkAdd(backup.data.settings),
    ])
  })
}
