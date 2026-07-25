import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import {
  createHabit,
  decrementHabitProgress,
  deleteHabit,
  getActiveHabits,
  getPausedHabits,
  incrementHabitProgress,
  isHabitCompleteForCurrentPeriod,
  pauseHabit,
  resumeHabit,
  updateHabit,
} from './habits.repo'

async function resetDb() {
  await db.goals.clear()
  await db.recurringDefinitions.clear()
  await db.habits.clear()
  await db.habitCompletions.clear()
  await db.weeklySnapshots.clear()
  await db.settings.clear()
}

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createHabit', () => {
  it('creates a habit with active status and exactly one open epoch', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 1))

    const habit = await createHabit({ name: 'Read', frequency: 'daily' })
    expect(habit.status).toBe('active')
    expect(habit.epochs).toHaveLength(1)
    expect(habit.epochs[0].endDate).toBeNull()
    expect(habit.epochs[0].startDate).toBe(new Date(2026, 6, 1).getTime())
  })

  it('only persists weekdays for daily-frequency habits', async () => {
    const daily = await createHabit({ name: 'Gym', frequency: 'daily', weekdays: [1, 3, 5] })
    expect(daily.weekdays).toEqual([1, 3, 5])

    const weekly = await createHabit({ name: 'Review', frequency: 'weekly', weekdays: [1, 3, 5] })
    expect(weekly.weekdays).toBeUndefined()
  })
})

describe('pauseHabit / resumeHabit', () => {
  it('closes the open epoch and flips status to paused', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 1))
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })

    vi.setSystemTime(new Date(2026, 6, 10))
    await pauseHabit(habit.id)

    const paused = await db.habits.get(habit.id)
    expect(paused?.status).toBe('paused')
    expect(paused?.epochs).toHaveLength(1)
    expect(paused?.epochs[0].endDate).toBe(new Date(2026, 6, 10).getTime())
  })

  it('opens a brand-new epoch on resume, never reopening the closed one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 1))
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })

    vi.setSystemTime(new Date(2026, 6, 10))
    await pauseHabit(habit.id)

    vi.setSystemTime(new Date(2026, 6, 15))
    await resumeHabit(habit.id)

    const resumed = await db.habits.get(habit.id)
    expect(resumed?.status).toBe('active')
    expect(resumed?.epochs).toHaveLength(2)
    expect(resumed?.epochs[0].startDate).toBe(new Date(2026, 6, 1).getTime())
    expect(resumed?.epochs[0].endDate).toBe(new Date(2026, 6, 10).getTime())
    expect(resumed?.epochs[1].startDate).toBe(new Date(2026, 6, 15).getTime())
    expect(resumed?.epochs[1].endDate).toBeNull()
  })

  it('supports many pause/resume cycles, each producing a correctly bounded, chronologically ordered epoch', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 1))
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })

    for (let cycle = 0; cycle < 5; cycle++) {
      vi.setSystemTime(new Date(2026, 0, 1 + cycle * 10 + 5))
      await pauseHabit(habit.id)
      vi.setSystemTime(new Date(2026, 0, 1 + cycle * 10 + 8))
      await resumeHabit(habit.id)
    }

    const final = await db.habits.get(habit.id)
    expect(final?.epochs).toHaveLength(6) // 5 closed + 1 open
    expect(final?.status).toBe('active')
    const closed = final!.epochs.slice(0, -1)
    expect(closed.every((e) => e.endDate !== null)).toBe(true)
    // Chronologically ordered: each epoch starts after the previous one ends.
    for (let i = 1; i < final!.epochs.length; i++) {
      expect(final!.epochs[i].startDate).toBeGreaterThan(final!.epochs[i - 1].startDate)
    }
    expect(final!.epochs[final!.epochs.length - 1].endDate).toBeNull()
  })

  it('opens a genuinely new epoch even when resumed the same day it was paused', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 1, 9, 0))
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })

    vi.setSystemTime(new Date(2026, 6, 1, 12, 0))
    await pauseHabit(habit.id)
    vi.setSystemTime(new Date(2026, 6, 1, 14, 0))
    await resumeHabit(habit.id)

    const habits = await db.habits.get(habit.id)
    expect(habits?.epochs).toHaveLength(2)
    expect(habits?.epochs[1].startDate).not.toBe(habits?.epochs[0].startDate)
    expect(habits?.epochs[1].id).not.toBe(habits?.epochs[0].id)
  })

  it('is a no-op to pause an already-paused habit or resume an already-active one', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })
    await pauseHabit(habit.id)
    const afterFirstPause = await db.habits.get(habit.id)
    await pauseHabit(habit.id)
    const afterSecondPause = await db.habits.get(habit.id)
    expect(afterSecondPause?.epochs).toEqual(afterFirstPause?.epochs)

    await resumeHabit(habit.id)
    const afterFirstResume = await db.habits.get(habit.id)
    await resumeHabit(habit.id)
    const afterSecondResume = await db.habits.get(habit.id)
    expect(afterSecondResume?.epochs).toEqual(afterFirstResume?.epochs)
  })
})

