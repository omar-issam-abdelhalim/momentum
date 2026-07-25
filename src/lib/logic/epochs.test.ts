import { describe, expect, it } from 'vitest'
import {
  computeAverageDailyCompletionPct,
  computeEpochStats,
  computeLifetimeSummary,
  defaultEpochSelectionId,
  getClosedEpochsMostRecentFirst,
  getOpenEpoch,
  resolveEpochSelection,
} from './epochs'
import type { Habit, HabitCompletion, HabitEpoch } from '@/types/models'

function ts(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getTime()
}

function makeHabit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    name: 'Habit',
    frequency: 'daily',
    order: 0,
    status: 'active',
    epochs: [{ id: 'e1', startDate: ts(2026, 7, 1), endDate: null }],
    createdAt: ts(2026, 7, 1),
    ...overrides,
  }
}

function completion(habitId: string, periodId: string, count?: number): HabitCompletion {
  return { id: `c-${periodId}`, habitId, periodId, completedAt: 0, count }
}

describe('getOpenEpoch / getClosedEpochsMostRecentFirst', () => {
  const epochs: HabitEpoch[] = [
    { id: 'e1', startDate: ts(2026, 1, 1), endDate: ts(2026, 2, 1) },
    { id: 'e2', startDate: ts(2026, 3, 1), endDate: ts(2026, 4, 1) },
    { id: 'e3', startDate: ts(2026, 5, 1), endDate: null },
  ]
  const habit = makeHabit({ epochs })

  it('finds the single open epoch', () => {
    expect(getOpenEpoch(habit)?.id).toBe('e3')
  })

  it('orders closed epochs most-recent-first', () => {
    expect(getClosedEpochsMostRecentFirst(habit).map((e) => e.id)).toEqual(['e2', 'e1'])
  })

  it('has no open epoch when the habit is paused', () => {
    const closedOnly = makeHabit({ status: 'paused', epochs: [epochs[0], epochs[1]] })
    expect(getOpenEpoch(closedOnly)).toBeUndefined()
  })
})

describe('resolveEpochSelection / defaultEpochSelectionId', () => {
  const epochs: HabitEpoch[] = [
    { id: 'e1', startDate: ts(2026, 1, 1), endDate: ts(2026, 2, 1) },
    { id: 'e2', startDate: ts(2026, 3, 1), endDate: null },
  ]
  const habit = makeHabit({ epochs })

  it("resolves 'now' to the open epoch", () => {
    expect(resolveEpochSelection(habit, 'now')?.id).toBe('e2')
  })

  it('resolves a specific id to its closed epoch', () => {
    expect(resolveEpochSelection(habit, 'e1')?.id).toBe('e1')
  })

  it("defaults to 'now' when an epoch is open", () => {
    expect(defaultEpochSelectionId(habit)).toBe('now')
  })

  it('defaults to the most recent closed epoch when paused', () => {
    const paused = makeHabit({ status: 'paused', epochs: [epochs[0], { ...epochs[1], endDate: ts(2026, 4, 1) }] })
    expect(defaultEpochSelectionId(paused)).toBe('e2')
  })
})

describe('computeEpochStats — daily habit', () => {
  it('computes completion rate and streaks bounded to the epoch and its schedule', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ epochs: [epoch] })
    const completed = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']
    const completions = completed.map((p) => completion(habit.id, p))

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-10')

    expect(stats.totalDuePeriods).toBe(10)
    expect(stats.totalCompletions).toBe(9)
    expect(stats.completionRatePct).toBe(90)
    expect(stats.bestStreak).toBe(6) // 07-05..07-10
    expect(stats.currentStreak).toBe(6)
  })

  it('does not break the current streak while today is still in progress (not yet completed)', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ epochs: [epoch] })
    const completions = ['2026-07-08', '2026-07-09'].map((p) => completion(habit.id, p))

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-10')
    expect(stats.currentStreak).toBe(2)
  })

  it('breaks the current streak for a closed epoch whose last due day was missed', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: ts(2026, 7, 10) }
    const habit = makeHabit({ epochs: [epoch] })
    const completions = ['2026-07-08', '2026-07-09'].map((p) => completion(habit.id, p))

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-20')
    expect(stats.currentStreak).toBe(0)
  })

  it('never fabricates a rate for a zero-duration epoch that lands on a non-due day', () => {
    const habit = makeHabit({ frequency: 'daily', weekdays: [1], epochs: [] }) // Monday only
    const day = ts(2026, 7, 21) // a Tuesday
    const epoch: HabitEpoch = { id: 'e1', startDate: day, endDate: day }

    const stats = computeEpochStats(habit, epoch, [], '2026-07-21')
    expect(stats.totalDuePeriods).toBe(0)
    expect(stats.completionRatePct).toBeNull()
    expect(stats.currentStreak).toBe(0)
    expect(stats.bestStreak).toBe(0)
    expect(stats.durationDays).toBe(0)
  })

  it('shows real zero values for a habit never completed before being paused', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: ts(2026, 7, 5) }
    const habit = makeHabit({ epochs: [epoch] })

    const stats = computeEpochStats(habit, epoch, [], '2026-07-20')
    expect(stats.totalCompletions).toBe(0)
    expect(stats.completionRatePct).toBe(0)
    expect(stats.bestStreak).toBe(0)
  })

  it('only counts due days for a weekday-restricted habit (Tue/Thu are never due)', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null } // Monday
    const habit = makeHabit({ frequency: 'daily', weekdays: [1, 3, 5], epochs: [epoch] })
    // Mon 20, Wed 22, Fri 24 all completed; Tue/Thu/weekend never due.
    const completions = ['2026-07-20', '2026-07-22', '2026-07-24'].map((p) => completion(habit.id, p))

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-24')
    expect(stats.totalDuePeriods).toBe(3)
    expect(stats.totalCompletions).toBe(3)
    expect(stats.completionRatePct).toBe(100)
  })
})

