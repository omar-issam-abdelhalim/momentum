import { describe, expect, it } from 'vitest'
import { datesNeedingOccurrence, matchesRecurrence } from './recurrence'
import type { RecurringDefinition } from '@/types/models'

function makeDef(overrides: Partial<RecurringDefinition>): RecurringDefinition {
  return {
    id: 'r1',
    title: 'Study lecture',
    recurrenceType: 'daily',
    active: true,
    createdAt: 0,
    lastGeneratedThroughISO: null,
    ...overrides,
  }
}

describe('matchesRecurrence', () => {
  it('daily recurrence matches every day', () => {
    const def = makeDef({ recurrenceType: 'daily' })
    expect(matchesRecurrence(def, '2026-07-20')).toBe(true)
    expect(matchesRecurrence(def, '2026-07-21')).toBe(true)
  })

  it('weekly recurrence matches only the configured weekday(s)', () => {
    // 2026-07-21 is a Tuesday (weekday 2).
    const def = makeDef({ recurrenceType: 'weekly', weekdays: [2] })
    expect(matchesRecurrence(def, '2026-07-21')).toBe(true)
    expect(matchesRecurrence(def, '2026-07-22')).toBe(false)
  })

  it('supports multiple selected weekdays', () => {
    const def = makeDef({ recurrenceType: 'weekly', weekdays: [1, 3, 5] }) // Mon/Wed/Fri
    expect(matchesRecurrence(def, '2026-07-20')).toBe(true) // Monday
    expect(matchesRecurrence(def, '2026-07-22')).toBe(true) // Wednesday
    expect(matchesRecurrence(def, '2026-07-21')).toBe(false) // Tuesday
  })
})

describe('datesNeedingOccurrence', () => {
  it('generates every matching day between the cursor (exclusive) and today (inclusive)', () => {
    const def = makeDef({ recurrenceType: 'daily' })
    const dates = datesNeedingOccurrence(def, '2026-07-18', '2026-07-21')
    expect(dates).toEqual(['2026-07-19', '2026-07-20', '2026-07-21'])
  })

  it('is empty when the cursor already reached the target date', () => {
    const def = makeDef({ recurrenceType: 'daily' })
    expect(datesNeedingOccurrence(def, '2026-07-21', '2026-07-21')).toEqual([])
  })

  it('only returns matching weekdays within the range', () => {
    const def = makeDef({ recurrenceType: 'weekly', weekdays: [2] }) // Tuesdays
    const dates = datesNeedingOccurrence(def, '2026-07-07', '2026-07-21')
    expect(dates).toEqual(['2026-07-14', '2026-07-21'])
  })

  it('generates a new occurrence date even when an earlier one would still be Late', () => {
    // Simulates: last generated through July 7 (a Tuesday), now July 15 —
    // both July 7 and July 14 occurrences should be produced independently.
    const def = makeDef({ recurrenceType: 'weekly', weekdays: [2] })
    const dates = datesNeedingOccurrence(def, '2026-07-06', '2026-07-15')
    expect(dates).toEqual(['2026-07-07', '2026-07-14'])
  })
})
