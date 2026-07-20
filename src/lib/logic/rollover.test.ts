import { describe, expect, it } from 'vitest'
import { applyRollover, buildWeeklySnapshot, getGoalsToRollover } from './rollover'
import type { Goal } from '@/types/models'

const WEEK = '2026-07-18' // Saturday; week runs through 2026-07-24

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Goal',
    kind: 'weekly',
    createdAt: 0,
    completedAt: null,
    completed: false,
    originalWeekId: WEEK,
    currentWeekId: WEEK,
    rolledOver: false,
    rolloverCount: 0,
    archived: false,
    ...overrides,
  }
}

describe('getGoalsToRollover', () => {
  it('selects only incomplete, non-archived weekly goals', () => {
    const incomplete = makeGoal({ id: 'incomplete' })
    const complete = makeGoal({ id: 'complete', completed: true })
    const archived = makeGoal({ id: 'archived', archived: true })
    const scheduled = makeGoal({ id: 'scheduled', kind: 'scheduled', scheduledDateISO: '2026-07-20', currentWeekId: undefined })
    const result = getGoalsToRollover([incomplete, complete, archived, scheduled])
    expect(result.map((g) => g.id)).toEqual(['incomplete'])
  })
})

describe('applyRollover', () => {
  it('advances the week, marks rolled-over, and increments the counter', () => {
    const goal = makeGoal({ id: 'a', currentWeekId: WEEK, rolloverCount: 0 })
    const rolled = applyRollover(goal, '2026-07-25')
    expect(rolled.currentWeekId).toBe('2026-07-25')
    expect(rolled.rolledOver).toBe(true)
    expect(rolled.rolloverCount).toBe(1)
    expect(rolled.originalWeekId).toBe(WEEK) // preserved
    expect(rolled.id).toBe('a') // same logical goal, not a copy
  })

  it('accumulates rollover count across multiple rollovers', () => {
    let goal = makeGoal({ id: 'a', rolloverCount: 2 })
    goal = applyRollover(goal, '2026-07-25')
    expect(goal.rolloverCount).toBe(3)
  })
})

describe('buildWeeklySnapshot — weekly goals', () => {
  it('computes planned/completed/completion percentage', () => {
    const pool = [
      makeGoal({ id: 'a', completed: true }),
      makeGoal({ id: 'b', completed: true }),
      makeGoal({ id: 'c', completed: false }),
      makeGoal({ id: 'd', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.weeklyPlanned).toBe(4)
    expect(snapshot.weeklyCompleted).toBe(2)
    expect(snapshot.weeklyCompletionPct).toBe(50)
    expect(snapshot.weeklyRolledOver).toBe(2)
  })

  it('excludes archived goals from planned counts', () => {
    const pool = [makeGoal({ id: 'a', completed: true }), makeGoal({ id: 'b', archived: true })]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.weeklyPlanned).toBe(1)
  })

  it('returns 0% completion for a week with no planned goals', () => {
    const snapshot = buildWeeklySnapshot(WEEK, [])
    expect(snapshot.weeklyCompletionPct).toBe(0)
    expect(snapshot.weeklyPlanned).toBe(0)
  })
})

describe('buildWeeklySnapshot — scheduled / today / recurring', () => {
  it('tracks scheduled tasks separately, including late completions', () => {
    const pool = [
      makeGoal({
        id: 's1',
        kind: 'scheduled',
        currentWeekId: undefined,
        scheduledDateISO: '2026-07-19',
        completed: true,
        completedAt: new Date(2026, 6, 21).getTime(), // completed 2 days late
      }),
      makeGoal({ id: 's2', kind: 'scheduled', currentWeekId: undefined, scheduledDateISO: '2026-07-20', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.scheduledPlanned).toBe(2)
    expect(snapshot.scheduledCompleted).toBe(1)
    expect(snapshot.scheduledCompletedLate).toBe(1)
    expect(snapshot.scheduledLateDaysSum).toBe(2)
  })

  it('tracks Today Only planned/completed/missed', () => {
    const pool = [
      makeGoal({ id: 't1', kind: 'today', currentWeekId: undefined, scheduledDateISO: '2026-07-19', completed: true, completedAt: 1 }),
      makeGoal({ id: 't2', kind: 'today', currentWeekId: undefined, scheduledDateISO: '2026-07-20', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.todayOnlyPlanned).toBe(2)
    expect(snapshot.todayOnlyCompleted).toBe(1)
    expect(snapshot.todayOnlyMissed).toBe(1)
  })

  it('tracks recurring occurrences independently of scheduled tasks', () => {
    const pool = [
      makeGoal({ id: 'r1', kind: 'recurring', currentWeekId: undefined, scheduledDateISO: '2026-07-21', completed: true, completedAt: new Date(2026, 6, 21).getTime() }),
    ]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.recurringPlanned).toBe(1)
    expect(snapshot.recurringCompleted).toBe(1)
    expect(snapshot.recurringCompletedLate).toBe(0)
  })
})

describe('buildWeeklySnapshot — deadlines', () => {
  it('classifies on-time vs late vs missed deadlines within the week', () => {
    const deadlineEnd = new Date(2026, 6, 20, 23, 59, 59, 999).getTime()
    const pool = [
      makeGoal({ id: 'on-time', currentWeekId: undefined, deadlineISO: '2026-07-20', completed: true, completedAt: deadlineEnd - 1000 }),
      makeGoal({ id: 'late', currentWeekId: undefined, deadlineISO: '2026-07-20', completed: true, completedAt: deadlineEnd + 1000 }),
      makeGoal({ id: 'missed', currentWeekId: undefined, deadlineISO: '2026-07-21', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot(WEEK, pool)
    expect(snapshot.deadlinesDue).toBe(3)
    expect(snapshot.deadlinesMetOnTime).toBe(1)
    expect(snapshot.deadlinesMetLate).toBe(1)
    expect(snapshot.deadlinesMissed).toBe(1)
  })
})
