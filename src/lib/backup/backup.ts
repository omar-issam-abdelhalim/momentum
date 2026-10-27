import { db } from '@/lib/db/db'
import { createId } from '@/lib/id'
import { APP_CONFIG } from '@/config/app.config'
import type { AppSettings, BackupFile, Goal, Habit, HabitCompletion, RecurringDefinition, WeeklySnapshot } from '@/types/models'

const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4]

export async function buildBackup(): Promise<BackupFile> {
  const [goals, recurringDefinitions, habits, habitCompletions, weeklySnapshots, settings] = await Promise.all([
    db.goals.toArray(),
    db.recurringDefinitions.toArray(),
    db.habits.toArray(),
    db.habitCompletions.toArray(),
    db.weeklySnapshots.toArray(),
    db.settings.toArray(),
  ])

  return {
    schemaVersion: APP_CONFIG.schemaVersion,
    exportedAt: Date.now(),
    appVersion: APP_CONFIG.version,
    data: { goals, recurringDefinitions, habits, habitCompletions, weeklySnapshots, settings },
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

// --- v1 (legacy) shapes ---------------------------------------------------

const isLegacyGoal = (v: unknown): boolean =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  (v.type === 'daily' || v.type === 'weekly') &&
  typeof v.createdAt === 'number' &&
  typeof v.completed === 'boolean' &&
  typeof v.originalWeekId === 'string' &&
  typeof v.currentWeekId === 'string'

const isLegacyWeeklySnapshot = (v: unknown): boolean =>
  isPlainObject(v) && typeof v.weekId === 'string' && typeof v.totalPlanned === 'number'

// --- v2 (current) shapes ---------------------------------------------------

const isGoal = (v: unknown): v is Goal =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  (v.kind === 'scheduled' || v.kind === 'weekly' || v.kind === 'today' || v.kind === 'recurring') &&
  typeof v.createdAt === 'number' &&
  typeof v.completed === 'boolean'

const isRecurringDefinition = (v: unknown): v is RecurringDefinition =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  (v.recurrenceType === 'daily' || v.recurrenceType === 'weekly') &&
  typeof v.active === 'boolean'

const isWeeklySnapshot = (v: unknown): v is WeeklySnapshot =>
  isPlainObject(v) && typeof v.weekId === 'string' && typeof v.weeklyPlanned === 'number'

// --- shared shapes ----------------------------------------------------------

/** Pre-v3 habit shape: `active: boolean`, no status/epochs yet. */
const isLegacyHabit = (v: unknown): boolean =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  (v.frequency === 'daily' || v.frequency === 'weekly') &&
  typeof v.active === 'boolean'

const isHabit = (v: unknown): v is Habit =>
  isPlainObject(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  (v.frequency === 'daily' || v.frequency === 'weekly') &&
  (v.status === 'active' || v.status === 'paused') &&
  Array.isArray(v.epochs)

const isHabitCompletion = (v: unknown): v is HabitCompletion =>
  isPlainObject(v) && typeof v.id === 'string' && typeof v.habitId === 'string' && typeof v.periodId === 'string'

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
  if (typeof raw.schemaVersion === 'number' && !SUPPORTED_SCHEMA_VERSIONS.includes(raw.schemaVersion)) {
    errors.push(`Unsupported backup schema version: ${raw.schemaVersion}.`)
    return { valid: false, errors }
  }

  const data = raw.data
  const isLegacy = raw.schemaVersion === 1
  const habitsAreLegacy = (raw.schemaVersion as number) < 3

  if (!isArrayOf(data.goals, isLegacy ? isLegacyGoal : isGoal)) errors.push('goals data is missing or malformed.')
  if (!isLegacy && data.recurringDefinitions !== undefined && !isArrayOf(data.recurringDefinitions, isRecurringDefinition)) {
    errors.push('recurringDefinitions data is malformed.')
  }
  if (!isArrayOf(data.habits, habitsAreLegacy ? isLegacyHabit : isHabit)) errors.push('habits data is missing or malformed.')
  if (!isArrayOf(data.habitCompletions, isHabitCompletion)) errors.push('habitCompletions data is missing or malformed.')
  if (!isArrayOf(data.weeklySnapshots, isLegacy ? isLegacyWeeklySnapshot : isWeeklySnapshot)) {
    errors.push('weeklySnapshots data is missing or malformed.')
  }
  if (!isArrayOf(data.settings, isSettings)) errors.push('settings data is missing or malformed.')

  return { valid: errors.length === 0, errors }
}

// --- migration from v1 -> current -----------------------------------------

function migrateLegacyGoal(raw: Record<string, unknown>): Goal {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: raw.description as string | undefined,
    kind: raw.type === 'weekly' ? 'weekly' : 'today',
    scheduledDateISO: raw.dateISO as string | undefined,
    deadlineISO: raw.deadlineISO as string | undefined,
    priority: raw.priority as Goal['priority'],
    createdAt: raw.createdAt as number,
    completedAt: (raw.completedAt as number | null) ?? null,
    completed: raw.completed as boolean,
    originalWeekId: raw.originalWeekId as string | undefined,
    currentWeekId: raw.currentWeekId as string | undefined,
    rolledOver: (raw.rolledOver as boolean) ?? false,
    rolloverCount: (raw.rolloverCount as number) ?? 0,
    archived: (raw.archived as boolean) ?? false,
  }
}

function migrateLegacySnapshot(raw: Record<string, unknown>): WeeklySnapshot {
  const totalPlanned = (raw.totalPlanned as number) ?? 0
  const completed = (raw.completed as number) ?? 0
  const rolledOver = (raw.rolledOver as number) ?? 0
  const completionPct = (raw.completionPct as number) ?? 0
  const withDeadline = (raw.withDeadline as number) ?? 0
  const completedBeforeDeadline = (raw.completedBeforeDeadline as number) ?? 0
  const completedAfterDeadline = (raw.completedAfterDeadline as number) ?? 0
  const dailyGoalsPlanned = (raw.dailyGoalsPlanned as number) ?? 0
  const dailyGoalsCompleted = (raw.dailyGoalsCompleted as number) ?? 0

  return {
    weekId: raw.weekId as string,
    weekStart: raw.weekStart as number,
    weekEnd: raw.weekEnd as number,
    weeklyPlanned: totalPlanned,
    weeklyCompleted: completed,
    weeklyRolledOver: rolledOver,
    weeklyCompletionPct: completionPct,
    scheduledPlanned: 0,
    scheduledCompleted: 0,
    scheduledCompletedLate: 0,
    scheduledLateDaysSum: 0,
    todayOnlyPlanned: dailyGoalsPlanned,
    todayOnlyCompleted: dailyGoalsCompleted,
    todayOnlyMissed: Math.max(0, dailyGoalsPlanned - dailyGoalsCompleted),
    recurringPlanned: 0,
    recurringCompleted: 0,
    recurringCompletedLate: 0,
    recurringLateDaysSum: 0,
    deadlinesDue: withDeadline,
    deadlinesMetOnTime: completedBeforeDeadline,
    deadlinesMetLate: completedAfterDeadline,
    deadlinesMissed: Math.max(0, withDeadline - completedBeforeDeadline - completedAfterDeadline),
    createdAt: (raw.createdAt as number) ?? Date.now(),
  }
}

/**
 * Migrates a pre-v3 habit (`active: boolean`, no status/epochs) to the
 * current shape, using the exact same mapping as the live-database v2->v3
 * Dexie migration in lib/db/db.ts: `active` -> `status`, plus one implicit
 * epoch spanning the habit's history to date. Applied for both v1 and v2
 * backups, since neither ever had status/epochs.
 */
function migrateLegacyHabit(raw: Record<string, unknown>): Habit {
  const wasActive = (raw.active as boolean) ?? true
  const createdAt = (raw.createdAt as number) ?? Date.now()
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    frequency: raw.frequency as Habit['frequency'],
    weekdays: undefined,
    icon: raw.icon as string | undefined,
    order: (raw.order as number) ?? 0,
    status: wasActive ? 'active' : 'paused',
    epochs: [{ id: createId(), startDate: createdAt, endDate: wasActive ? null : createdAt }],
    createdAt,
  }
}

