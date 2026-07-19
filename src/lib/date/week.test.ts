import { describe, expect, it } from 'vitest'
import {
  formatDateOnly,
  getCustomWeekEnd,
  getCustomWeekStart,
  getNextWeekId,
  getPreviousWeekId,
  getWeekId,
  getWeekIdsBetweenExclusiveStart,
  isInWeek,
  isNewDay,
  isNewWeek,
  parseDateOnly,
  weekIdToRange,
} from './week'

describe('parseDateOnly / formatDateOnly', () => {
  it('round-trips without timezone shift', () => {
    expect(formatDateOnly(parseDateOnly('2026-07-18'))).toBe('2026-07-18')
    expect(formatDateOnly(parseDateOnly('2026-01-01'))).toBe('2026-01-01')
    expect(formatDateOnly(parseDateOnly('2025-12-31'))).toBe('2025-12-31')
  })
})

describe('getCustomWeekStart / getCustomWeekEnd', () => {
  it('a Saturday is the start of its own week', () => {
    // 2026-07-18 is a Saturday.
    const sat = parseDateOnly('2026-07-18')
    const start = getCustomWeekStart(sat)
    expect(formatDateOnly(start)).toBe('2026-07-18')
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
  })

  it('a Friday is the end of the week that started the prior Saturday', () => {
    // 2026-07-24 is the Friday following 2026-07-18.
    const fri = parseDateOnly('2026-07-24')
    fri.setHours(23, 30)
    const start = getCustomWeekStart(fri)
    const end = getCustomWeekEnd(fri)
    expect(formatDateOnly(start)).toBe('2026-07-18')
    expect(formatDateOnly(end)).toBe('2026-07-24')
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })

  it('a mid-week Wednesday resolves to the correct Saturday-Friday span', () => {
    const wed = parseDateOnly('2026-07-22')
    expect(formatDateOnly(getCustomWeekStart(wed))).toBe('2026-07-18')
    expect(formatDateOnly(getCustomWeekEnd(wed))).toBe('2026-07-24')
  })

  it('handles the Friday 23:59 -> Saturday 00:00 boundary correctly', () => {
    const lateFriday = parseDateOnly('2026-07-24')
    lateFriday.setHours(23, 59, 59, 999)
    const earlySaturday = parseDateOnly('2026-07-25')
    earlySaturday.setHours(0, 0, 0, 0)

    expect(getWeekId(lateFriday)).toBe('2026-07-18')
    expect(getWeekId(earlySaturday)).toBe('2026-07-25')
    expect(getWeekId(lateFriday)).not.toBe(getWeekId(earlySaturday))
  })

  it('handles end-of-month boundaries', () => {
    // 2026-01-31 is a Saturday.
    const jan31 = parseDateOnly('2026-01-31')
    expect(formatDateOnly(getCustomWeekStart(jan31))).toBe('2026-01-31')
    expect(formatDateOnly(getCustomWeekEnd(jan31))).toBe('2026-02-06')
  })

  it('handles end-of-year boundaries', () => {
    // 2026-01-01 is a Thursday; its week starts the prior Saturday 2025-12-27.
    const jan1 = parseDateOnly('2026-01-01')
    expect(formatDateOnly(getCustomWeekStart(jan1))).toBe('2025-12-27')
    expect(formatDateOnly(getCustomWeekEnd(jan1))).toBe('2026-01-02')
  })

  it('handles the leap-year boundary (2028-02-29)', () => {
    // 2028-02-29 is a Tuesday.
    const leapDay = parseDateOnly('2028-02-29')
    expect(formatDateOnly(getCustomWeekStart(leapDay))).toBe('2028-02-26')
    expect(formatDateOnly(getCustomWeekEnd(leapDay))).toBe('2028-03-03')
  })
})

describe('weekIdToRange', () => {
  it('produces a range matching getCustomWeekStart/End', () => {
    const weekId = '2026-07-18'
    const { start, end } = weekIdToRange(weekId)
    expect(formatDateOnly(start)).toBe('2026-07-18')
    expect(formatDateOnly(end)).toBe('2026-07-24')
  })
})

describe('isInWeek', () => {
  it('correctly classifies dates within and outside a week', () => {
    expect(isInWeek(parseDateOnly('2026-07-20'), '2026-07-18')).toBe(true)
    expect(isInWeek(parseDateOnly('2026-07-25'), '2026-07-18')).toBe(false)
    expect(isInWeek(parseDateOnly('2026-07-17'), '2026-07-18')).toBe(false)
  })
})

describe('getPreviousWeekId / getNextWeekId', () => {
  it('moves exactly 7 days', () => {
    expect(getNextWeekId('2026-07-18')).toBe('2026-07-25')
    expect(getPreviousWeekId('2026-07-18')).toBe('2026-07-11')
  })

  it('is inverse of itself', () => {
    const weekId = '2026-07-18'
    expect(getPreviousWeekId(getNextWeekId(weekId))).toBe(weekId)
  })
})

describe('getWeekIdsBetweenExclusiveStart', () => {
  it('returns an empty array when there is no gap', () => {
    expect(getWeekIdsBetweenExclusiveStart('2026-07-18', '2026-07-18')).toEqual([])
  })

  it('returns a single week for a one-week gap', () => {
    expect(getWeekIdsBetweenExclusiveStart('2026-07-18', '2026-07-25')).toEqual(['2026-07-25'])
  })

  it('walks multiple missed weeks in order', () => {
    expect(getWeekIdsBetweenExclusiveStart('2026-07-18', '2026-08-08')).toEqual([
      '2026-07-25',
      '2026-08-01',
      '2026-08-08',
    ])
  })
})

describe('isNewDay / isNewWeek', () => {
  it('treats null as "new"', () => {
    expect(isNewDay(null)).toBe(true)
    expect(isNewWeek(null)).toBe(true)
  })

  it('detects an unchanged day/week as not new', () => {
    const { formatDateOnly: fmt } = { formatDateOnly }
    expect(isNewDay(fmt(new Date()))).toBe(false)
    expect(isNewWeek(getWeekId(new Date()))).toBe(false)
  })
})
