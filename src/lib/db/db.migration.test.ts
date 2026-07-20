import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

const DB_NAME = 'momentum-db'

describe('MomentumDB v1 -> v2 migration', () => {
  it('migrates an existing v1 database without losing data', async () => {
    // Seed a v1-shaped database directly with Dexie's raw API (bypassing the
    // app's MomentumDB class, which already declares v2) so there is a real
    // v1 -> v2 upgrade path to exercise, exactly as an existing installed
    // user's browser would have on disk.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({
      goals: 'id, type, currentWeekId, originalWeekId, dateISO, deadlineISO, createdAt',
      habits: 'id, frequency, order',
      habitCompletions: 'id, habitId, periodId, [habitId+periodId], completedAt',
      weeklySnapshots: 'weekId, weekStart',
      settings: 'id',
    })
    await legacy.open()

    await legacy.table('goals').bulkAdd([
      {
        id: 'w1',
        title: 'Weekly goal',
        type: 'weekly',
        createdAt: 1,
        completedAt: null,
        completed: false,
        originalWeekId: '2026-07-18',
        currentWeekId: '2026-07-18',
        rolledOver: false,
        rolloverCount: 0,
        archived: false,
      },
      {
        id: 'd1',
        title: 'Daily goal',
        type: 'daily',
        dateISO: '2026-07-20',
        createdAt: 1,
        completedAt: null,
        completed: false,
        originalWeekId: '2026-07-18',
        currentWeekId: '2026-07-18',
        rolledOver: false,
        rolloverCount: 0,
        archived: false,
      },
    ])
    await legacy.table('weeklySnapshots').add({
      weekId: '2026-07-11',
      weekStart: 0,
      weekEnd: 0,
      totalPlanned: 3,
      completed: 2,
      notCompleted: 1,
      completionPct: 67,
      rolledOver: 1,
      withDeadline: 1,
      completedBeforeDeadline: 1,
      completedAfterDeadline: 0,
      dailyGoalsPlanned: 2,
      dailyGoalsCompleted: 1,
      createdAt: 1,
    })
    await legacy.table('settings').add({ id: 'app', theme: 'system', lastWeekIdSeen: '2026-07-18', lastCleanupAt: null, onboarded: true })
    legacy.close()

    // Import lazily so the module's side-effect singleton (`export const db`)
    // doesn't open the database before the legacy seed above runs.
    const { MomentumDB } = await import('./db')
    const upgraded = new MomentumDB()
    await upgraded.open()

    const weekly = await upgraded.goals.get('w1')
    expect(weekly?.kind).toBe('weekly')
    expect((weekly as unknown as { type?: string }).type).toBeUndefined()

    const daily = await upgraded.goals.get('d1')
    expect(daily?.kind).toBe('today')
    expect(daily?.scheduledDateISO).toBe('2026-07-20')
    expect((daily as unknown as { dateISO?: string }).dateISO).toBeUndefined()

    const snapshot = await upgraded.weeklySnapshots.get('2026-07-11')
    expect(snapshot?.weeklyPlanned).toBe(3)
    expect(snapshot?.weeklyCompleted).toBe(2)
    expect(snapshot?.weeklyRolledOver).toBe(1)
    expect(snapshot?.todayOnlyPlanned).toBe(2)
    expect(snapshot?.todayOnlyCompleted).toBe(1)
    expect(snapshot?.deadlinesDue).toBe(1)
    expect(snapshot?.deadlinesMetOnTime).toBe(1)

    const recurringDefsTable = upgraded.recurringDefinitions
    expect(await recurringDefsTable.count()).toBe(0)

    await upgraded.delete()
  })
})