function migrateLegacySettings(raw: Record<string, unknown>): AppSettings {
  return {
    id: 'app',
    theme: raw.theme as AppSettings['theme'],
    lastWeekIdSeen: (raw.lastWeekIdSeen as string | null) ?? null,
    lastCleanupAt: (raw.lastCleanupAt as number | null) ?? null,
    onboarded: (raw.onboarded as boolean) ?? true,
  }
}

/**
 * Migrates a validated backup of any supported schema version to the
 * current in-memory shape, ready for `importBackup`. v1 goals map `type ->
 * kind` using the same rule as the live-database migration (daily -> today,
 * since v1 daily goals never persisted past their day) — see db/db.ts for
 * the full rationale.
 */
export function migrateBackupToLatest(raw: BackupFile): BackupFile {
  if (raw.schemaVersion === 1) {
    const legacyData = raw.data as unknown as {
      goals: Record<string, unknown>[]
      habits: Record<string, unknown>[]
      habitCompletions: HabitCompletion[]
      weeklySnapshots: Record<string, unknown>[]
      settings: Record<string, unknown>[]
    }
    return {
      schemaVersion: APP_CONFIG.schemaVersion,
      exportedAt: raw.exportedAt,
      appVersion: raw.appVersion,
      data: {
        goals: legacyData.goals.map(migrateLegacyGoal),
        recurringDefinitions: [],
        habits: legacyData.habits.map(migrateLegacyHabit),
        habitCompletions: legacyData.habitCompletions,
        weeklySnapshots: legacyData.weeklySnapshots.map(migrateLegacySnapshot),
        settings: legacyData.settings.map(migrateLegacySettings),
      },
    }
  }

  const habitsNeedMigration = raw.schemaVersion < 3
  return {
    ...raw,
    schemaVersion: APP_CONFIG.schemaVersion,
    data: {
      ...raw.data,
      recurringDefinitions: raw.data.recurringDefinitions ?? [],
      habits: habitsNeedMigration
        ? (raw.data.habits as unknown as Record<string, unknown>[]).map(migrateLegacyHabit)
        : raw.data.habits,
    },
  }
}

