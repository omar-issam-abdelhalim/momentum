import { describe, expect, it } from 'vitest'
import { isGoalEligibleForRetentionCleanup } from './cleanup'
import type { Goal } from '@/types/models'

const NOW = new Date(2028, 0, 15).getTime() // 2028-01-15

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g',
    title: 'Goal',
    kind: 'weekly',
    createdAt: 0,
    completedAt: null,
    completed: false,
    originalWeekId: '2026-07-01',
    currentWeekId: '2026-07-01',
    rolledOver: false,
    rolloverCount: 0,
    archived: false,
    ...overrides,
  }
}

describe('isGoalEligibleForRetentionCleanup — incomplete active kinds', () => {
  it('an incomplete weekly goal is never eligible, no matter how old', () => {
    const goal = makeGoal({ kind: 'weekly', completed: false, createdAt: new Date(2020, 0, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(false)
  })

  it('an incomplete (Late) scheduled task is never eligible', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: '2020-01-01', completed: false })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(false)
  })

  it('an incomplete (Late) recurring occurrence is never eligible', () => {
    const goal = makeGoal({ kind: 'recurring', scheduledDateISO: '2020-01-01', completed: false })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(false)
  })
})

describe('isGoalEligibleForRetentionCleanup — Today Only', () => {
  it('an incomplete Today Only task from 2 calendar years ago is eligible', () => {
    const goal = makeGoal({ kind: 'today', scheduledDateISO: '2026-03-01', completed: false })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(true)
  })

  it('an incomplete Today Only task from last year is not yet eligible', () => {
    const goal = makeGoal({ kind: 'today', scheduledDateISO: '2027-03-01', completed: false })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(false)
  })
})

describe('isGoalEligibleForRetentionCleanup — completed goals of any kind', () => {
  it('a 2026 completion remains available throughout 2026 and 2027', () => {
    const goal = makeGoal({ completed: true, completedAt: new Date(2026, 5, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(goal, new Date(2026, 11, 31).getTime())).toBe(false)
    expect(isGoalEligibleForRetentionCleanup(goal, new Date(2027, 11, 31).getTime())).toBe(false)
  })

  it('a 2026 completion becomes eligible once 2028 begins', () => {
    const goal = makeGoal({ completed: true, completedAt: new Date(2026, 5, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(goal, new Date(2028, 0, 1).getTime())).toBe(true)
  })

  it('applies the same rule to completed scheduled and recurring tasks', () => {
    const scheduled = makeGoal({ kind: 'scheduled', completed: true, completedAt: new Date(2026, 5, 1).getTime() })
    const recurring = makeGoal({ kind: 'recurring', completed: true, completedAt: new Date(2026, 5, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(scheduled, NOW)).toBe(true)
    expect(isGoalEligibleForRetentionCleanup(recurring, NOW)).toBe(true)
  })
})

describe('isGoalEligibleForRetentionCleanup — archived goals', () => {
  it('follows the same 2-year rule, keyed off completion date when completed', () => {
    const goal = makeGoal({ archived: true, completed: true, completedAt: new Date(2026, 5, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(true)
  })

  it('falls back to creation date when never completed', () => {
    const goal = makeGoal({ archived: true, completed: false, createdAt: new Date(2026, 5, 1).getTime() })
    expect(isGoalEligibleForRetentionCleanup(goal, NOW)).toBe(true)
  })
})
