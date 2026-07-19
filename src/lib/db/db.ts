import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, Goal, Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'

export class MomentumDB extends Dexie {
  goals!: EntityTable<Goal, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitCompletions!: EntityTable<HabitCompletion, 'id'>
  weeklySnapshots!: EntityTable<WeeklySnapshot, 'weekId'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('momentum-db')

    // Note: IndexedDB keys cannot be booleans, so boolean fields (completed,
    // archived, active, rolledOver) are intentionally left out of the index
    // list below and filtered in JS after a keyed query instead.
    this.version(1).stores({
      goals: 'id, type, currentWeekId, originalWeekId, dateISO, deadlineISO, createdAt',
      habits: 'id, frequency, order',
      habitCompletions: 'id, habitId, periodId, [habitId+periodId], completedAt',
      weeklySnapshots: 'weekId, weekStart',
      settings: 'id',
    })
  }
}

export const db = new MomentumDB()

export async function initSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app')
  if (existing) return existing
  const fresh: AppSettings = {
    id: 'app',
    theme: 'system',
    lastWeekIdSeen: null,
    lastCleanupAt: null,
    onboarded: false,
  }
  await db.settings.put(fresh)
  return fresh
}
