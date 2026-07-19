import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { runWeeklyRollover } from './rolloverRunner'
import { createGoal } from './goals.repo'
import { getCurrentWeekId } from '@/lib/date/week'
import type { AppSettings } from '@/types/models'

async function resetDb() {
  await db.goals.clear()
  await db.habits.clear()
  await db.habitCompletions.clear()
  await db.weeklySnapshots.clear()
  await db.settings.clear()
}

async function seedSettings(overrides: Partial<AppSettings>) {
  const settings: AppSettings = {
    id: 'app',
    theme: 'system',
    lastWeekIdSeen: null,
    lastCleanupAt: null,
    onboarded: true,
    ...overrides,
  }
  await db.settings.put(settings)
}

// 2026-07-18 is a Saturday — a clean custom-week boundary to anchor tests on.
const WEEK_0 = '2026-07-18'
const WEEK_1 = '2026-07-25'
const WEEK_2 = '2026-08-01'
const WEEK_3 = '2026-08-08'

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runWeeklyRollover', () => {
  it('on a fresh install, just records the current week with no snapshots', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20)) // within WEEK_0
    await seedSettings({ lastWeekIdSeen: null })

    const result = await runWeeklyRollover()

    expect(result.processedWeeks).toEqual([])
    const settings = await db.settings.get('app')
    expect(settings?.lastWeekIdSeen).toBe(getCurrentWeekId())
    expect(await db.weeklySnapshots.count()).toBe(0)
  })

  it('does nothing within the same week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    await seedSettings({ lastWeekIdSeen: WEEK_0 })

    const result = await runWeeklyRollover()
    expect(result.processedWeeks).toEqual([])
  })

  it('rolls over incomplete weekly goals and snapshots the closed week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20)) // WEEK_0
    await seedSettings({ lastWeekIdSeen: WEEK_0 })

    const incomplete = await createGoal({ title: 'Ship feature', type: 'weekly' })
    const complete = await createGoal({ title: 'Write docs', type: 'weekly' })
    await db.goals.update(complete.id, { completed: true, completedAt: Date.now() })

    vi.setSystemTime(new Date(2026, 6, 27)) // now WEEK_1
    const result = await runWeeklyRollover()

    expect(result.processedWeeks).toEqual([WEEK_0])

    const snapshot = await db.weeklySnapshots.get(WEEK_0)
    expect(snapshot?.totalPlanned).toBe(2)
    expect(snapshot?.completed).toBe(1)
    expect(snapshot?.rolledOver).toBe(1)

    const rolledGoal = await db.goals.get(incomplete.id)
    expect(rolledGoal?.currentWeekId).toBe(WEEK_1)
    expect(rolledGoal?.rolledOver).toBe(true)
    expect(rolledGoal?.rolloverCount).toBe(1)
    expect(rolledGoal?.originalWeekId).toBe(WEEK_0)

    const completeGoal = await db.goals.get(complete.id)
    expect(completeGoal?.currentWeekId).toBe(WEEK_0) // completed goals stay put
  })

  it('is idempotent: re-running against an already-closed week changes nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    await seedSettings({ lastWeekIdSeen: WEEK_0 })
    const goal = await createGoal({ title: 'Ship feature', type: 'weekly' })

    vi.setSystemTime(new Date(2026, 6, 27))
    await runWeeklyRollover()

    const afterFirstRun = await db.goals.get(goal.id)
    expect(afterFirstRun?.rolloverCount).toBe(1)

    // Simulate a reprocessing attempt (e.g. a stale settings write) against a
    // week that already has a snapshot — must not double-roll the goal.
    await db.settings.update('app', { lastWeekIdSeen: WEEK_0 })
    const result = await runWeeklyRollover()

    expect(result.skippedWeeks).toEqual([WEEK_0])
    expect(result.processedWeeks).toEqual([])
    const afterSecondRun = await db.goals.get(goal.id)
    expect(afterSecondRun?.rolloverCount).toBe(1) // unchanged
    expect(await db.weeklySnapshots.count()).toBe(1) // no duplicate snapshot

    const settings = await db.settings.get('app')
    expect(settings?.lastWeekIdSeen).toBe(getCurrentWeekId())
  })

  it('walks forward through every missed week when multiple weeks were skipped', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20)) // WEEK_0
    await seedSettings({ lastWeekIdSeen: WEEK_0 })
    const goal = await createGoal({ title: 'Long-running goal', type: 'weekly' })

    vi.setSystemTime(new Date(2026, 7, 10)) // now inside WEEK_3, 3 weeks later
    const result = await runWeeklyRollover()

    expect(result.processedWeeks).toEqual([WEEK_0, WEEK_1, WEEK_2])
    expect(await db.weeklySnapshots.count()).toBe(3)

    const final = await db.goals.get(goal.id)
    expect(final?.currentWeekId).toBe(WEEK_3)
    expect(final?.rolloverCount).toBe(3)
    expect(final?.originalWeekId).toBe(WEEK_0)

    // No duplicate goals were created along the way.
    expect(await db.goals.count()).toBe(1)

    const settings = await db.settings.get('app')
    expect(settings?.lastWeekIdSeen).toBe(WEEK_3)
  })

  it('never rolls over daily goals', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    await seedSettings({ lastWeekIdSeen: WEEK_0 })
    const daily = await createGoal({ title: 'Morning run', type: 'daily', dateISO: '2026-07-20' })

    vi.setSystemTime(new Date(2026, 6, 27))
    await runWeeklyRollover()

    const stored = await db.goals.get(daily.id)
    expect(stored?.rolledOver).toBe(false)
    expect(stored?.currentWeekId).toBe(WEEK_0) // daily goals don't use currentWeekId for rollover
  })
})
