import { describe, expect, it } from 'vitest'
import { isGoalEligibleForCleanup } from './cleanup'
import type { Goal } from '@/types/models'

const NOW = new Date(2026, 7, 1).getTime() // 2026-08-01
const DAY = 24 * 60 * 60 * 1000

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g',
    title: 'Goal',
    type: 'weekly',
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

describe('isGoalEligibleForCleanup — weekly goals', () => {
  it('is never eligible while incomplete, no matter how old', () => {
    const goal = makeGoal({ type: 'weekly', completed: false, createdAt: NOW - 365 * DAY })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(false)
  })

  it('is not eligible until 14 days after completion', () => {
    const goal = makeGoal({ type: 'weekly', completed: true, completedAt: NOW - 10 * DAY })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(false)
  })

  it('becomes eligible exactly at the 14-day threshold', () => {
    const goal = makeGoal({ type: 'weekly', completed: true, completedAt: NOW - 14 * DAY })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(true)
  })

  it('is eligible well after 14 days', () => {
    const goal = makeGoal({ type: 'weekly', completed: true, completedAt: NOW - 30 * DAY })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(true)
  })
})

describe('isGoalEligibleForCleanup — daily goals', () => {
  it('is not eligible for a recently completed daily goal', () => {
    const goal = makeGoal({ type: 'daily', dateISO: '2026-07-30', completed: true, completedAt: NOW - 1 * DAY })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(false)
  })

  it('is eligible for an old incomplete daily goal whose day has long passed', () => {
    const goal = makeGoal({ type: 'daily', dateISO: '2026-07-01', completed: false })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(true)
  })

  it('is not eligible for an incomplete daily goal from within the retention window', () => {
    const goal = makeGoal({ type: 'daily', dateISO: '2026-07-25', completed: false })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(false)
  })

  it('is not eligible for today\'s incomplete daily goal', () => {
    const goal = makeGoal({ type: 'daily', dateISO: '2026-08-01', completed: false })
    expect(isGoalEligibleForCleanup(goal, NOW)).toBe(false)
  })
})

describe('isGoalEligibleForCleanup — archived goals', () => {
  it('archived weekly goals follow the same completed+age rule', () => {
    const archivedIncomplete = makeGoal({ type: 'weekly', archived: true, completed: false })
    expect(isGoalEligibleForCleanup(archivedIncomplete, NOW)).toBe(false)
  })
})
