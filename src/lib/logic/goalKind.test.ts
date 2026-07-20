import { describe, expect, it } from 'vitest'
import { isActiveToday, isExpiredTodayOnly, isLate, lateDays } from './goalKind'
import type { Goal } from '@/types/models'

const TODAY = '2026-07-22'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g',
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

describe('isLate', () => {
  it('a Scheduled Task becomes Late the day after its scheduled date passes', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-21' })
    expect(isLate(goal, TODAY)).toBe(true)
  })

  it('a Scheduled Task is not Late on its scheduled day', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY })
    expect(isLate(goal, TODAY)).toBe(false)
  })

  it('a completed Scheduled Task is never Late', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-01', completed: true })
    expect(isLate(goal, TODAY)).toBe(false)
  })

  it('a Recurring occurrence becomes Late exactly like a Scheduled Task', () => {
    const goal = makeGoal({ kind: 'recurring', scheduledDateISO: '2026-07-15' })
    expect(isLate(goal, TODAY)).toBe(true)
  })

  it('a Today Only task never becomes Late', () => {
    const goal = makeGoal({ kind: 'today', scheduledDateISO: '2026-07-15' })
    expect(isLate(goal, TODAY)).toBe(false)
  })

  it('a Weekly goal never becomes Late (rollover handles it instead)', () => {
    const goal = makeGoal({ kind: 'weekly' })
    expect(isLate(goal, TODAY)).toBe(false)
  })
})

describe('lateDays', () => {
  it('counts whole days late', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-19' })
    expect(lateDays(goal, TODAY)).toBe(3)
  })

  it('is 0 when not late', () => {
    const goal = makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY })
    expect(lateDays(goal, TODAY)).toBe(0)
  })
})

describe('isActiveToday', () => {
  it('a Today Only task is active only on its exact day', () => {
    expect(isActiveToday(makeGoal({ kind: 'today', scheduledDateISO: TODAY }), TODAY)).toBe(true)
    expect(isActiveToday(makeGoal({ kind: 'today', scheduledDateISO: '2026-07-21' }), TODAY)).toBe(false)
    expect(isActiveToday(makeGoal({ kind: 'today', scheduledDateISO: '2026-07-23' }), TODAY)).toBe(false)
  })

  it('a Scheduled Task is active from its scheduled day onward while incomplete', () => {
    expect(isActiveToday(makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY }), TODAY)).toBe(true)
    expect(isActiveToday(makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-10' }), TODAY)).toBe(true)
    expect(isActiveToday(makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-23' }), TODAY)).toBe(false)
  })
})

describe('isExpiredTodayOnly', () => {
  it('a missed Today Only task expires the day after, and never becomes Late', () => {
    const goal = makeGoal({ kind: 'today', scheduledDateISO: '2026-07-21' })
    expect(isExpiredTodayOnly(goal, TODAY)).toBe(true)
    expect(isLate(goal, TODAY)).toBe(false)
  })

  it('a completed Today Only task is never "expired"', () => {
    const goal = makeGoal({ kind: 'today', scheduledDateISO: '2026-07-21', completed: true })
    expect(isExpiredTodayOnly(goal, TODAY)).toBe(false)
  })
})
