import { describe, expect, it } from 'vitest'
import { daysUntilDeadline, getDeadlineUrgency, isOverdue } from './deadline'

const TODAY = '2026-07-22'

describe('getDeadlineUrgency', () => {
  it('returns "none" when there is no deadline', () => {
    expect(getDeadlineUrgency(undefined, TODAY)).toBe('none')
  })

  it('returns "overdue" for a past deadline', () => {
    expect(getDeadlineUrgency('2026-07-21', TODAY)).toBe('overdue')
  })

  it('returns "today" for a deadline of today', () => {
    expect(getDeadlineUrgency('2026-07-22', TODAY)).toBe('today')
  })

  it('returns "tomorrow" for a deadline of tomorrow', () => {
    expect(getDeadlineUrgency('2026-07-23', TODAY)).toBe('tomorrow')
  })

  it('returns "upcoming" for a deadline further out', () => {
    expect(getDeadlineUrgency('2026-08-01', TODAY)).toBe('upcoming')
  })

  it('handles a deadline crossing a month boundary as "tomorrow"', () => {
    expect(getDeadlineUrgency('2026-08-01', '2026-07-31')).toBe('tomorrow')
  })
})

describe('isOverdue', () => {
  it('mirrors getDeadlineUrgency', () => {
    expect(isOverdue('2026-07-01', TODAY)).toBe(true)
    expect(isOverdue('2026-07-22', TODAY)).toBe(false)
    expect(isOverdue(undefined, TODAY)).toBe(false)
  })
})

describe('daysUntilDeadline', () => {
  it('computes whole-day differences', () => {
    expect(daysUntilDeadline('2026-07-25', TODAY)).toBe(3)
    expect(daysUntilDeadline('2026-07-22', TODAY)).toBe(0)
    expect(daysUntilDeadline('2026-07-20', TODAY)).toBe(-2)
  })
})
