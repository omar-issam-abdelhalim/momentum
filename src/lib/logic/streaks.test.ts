import { describe, expect, it } from 'vitest'
import { computeDailyStreak, computeWeeklyStreak } from './streaks'

describe('computeDailyStreak', () => {
  it('counts a current streak ending today', () => {
    const dates = ['2026-07-20', '2026-07-21', '2026-07-22']
    const { current, best } = computeDailyStreak(dates, '2026-07-22')
    expect(current).toBe(3)
    expect(best).toBe(3)
  })

  it('keeps the streak alive if today is not yet completed but yesterday was', () => {
    const dates = ['2026-07-19', '2026-07-20', '2026-07-21']
    const { current } = computeDailyStreak(dates, '2026-07-22')
    expect(current).toBe(3)
  })

  it('resets current streak to 0 when a day was missed', () => {
    const dates = ['2026-07-18', '2026-07-19']
    const { current } = computeDailyStreak(dates, '2026-07-22')
    expect(current).toBe(0)
  })

  it('tracks best streak separately from current streak', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-20']
    const { current, best } = computeDailyStreak(dates, '2026-07-22')
    expect(best).toBe(5)
    expect(current).toBe(0)
  })

  it('returns 0/0 for no completions', () => {
    expect(computeDailyStreak([], '2026-07-22')).toEqual({ current: 0, best: 0 })
  })

  it('handles a single completion today', () => {
    expect(computeDailyStreak(['2026-07-22'], '2026-07-22')).toEqual({ current: 1, best: 1 })
  })

  it('ignores duplicate period ids', () => {
    const { current, best } = computeDailyStreak(['2026-07-22', '2026-07-22'], '2026-07-22')
    expect(current).toBe(1)
    expect(best).toBe(1)
  })
})

describe('computeWeeklyStreak', () => {
  it('counts consecutive completed weeks', () => {
    const weeks = ['2026-06-27', '2026-07-04', '2026-07-11', '2026-07-18']
    const { current, best } = computeWeeklyStreak(weeks, '2026-07-18')
    expect(current).toBe(4)
    expect(best).toBe(4)
  })

  it('keeps current streak alive if this week is not done yet but last week was', () => {
    const weeks = ['2026-07-04', '2026-07-11']
    const { current } = computeWeeklyStreak(weeks, '2026-07-18')
    expect(current).toBe(2)
  })

  it('breaks the streak when the week immediately before current was missed', () => {
    // 2026-07-11 (the week right before current) was skipped.
    const weeks = ['2026-06-27', '2026-07-04']
    const { current } = computeWeeklyStreak(weeks, '2026-07-18')
    expect(current).toBe(0)
  })
})
