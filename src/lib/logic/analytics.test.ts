import { describe, expect, it } from 'vitest'
import {
  averageCompletionRate,
  averageRolloverRate,
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
    totalPlanned: 4,
    completed: 2,
    notCompleted: 2,
    completionPct: 50,
    rolledOver: 2,
    withDeadline: 0,
    completedBeforeDeadline: 0,
    completedAfterDeadline: 0,
    dailyGoalsPlanned: 0,
    dailyGoalsCompleted: 0,
    createdAt: 0,
    ...overrides,
  }
}

describe('weeklyCompletionSeries', () => {
  it('sorts chronologically and maps to chart points', () => {
    const s1 = makeSnapshot({ weekId: '2026-07-25', weekStart: 2, completionPct: 80 })
    const s2 = makeSnapshot({ weekId: '2026-07-18', weekStart: 1, completionPct: 60 })
    const series = weeklyCompletionSeries([s1, s2])
    expect(series.map((p) => p.weekId)).toEqual(['2026-07-18', '2026-07-25'])
    expect(series[0].completionPct).toBe(60)
  })
})

describe('averageCompletionRate', () => {
  it('averages across weeks that had planned goals', () => {
    const snapshots = [makeSnapshot({ completionPct: 80 }), makeSnapshot({ completionPct: 40 })]
    expect(averageCompletionRate(snapshots)).toBe(60)
  })

  it('ignores weeks with nothing planned', () => {
    const snapshots = [
      makeSnapshot({ completionPct: 100, totalPlanned: 2 }),
      makeSnapshot({ completionPct: 0, totalPlanned: 0 }),
    ]
    expect(averageCompletionRate(snapshots)).toBe(100)
  })

  it('returns null with no data', () => {
    expect(averageCompletionRate([])).toBeNull()
  })
})

describe('averageRolloverRate', () => {
  it('computes the mean rollover ratio as a percentage', () => {
    const snapshots = [
      makeSnapshot({ totalPlanned: 4, rolledOver: 2 }), // 50%
      makeSnapshot({ totalPlanned: 4, rolledOver: 0 }), // 0%
    ]
    expect(averageRolloverRate(snapshots)).toBe(25)
  })
})

describe('generatePlanningInsights', () => {
  it('returns nothing with fewer than 2 planned weeks', () => {
    expect(generatePlanningInsights([makeSnapshot({})])).toEqual([])
  })

  it('flags low completion as an overplanning observation', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, completionPct: 30, totalPlanned: 5, rolledOver: 1 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, completionPct: 20, totalPlanned: 5, rolledOver: 1 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'completion-low')).toBe(true)
  })

  it('praises consistently high completion', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, completionPct: 90, totalPlanned: 5, rolledOver: 0 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, completionPct: 95, totalPlanned: 5, rolledOver: 0 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'completion-high')).toBe(true)
    expect(insights.some((i) => i.id === 'rollover-high')).toBe(false)
  })

  it('adds a rollover observation when rollover rate is high', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, completionPct: 60, totalPlanned: 5, rolledOver: 3 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, completionPct: 65, totalPlanned: 5, rolledOver: 3 }),
    ]
    const insights = generatePlanningInsights(snapshots)
    expect(insights.some((i) => i.id === 'rollover-high')).toBe(true)
  })

  it('never emits medical/psychological language', () => {
    const snapshots = [
      makeSnapshot({ weekId: '2026-07-18', weekStart: 1, completionPct: 10, totalPlanned: 5 }),
      makeSnapshot({ weekId: '2026-07-25', weekStart: 2, completionPct: 5, totalPlanned: 5 }),
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