describe('computeEpochStats — weekly habit', () => {
  it('treats each custom week as one due period', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 4), endDate: null } // a Saturday
    const habit = makeHabit({ frequency: 'weekly', epochs: [epoch] })
    const weekIds = ['2026-07-04', '2026-07-11']
    const completions = weekIds.map((p) => completion(habit.id, p))

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-15', '2026-07-11')
    expect(stats.totalDuePeriods).toBe(2)
    expect(stats.totalCompletions).toBe(2)
    expect(stats.completionRatePct).toBe(100)
  })
})

describe('computeEpochStats — quantity (daily-target) habit', () => {
  it('only counts a day as complete once its count reaches target — partial days never count toward streaks/rate', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ dailyTarget: 3, epochs: [epoch] })
    const completions = [
      completion(habit.id, '2026-07-01', 3), // fully at target
      completion(habit.id, '2026-07-02', 2), // partial — must not count
      completion(habit.id, '2026-07-03', 3), // fully at target
    ]

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-03')
    expect(stats.totalDuePeriods).toBe(3)
    expect(stats.totalCompletions).toBe(2) // not 3 — the partial day is excluded
    expect(stats.currentStreak).toBe(1) // 07-02 broke the streak, only 07-03 counts
    expect(stats.bestStreak).toBe(1)
  })

  it('still breaks a streak-in-progress evaluation for today when partially progressed but not yet at target', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ dailyTarget: 3, epochs: [epoch] })
    const completions = [completion(habit.id, '2026-07-08', 3), completion(habit.id, '2026-07-09', 2)] // today partial

    const stats = computeEpochStats(habit, epoch, completions, '2026-07-09')
    // Today (2026-07-09) isn't complete yet (2 of 3) — same "still in progress" grace as an untouched day.
    expect(stats.currentStreak).toBe(1)
  })
})

describe('computeAverageDailyCompletionPct', () => {
  it('averages (count/target) across due days, capped at 1 per day', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ dailyTarget: 4, epochs: [epoch] })
    const completions = [
      completion(habit.id, '2026-07-01', 4), // 100%
      completion(habit.id, '2026-07-02', 2), // 50%
      // 2026-07-03: no record at all -> 0%
    ]

    const avg = computeAverageDailyCompletionPct(habit, epoch, completions, '2026-07-03')
    expect(avg).toBe(50) // (100 + 50 + 0) / 3 = 50
  })

  it('caps a day at 100% even if its count exceeds target', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ dailyTarget: 2, epochs: [epoch] })
    const completions = [completion(habit.id, '2026-07-01', 9)]

    const avg = computeAverageDailyCompletionPct(habit, epoch, completions, '2026-07-01')
    expect(avg).toBe(100)
  })

  it('never fabricates a rate when there are zero due days', () => {
    const habit = makeHabit({ frequency: 'daily', dailyTarget: 3, weekdays: [1], epochs: [] }) // Monday only
    const day = ts(2026, 7, 21) // a Tuesday
    const epoch: HabitEpoch = { id: 'e1', startDate: day, endDate: day }

    const avg = computeAverageDailyCompletionPct(habit, epoch, [], '2026-07-21')
    expect(avg).toBeNull()
  })

  it('reads a legacy binary completion row (no count field) as fully at target', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: null }
    const habit = makeHabit({ dailyTarget: 5, epochs: [epoch] })
    const completions = [{ id: 'legacy', habitId: habit.id, periodId: '2026-07-01', completedAt: 0 }] // no count field

    const avg = computeAverageDailyCompletionPct(habit, epoch, completions, '2026-07-01')
    expect(avg).toBe(100)
  })
})

describe('computeLifetimeSummary', () => {
  it('sums completions and active duration across all epochs, and takes the best streak across any single epoch', () => {
    const closed: HabitEpoch = { id: 'e1', startDate: ts(2026, 1, 1), endDate: ts(2026, 1, 6) } // 5 days, 1..5 due
    const open: HabitEpoch = { id: 'e2', startDate: ts(2026, 2, 1), endDate: null }
    const habit = makeHabit({ epochs: [closed, open] })

    const closedCompletions = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'].map((p) =>
      completion(habit.id, p),
    )
    const openCompletions = ['2026-02-01'].map((p) => completion(habit.id, p))
    const completions = [...closedCompletions, ...openCompletions]

    const summary = computeLifetimeSummary(habit, completions, '2026-02-02')
    expect(summary.epochCount).toBe(2)
    expect(summary.totalCompletions).toBe(6)
    // Best streak ever came from the closed epoch (5), not the open one (1) — never spans the pause gap.
    expect(summary.bestStreakEver).toBe(5)
  })
})