/** Replaces all local data with the contents of a validated (and migrated) backup. */
export async function importBackup(rawBackup: BackupFile): Promise<void> {
  const backup = migrateBackupToLatest(rawBackup)

  await db.transaction(
    'rw',
    [db.goals, db.recurringDefinitions, db.habits, db.habitCompletions, db.weeklySnapshots, db.settings],
    async () => {
      await Promise.all([
        db.goals.clear(),
        db.recurringDefinitions.clear(),
        db.habits.clear(),
        db.habitCompletions.clear(),
        db.weeklySnapshots.clear(),
        db.settings.clear(),
      ])
      await Promise.all([
        db.goals.bulkAdd(backup.data.goals),
        db.recurringDefinitions.bulkAdd(backup.data.recurringDefinitions),
        db.habits.bulkAdd(backup.data.habits),
        db.habitCompletions.bulkAdd(backup.data.habitCompletions),
        db.weeklySnapshots.bulkAdd(backup.data.weeklySnapshots),
        db.settings.bulkAdd(backup.data.settings),
      ])
    },
  )
}

// --- additive merge ("Add from file") ---------------------------------------

export interface MergeCounts {
  added: number
  skipped: number
}

export interface MergeSummary {
  goals: MergeCounts
  recurringDefinitions: MergeCounts
  habits: MergeCounts
  habitCompletions: MergeCounts
  weeklySnapshots: MergeCounts
}

export interface MergePlan {
  summary: MergeSummary
  toAdd: Omit<BackupFile['data'], 'settings'>
}