describe('getActiveHabits / getPausedHabits', () => {
  it('filters by status', async () => {
    const a = await createHabit({ name: 'Active one', frequency: 'daily' })
    const b = await createHabit({ name: 'Paused one', frequency: 'daily' })
    await pauseHabit(b.id)

    const active = await getActiveHabits()
    const paused = await getPausedHabits()
    expect(active.map((h) => h.id)).toEqual([a.id])
    expect(paused.map((h) => h.id)).toEqual([b.id])
  })
})

describe('deleteHabit', () => {
  it('deletes a paused habit and its completion history regardless of status', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' })
    await pauseHabit(habit.id)
    await db.habitCompletions.add({ id: 'c1', habitId: habit.id, periodId: '2026-07-01', completedAt: 0 })

    await deleteHabit(habit.id)

    expect(await db.habits.get(habit.id)).toBeUndefined()
    expect(await db.habitCompletions.where('habitId').equals(habit.id).count()).toBe(0)
  })
})

describe('daily target (quantity) habits', () => {
  it('only applies dailyTarget to daily-frequency habits — weekly habits ignore it entirely', async () => {
    const daily = await createHabit({ name: 'Drink water', frequency: 'daily', dailyTarget: 5 })
    expect(daily.dailyTarget).toBe(5)

    const weekly = await createHabit({ name: 'Review', frequency: 'weekly', dailyTarget: 5 })
    expect(weekly.dailyTarget).toBeUndefined()
  })

  it('increments today\'s progress up to target and reports completion exactly once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const habit = await createHabit({ name: 'Drink water', frequency: 'daily', dailyTarget: 3 })

    expect((await incrementHabitProgress(habit)).completed).toBe(false)
    expect((await incrementHabitProgress(habit)).completed).toBe(false)
    expect((await incrementHabitProgress(habit)).completed).toBe(true)
    expect(await isHabitCompleteForCurrentPeriod(habit)).toBe(true)

    const record = await db.habitCompletions.where('[habitId+periodId]').equals([habit.id, '2026-07-20']).first()
    expect(record?.count).toBe(3)
  })

  it('caps stored count at target — overshoot beyond target is a no-op', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const habit = await createHabit({ name: 'Drink water', frequency: 'daily', dailyTarget: 2 })
    await incrementHabitProgress(habit)
    await incrementHabitProgress(habit)
    await incrementHabitProgress(habit) // third tap, already at target

    const record = await db.habitCompletions.where('[habitId+periodId]').equals([habit.id, '2026-07-20']).first()
    expect(record?.count).toBe(2)
  })

  it('decrements today\'s progress floored at 0, deleting the row entirely once it reaches 0', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const habit = await createHabit({ name: 'Drink water', frequency: 'daily', dailyTarget: 3 })
    await incrementHabitProgress(habit)

    await decrementHabitProgress(habit)
    const record = await db.habitCompletions.where('[habitId+periodId]').equals([habit.id, '2026-07-20']).first()
    expect(record).toBeUndefined()

    // Decrementing again with no row at all is a safe no-op.
    await decrementHabitProgress(habit)
    expect(await isHabitCompleteForCurrentPeriod(habit)).toBe(false)
  })

  it('un-completes a fully-at-target day when decremented back below target', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const habit = await createHabit({ name: 'Drink water', frequency: 'daily', dailyTarget: 2 })
    await incrementHabitProgress(habit)
    await incrementHabitProgress(habit)
    expect(await isHabitCompleteForCurrentPeriod(habit)).toBe(true)

    await decrementHabitProgress(habit)
    expect(await isHabitCompleteForCurrentPeriod(habit)).toBe(false)
  })

  it('a legacy binary completion row (no count field) still reads as complete after dailyTarget is set later — no reinterpretation of existing completion state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const habit = await createHabit({ name: 'Read', frequency: 'daily' }) // binary
    await db.habitCompletions.add({ id: 'legacy1', habitId: habit.id, periodId: '2026-07-20', completedAt: Date.now() })
    expect(await isHabitCompleteForCurrentPeriod(habit)).toBe(true)

    // Habit is converted to a quantity habit after the fact.
    await updateHabit(habit.id, { dailyTarget: 5 })
    const updated = await db.habits.get(habit.id)
    const stillComplete = updated ? await isHabitCompleteForCurrentPeriod(updated) : false
    expect(stillComplete).toBe(true)
  })
})
