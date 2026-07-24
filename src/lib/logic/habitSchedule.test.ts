import { describe, expect, it } from 'vitest'
import { hasWeekdayRestriction, isHabitDueOnDate } from './habitSchedule'
import type { Habit } from '@/types/models'

function makeHabit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    name: 'Habit',
    frequency: 'daily',
    order: 0,
    status: 'active',
    epochs: [{ id: 'e1', startDate: 0, endDate: null }],
    createdAt: 0,
    ...overrides,
  }
}

describe('isHabitDueOnDate', () => {
  it('is due every day for unrestricted daily habits', () => {
    const habit = makeHabit({ frequency: 'daily' })
    expect(isHabitDueOnDate(habit, '2026-07-20')).toBe(true) // Monday
    expect(isHabitDueOnDate(habit, '2026-07-21')).toBe(true) // Tuesday
  })

  it('is due only on the configured weekdays for a restricted daily habit', () => {
    // Mon/Wed/Fri => getDay() 1, 3, 5
    const habit = makeHabit({ frequency: 'daily', weekdays: [1, 3, 5] })
    expect(isHabitDueOnDate(habit, '2026-07-20')).toBe(true) // Monday
    expect(isHabitDueOnDate(habit, '2026-07-21')).toBe(false) // Tuesday
    expect(isHabitDueOnDate(habit, '2026-07-22')).toBe(true) // Wednesday
    expect(isHabitDueOnDate(habit, '2026-07-23')).toBe(false) // Thursday
    expect(isHabitDueOnDate(habit, '2026-07-24')).toBe(true) // Friday
  })

  it('is never day-addressable for weekly-frequency habits', () => {
    const habit = makeHabit({ frequency: 'weekly' })
    expect(isHabitDueOnDate(habit, '2026-07-20')).toBe(false)
  })

  it('treats an empty weekdays array as unrestricted (due every day)', () => {
    const habit = makeHabit({ frequency: 'daily', weekdays: [] })
    expect(isHabitDueOnDate(habit, '2026-07-21')).toBe(true)
  })
})

describe('hasWeekdayRestriction', () => {
  it('is false for unrestricted daily and for weekly habits', () => {
    expect(hasWeekdayRestriction(makeHabit({ frequency: 'daily' }))).toBe(false)
    expect(hasWeekdayRestriction(makeHabit({ frequency: 'weekly' }))).toBe(false)
  })

  it('is true only when a non-empty weekdays list is set on a daily habit', () => {
    expect(hasWeekdayRestriction(makeHabit({ frequency: 'daily', weekdays: [1, 3, 5] }))).toBe(true)
  })
})