type CurrentData = Pick<BackupFile['data'], 'goals' | 'recurringDefinitions' | 'habits' | 'habitCompletions' | 'weeklySnapshots'>

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Human summary of what "Add from file" adds, e.g. "133 tasks, 3 recurring tasks and 2 habits". */
export function describeMergeAdds(summary: MergeSummary): string {
  const parts = [
    summary.goals.added && plural(summary.goals.added, 'task'),
    summary.recurringDefinitions.added && plural(summary.recurringDefinitions.added, 'recurring task'),
    summary.habits.added && plural(summary.habits.added, 'habit'),
    summary.habitCompletions.added && plural(summary.habitCompletions.added, 'habit check-in'),
    summary.weeklySnapshots.added && plural(summary.weeklySnapshots.added, 'week of analytics'),
  ].filter(Boolean) as string[]
  if (parts.length <= 1) return parts[0] ?? 'nothing'
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Total records a merge would add — 0 means the file brings nothing new. */
export function mergeAddedTotal(summary: MergeSummary): number {
  return Object.values(summary).reduce((sum, c) => sum + c.added, 0)
}

/**
 * Pure: decides what an additive merge of `incoming` into `current` would add.
 * Nothing already present is ever changed or removed:
 *   - goals, recurring definitions, habits: added only if their id is new.
 *   - habit completions: added only if their id is new, no completion already
 *     exists for the same habit + period, and their habit exists after the merge.
 *   - weekly snapshots: added only for weeks that have no snapshot yet, so a
 *     week's analytics are never counted twice.
 *   - settings: never touched (theme, rollover cursor, onboarding stay as they are).
 * New habits are appended after existing ones, keeping their relative order.
 * `incoming` must already be validated; it is migrated to the current schema here.
 */
export function planBackupMerge(current: CurrentData, incoming: BackupFile): MergePlan {
  const data = migrateBackupToLatest(incoming).data

  const byNewId = <T extends { id: string }>(existing: T[], items: T[]) => {
    const ids = new Set(existing.map((r) => r.id))
    const fresh: T[] = []
    for (const item of items) {
      if (ids.has(item.id)) continue
      ids.add(item.id)
      fresh.push(item)
    }
    return { fresh, counts: { added: fresh.length, skipped: items.length - fresh.length } }
  }

  const goals = byNewId(current.goals, data.goals)
  const recurring = byNewId(current.recurringDefinitions, data.recurringDefinitions)
  const habits = byNewId(current.habits, data.habits)

  const maxOrder = current.habits.reduce((m, h) => Math.max(m, h.order), -1)
  const newHabits = [...habits.fresh]
    .sort((a, b) => a.order - b.order)
    .map((h, i) => ({ ...h, order: maxOrder + 1 + i }))

  const habitIds = new Set([...current.habits, ...newHabits].map((h) => h.id))
  const completionIds = new Set(current.habitCompletions.map((c) => c.id))
  const completionPeriods = new Set(current.habitCompletions.map((c) => `${c.habitId}|${c.periodId}`))
  const newCompletions: HabitCompletion[] = []
  for (const c of data.habitCompletions) {
    const period = `${c.habitId}|${c.periodId}`
    if (completionIds.has(c.id) || completionPeriods.has(period) || !habitIds.has(c.habitId)) continue
    completionIds.add(c.id)
    completionPeriods.add(period)
    newCompletions.push(c)
  }

  const snapshotWeeks = new Set(current.weeklySnapshots.map((s) => s.weekId))
  const newSnapshots: WeeklySnapshot[] = []
  for (const s of data.weeklySnapshots) {
    if (snapshotWeeks.has(s.weekId)) continue
    snapshotWeeks.add(s.weekId)
    newSnapshots.push(s)
  }

  return {
    toAdd: {
      goals: goals.fresh,
      recurringDefinitions: recurring.fresh,
      habits: newHabits,
      habitCompletions: newCompletions,
      weeklySnapshots: newSnapshots,
    },
    summary: {
      goals: goals.counts,
      recurringDefinitions: recurring.counts,
      habits: habits.counts,
      habitCompletions: { added: newCompletions.length, skipped: data.habitCompletions.length - newCompletions.length },
      weeklySnapshots: { added: newSnapshots.length, skipped: data.weeklySnapshots.length - newSnapshots.length },
    },
  }
}

async function readCurrentData(): Promise<CurrentData> {
  const [goals, recurringDefinitions, habits, habitCompletions, weeklySnapshots] = await Promise.all([
    db.goals.toArray(),
    db.recurringDefinitions.toArray(),
    db.habits.toArray(),
    db.habitCompletions.toArray(),
    db.weeklySnapshots.toArray(),
  ])
  return { goals, recurringDefinitions, habits, habitCompletions, weeklySnapshots }
}

/** What "Add from file" would do with this validated backup, without writing anything. */
export async function previewBackupMerge(rawBackup: BackupFile): Promise<MergeSummary> {
  return planBackupMerge(await readCurrentData(), rawBackup).summary
}

/**
 * Adds a validated backup's records to the local data without removing or
 * changing anything already stored (see planBackupMerge for the rules).
 * Planned and written inside one transaction, so it is atomic and running it
 * twice with the same file adds nothing the second time.
 */
export async function mergeBackup(rawBackup: BackupFile): Promise<MergeSummary> {
  return db.transaction(
    'rw',
    [db.goals, db.recurringDefinitions, db.habits, db.habitCompletions, db.weeklySnapshots],
    async () => {
      const { toAdd, summary } = planBackupMerge(await readCurrentData(), rawBackup)
      await Promise.all([
        db.goals.bulkAdd(toAdd.goals),
        db.recurringDefinitions.bulkAdd(toAdd.recurringDefinitions),
        db.habits.bulkAdd(toAdd.habits),
        db.habitCompletions.bulkAdd(toAdd.habitCompletions),
        db.weeklySnapshots.bulkAdd(toAdd.weeklySnapshots),
      ])
      return summary
    },
  )
}
