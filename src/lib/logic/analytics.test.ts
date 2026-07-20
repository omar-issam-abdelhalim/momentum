import { describe, expect, it } from 'vitest'
import {
  aggregateSnapshots,
  filterSnapshotsInRange,
  generatePlanningInsights,
  habitCompletionRate,
  weeklyCompletionSeries,
} from './analytics'
import { previousDayISO } from './streaks'
import type { Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'

function makeSnapshot(overrides: Partial<WeeklySnapshot>): WeeklySnapshot {
  return {
    weekId: '2026-07-18',
    weekStart: 0,
    weekEnd: 0,
    weeklyPlanned: 4,
    weeklyCompleted: 2,
    weeklyRolledOver: 2,
    weeklyCompletionPct: 50,
    scheduledPlanned: 0,
    scheduledCompleted: 0,
    scheduledCompletedLate: 0,
    scheduledLateDaysSum: 0,
    todayOnlyPlanned: 0,
    todayOnlyCompleted: 0,
    todayOnlyMissed: 0,
    recurringPlanned: 0,
    recurringCompleted: 0,
    recurringCompletedLate: 0,
    recurringLateDaysSum: 0,
    deadlinesDue: 0,
    deadlinesMetOnTime: 0,
    deadlinesMetLate: 0,
    deadlinesMissed: 0,
    createdAt: 0,
    ...overrides,
  }
}

describe('weeklyCompletionSeries', () => {
  it('sorts chronologically and combines every kind into one completion figure', () => {
    const s1 = makeSnapshot({ weekId: '2026-07-25', weekStart: 2, weeklyPlanned: 5, weeklyCompleted: 4 })
    const s2 = makeSnapshot({ weekId: '2026-07-18', weekStart: 1, weeklyPlanned: 5, weeklyCompleted: 3 })
    const series = weeklyCompletionSeries([s1, s2])
    expect(series.map((p) => p.weekId)).toEqual(['2026-07-18', '2026-07-25'])
    expect(series[0].completionPct).toBe(60)
    expect(series[1].completionPct).toBe(80)
  })
})

describe('filterSnapshotsInRange', () => {
  const s1 = makeSnapshot({ weekId: 'a', weekStart: 100 })
  const s2 = makeSnapshot({ weekId: 'b', weekStart: 200 })
  const s3 = makeSnapshot({ weekId: 'c', weekStart: 300 })

  it('returns everything when bounds are null (All time)', () => {
    expect(filterSnapshotsInRange([s1, s2, s3], { label: 'All', startMs: null, endMs: null })).toHaveLength(3)
  })

  it('filters by weekStart falling within the bounds', () => {
    const result = filterSnapshotsInRange([s1, s2, s3], { label: 'Range', startMs: 150, endMs: 250 })
    expect(result.map((s) => s.weekId)).toEqual(['b'])
  })
})

describe('aggregateSnapshots', () => {
  it('sums every counter across the given snapshots', () => {
    const snapshots = [
      makeSnapshot({ weeklyPlanned: 4, weeklyCompleted: 2, weeklyRolledOver: 2 }),
      makeSnapshot({ weeklyPlanned: 4, weeklyCompleted: 4, weeklyRolledOver: 0 }),
    ]
    const stats = aggregateSnapshots(snapshots)
    expect(stats.weeklyPlanned).toBe(8)
    expect(stats.weeklyCompleted).toBe(6)
    expect(stats.weeklyCompletionPct).toBe(75)
    expect(stats.rolloverRatePct).toBe(25)
  })

  it('returns null rates rather than fabricating them when nothing was planned', () => {
    const stats = aggregateSnapshots([makeSnapshot({ weeklyPlanned: 0, weeklyCompleted: 0 })])
    expect(stats.weeklyCompletionPct).toBeNull()
    expect(stats.overallCompletionPct).toBeNull()
  })

  it('computes average lateness from the days-late sums', () => {
    const snapshots = [
      makeSnapshot({ scheduledCompletedLate: 2, scheduledLateDaysSum: 5 }),
      makeSnapshot({ recurringCompletedLate: 1, recurringLateDaysSum: 3 }),
    ]
    const stats = aggregateSnapshots(snapshots)
    // (5 + 3) days / (2 + 1) late items = 2.7
    expect(stats.averageLatenessDays).toBe(2.7)
  })

  it('returns null average lateness when nothing was ever late', () => {
    const stats = aggregateSnapshots([makeSnapshot({})])
    expect(stats.averageLatenessDays).toBeNull()
  })

  it('tracks overdue deadline count from deadlinesMissed', () => {
    const stats = aggregateSnapshots([makeSnapshot({ deadlinesDue: 3, deadlinesMetOnTime: 1, deadlinesMissed: 2 })])
    expect(stats.overdueDeadlineCount).toBe(2)
  })
})

describe('generatePlanningInsights', () => {
  it('returns nothing with fewer than 2 planned weeks', () => {
    expect(generatePlanningInsights([makeSnapshot({})])).toEqual([])
  })

  it('flags low completion as an overplanning observation', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, weeklyPlanned: 5, weeklyCompleted: 1, weeklyRolledOver: 1 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, weeklyPlanned: 5, weeklyCompleted: 1, weeklyRolledOver: 1 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'completion-low')).toBe(true)
  })

  it('praises consistently high completion', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, weeklyPlanned: 5, weeklyCompleted: 5, weeklyRolledOver: 0 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, weeklyPlanned: 5, weeklyCompleted: 5, weeklyRolledOver: 0 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'completion-high')).toBe(true)
    expect(insights.some((i) => i.id === 'rollover-high')).toBe(false)
  })

  it('adds a rollover observation when rollover rate is high', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, weeklyPlanned: 5, weeklyCompleted: 3, weeklyRolledOver: 3 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, weeklyPlanned: 5, weeklyCompleted: 3, weeklyRolledOver: 3 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'rollover-high')).toBe(true)
  })

  it('never emits medical/psychological language', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, weeklyPlanned: 5, weeklyCompleted: 1 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, weeklyPlanned: 5, weeklyCompleted: 0 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    const banned = /disorder|diagnos|anxiety|adhd|procrastinat/i
    for (const insight of insights) expect(insight.text).not.toMatch(banned)
  })
})

describe('habitCompletionRate', () => {
  const habit: Habit = {
    id: 'h1',
    name: 'Read',
    frequency: 'daily',
    order: 0,
    active: true,
    createdAt: 0,
  }

  it('computes percentage of a trailing window that was completed', () => {
    const completions: HabitCompletion[] = ['2026-07-20', '2026-07-21', '2026-07-22'].map((periodId, i) => ({
      id: `c${i}`,
      habitId: habit.id,
      periodId,
      completedAt: 0,
    }))
    const rate = habitCompletionRate(habit, completions, 5, '2026-07-22', previousDayISO)
    // window: 22,21,20,19,18 -> 3 hits / 5 = 60%
    expect(rate).toBe(60)
  })

  it('returns 0 for a habit with no completions', () => {
    expect(habitCompletionRate(habit, [], 7, '2026-07-22', previousDayISO)).toBe(0)
  })
})
