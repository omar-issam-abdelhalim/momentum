import { describe, expect, it } from 'vitest'
import { isCompletedThisWeek, isRelevantActive, selectRelevantGoals } from './goalsQuery'
import { weekIdToRange } from '@/lib/date/week'
import type { Goal } from '@/types/models'

const TODAY = '2026-07-22'
const CURRENT_WEEK = '2026-07-18'
const PREV_WEEK = '2026-07-11'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Goal',
    kind: 'scheduled',
    createdAt: 0,
    completedAt: null,
    completed: false,
    rolledOver: false,
    rolloverCount: 0,
    archived: false,
    ...overrides,
  }
}

describe('isRelevantActive', () => {
  it('a weekly goal is active only while it belongs to the current week', () => {
    expect(isRelevantActive(makeGoal({ kind: 'weekly', currentWeekId: CURRENT_WEEK }), TODAY, CURRENT_WEEK)).toBe(true)
    expect(isRelevantActive(makeGoal({ kind: 'weekly', currentWeekId: PREV_WEEK }), TODAY, CURRENT_WEEK)).toBe(false)
  })

  it('a scheduled task is active on its day and every day after (Late) until completed', () => {
    expect(isRelevantActive(makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY }), TODAY, CURRENT_WEEK)).toBe(true)
    expect(isRelevantActive(makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-01' }), TODAY, CURRENT_WEEK)).toBe(true)
    expect(isRelevantActive(makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-25' }), TODAY, CURRENT_WEEK)).toBe(false)
  })

  it('a Today Only task is active only on its exact day', () => {
    expect(isRelevantActive(makeGoal({ kind: 'today', scheduledDateISO: TODAY }), TODAY, CURRENT_WEEK)).toBe(true)
    expect(isRelevantActive(makeGoal({ kind: 'today', scheduledDateISO: '2026-07-21' }), TODAY, CURRENT_WEEK)).toBe(false)
  })

  it('completed or archived goals are never active', () => {
    expect(isRelevantActive(makeGoal({ kind: 'today', scheduledDateISO: TODAY, completed: true }), TODAY, CURRENT_WEEK)).toBe(false)
    expect(isRelevantActive(makeGoal({ kind: 'today', scheduledDateISO: TODAY, archived: true }), TODAY, CURRENT_WEEK)).toBe(false)
  })
})

describe('isCompletedThisWeek', () => {
  const { start, end } = weekIdToRange(CURRENT_WEEK)

  it('is true for anything completed within the current custom week, regardless of kind or original schedule', () => {
    const goal = makeGoal({
      kind: 'scheduled',
      scheduledDateISO: '2026-07-10', // was Late, from a previous week
      completed: true,
      completedAt: start.getTime() + 1000,
    })
    expect(isCompletedThisWeek(goal, start.getTime(), end.getTime())).toBe(true)
  })

  it('is false for something completed in a previous week', () => {
    const goal = makeGoal({ kind: 'weekly', completed: true, completedAt: start.getTime() - 10000 })
    expect(isCompletedThisWeek(goal, start.getTime(), end.getTime())).toBe(false)
  })
})

describe('selectRelevantGoals', () => {
  const { start, end } = weekIdToRange(CURRENT_WEEK)

  it('includes active items plus anything completed this week, excludes previous-week completions', () => {
    const activeToday = makeGoal({ id: 'active', kind: 'today', scheduledDateISO: TODAY })
    const completedThisWeek = makeGoal({
      id: 'done-this-week',
      kind: 'scheduled',
      scheduledDateISO: '2026-07-19',
      completed: true,
      completedAt: start.getTime() + 5000,
    })
    const completedLastWeek = makeGoal({
      id: 'done-last-week',
      kind: 'weekly',
      completed: true,
      completedAt: start.getTime() - 5000,
    })
    const irrelevant = makeGoal({ id: 'future', kind: 'scheduled', scheduledDateISO: '2026-08-01' })

    const result = selectRelevantGoals(
      [activeToday, completedThisWeek, completedLastWeek, irrelevant],
      TODAY,
      CURRENT_WEEK,
      start.getTime(),
      end.getTime(),
    )
    expect(result.map((g) => g.id).sort()).toEqual(['active', 'done-this-week'])
  })
})
