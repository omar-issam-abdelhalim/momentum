import { describe, expect, it } from 'vitest'
import {
  filterCompletionsAtTarget,
  isCompletionAtTarget,
  isCounterHabit,
  progressCountForRecord,
  targetForHabit,
} from './habitProgress'
import type { Habit, HabitCompletion } from '@/types/models'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Drink water',
    frequency: 'daily',
    order: 0,
    status: 'active',
    epochs: [{ id: 'e1', startDate: 0, endDate: null }],
    createdAt: 0,
    ...overrides,
  }
}

describe('targetForHabit', () => {
  it('is the effective dailyTarget for a daily habit', () => {
    expect(targetForHabit(makeHabit({ dailyTarget: 3 }))).toBe(3)
    expect(targetForHabit(makeHabit({ dailyTarget: undefined }))).toBe(1)
  })

  it('is always 1 for a weekly habit, even if dailyTarget is somehow set', () => {
    expect(targetForHabit(makeHabit({ frequency: 'weekly', dailyTarget: 5 }))).toBe(1)
  })
})

describe('isCounterHabit', () => {
  it('is true only for daily habits with a real target', () => {
    expect(isCounterHabit(makeHabit({ dailyTarget: 3 }))).toBe(true)
    expect(isCounterHabit(makeHabit({ dailyTarget: 1 }))).toBe(false)
    expect(isCounterHabit(makeHabit({ frequency: 'weekly', dailyTarget: 3 }))).toBe(false)
  })
})

describe('isCompletionAtTarget', () => {
  it('is false when there is no record', () => {
    expect(isCompletionAtTarget(undefined, 3)).toBe(false)
  })

  it('treats a legacy/binary row (no count field) as permanently at target', () => {
    const record: HabitCompletion = { id: 'c1', habitId: 'h1', periodId: '2026-07-20', completedAt: 0 }
    expect(isCompletionAtTarget(record, 1)).toBe(true)
    // Even if the habit's target is later raised, a legacy row must never be reinterpreted as incomplete.
    expect(isCompletionAtTarget(record, 5)).toBe(true)
  })

  it('is false for a counter row below target, true once at/above target', () => {
    const below: HabitCompletion = { id: 'c1', habitId: 'h1', periodId: '2026-07-20', completedAt: 0, count: 2 }
    const at: HabitCompletion = { id: 'c2', habitId: 'h1', periodId: '2026-07-21', completedAt: 0, count: 3 }
    expect(isCompletionAtTarget(below, 3)).toBe(false)
    expect(isCompletionAtTarget(at, 3)).toBe(true)
  })
})

describe('progressCountForRecord', () => {
  it('is 0 with no record', () => {
    expect(progressCountForRecord(undefined, 3)).toBe(0)
  })

  it('reads a legacy/binary row as fully at target', () => {
    const record: HabitCompletion = { id: 'c1', habitId: 'h1', periodId: '2026-07-20', completedAt: 0 }
    expect(progressCountForRecord(record, 3)).toBe(3)
  })

  it('returns the real count for a counter row', () => {
    const record: HabitCompletion = { id: 'c1', habitId: 'h1', periodId: '2026-07-20', completedAt: 0, count: 2 }
    expect(progressCountForRecord(record, 3)).toBe(2)
  })
})

describe('filterCompletionsAtTarget', () => {
  it('excludes partial-progress rows and rows for other habits', () => {
    const habit = makeHabit({ dailyTarget: 3 })
    const completions: HabitCompletion[] = [
      { id: 'c1', habitId: 'h1', periodId: '2026-07-19', completedAt: 0, count: 3 },
      { id: 'c2', habitId: 'h1', periodId: '2026-07-20', completedAt: 0, count: 1 },
      { id: 'c3', habitId: 'other', periodId: '2026-07-20', completedAt: 0, count: 3 },
    ]
    const result = filterCompletionsAtTarget(completions, habit)
    expect(result.map((c) => c.id)).toEqual(['c1'])
  })
})
