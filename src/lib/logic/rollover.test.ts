import { describe, expect, it } from 'vitest'
import { applyRollover, buildWeeklySnapshot, getGoalsToRollover } from './rollover'
import type { Goal } from '@/types/models'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Goal',
    type: 'weekly',
    createdAt: 0,
    completedAt: null,
    completed: false,
    originalWeekId: '2026-07-18',
    currentWeekId: '2026-07-18',
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
    const daily = makeGoal({ id: 'daily', type: 'daily', dateISO: '2026-07-20' })
    const result = getGoalsToRollover([incomplete, complete, archived, daily])
    expect(result.map((g) => g.id)).toEqual(['incomplete'])
  })
})

describe('applyRollover', () => {
  it('advances the week, marks rolled-over, and increments the counter', () => {
    const goal = makeGoal({ id: 'a', currentWeekId: '2026-07-18', rolloverCount: 0 })
    const rolled = applyRollover(goal, '2026-07-25')
    expect(rolled.currentWeekId).toBe('2026-07-25')
    expect(rolled.rolledOver).toBe(true)
    expect(rolled.rolloverCount).toBe(1)
    expect(rolled.originalWeekId).toBe('2026-07-18') // preserved
    expect(rolled.id).toBe('a') // same logical goal, not a copy
  })

  it('accumulates rollover count across multiple rollovers', () => {
    let goal = makeGoal({ id: 'a', rolloverCount: 2 })
    goal = applyRollover(goal, '2026-07-25')
    expect(goal.rolloverCount).toBe(3)
  })
})

describe('buildWeeklySnapshot', () => {
  it('computes planned/completed/completion percentage for weekly goals', () => {
    const goals = [
      makeGoal({ id: 'a', completed: true }),
      makeGoal({ id: 'b', completed: true }),
      makeGoal({ id: 'c', completed: false }),
      makeGoal({ id: 'd', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot('2026-07-18', goals)
    expect(snapshot.totalPlanned).toBe(4)
    expect(snapshot.completed).toBe(2)
    expect(snapshot.notCompleted).toBe(2)
    expect(snapshot.completionPct).toBe(50)
    expect(snapshot.rolledOver).toBe(2)
  })

  it('excludes archived goals from planned counts', () => {
    const goals = [makeGoal({ id: 'a', completed: true }), makeGoal({ id: 'b', archived: true })]
    const snapshot = buildWeeklySnapshot('2026-07-18', goals)
    expect(snapshot.totalPlanned).toBe(1)
  })

  it('tracks daily goals separately from weekly completion stats', () => {
    const goals = [
      makeGoal({ id: 'w1', type: 'weekly', completed: true }),
      makeGoal({ id: 'd1', type: 'daily', dateISO: '2026-07-19', completed: true }),
      makeGoal({ id: 'd2', type: 'daily', dateISO: '2026-07-20', completed: false }),
    ]
    const snapshot = buildWeeklySnapshot('2026-07-18', goals)
    expect(snapshot.totalPlanned).toBe(1) // weekly only
    expect(snapshot.dailyGoalsPlanned).toBe(2)
    expect(snapshot.dailyGoalsCompleted).toBe(1)
  })

  it('classifies completed-before vs completed-after deadline', () => {
    const deadlineEnd = new Date(2026, 6, 20, 23, 59, 59, 999).getTime()
    const goals = [
      makeGoal({
        id: 'before',
        deadlineISO: '2026-07-20',
        completed: true,
        completedAt: deadlineEnd - 1000,
      }),
      makeGoal({
        id: 'after',
        deadlineISO: '2026-07-20',
        completed: true,
        completedAt: deadlineEnd + 1000,
      }),
    ]
    const snapshot = buildWeeklySnapshot('2026-07-18', goals)
    expect(snapshot.withDeadline).toBe(2)
    expect(snapshot.completedBeforeDeadline).toBe(1)
    expect(snapshot.completedAfterDeadline).toBe(1)
  })

  it('returns 0% completion for a week with no planned goals', () => {
    const snapshot = buildWeeklySnapshot('2026-07-18', [])
    expect(snapshot.completionPct).toBe(0)
    expect(snapshot.totalPlanned).toBe(0)
  })
})
