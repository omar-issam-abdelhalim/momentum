import { describe, expect, it } from 'vitest'
import { classifyDailyEpochGrid, classifyWeeklyEpochGrid, groupByMonth } from './habitGrid'
import type { Habit, HabitCompletion, HabitEpoch } from '@/types/models'

function ts(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getTime()
}

function makeHabit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    name: 'Habit',
    frequency: 'daily',
    order: 0,
    status: 'active',
    epochs: [{ id: 'e1', startDate: ts(2026, 7, 1), endDate: null }],
    createdAt: ts(2026, 7, 1),
    ...overrides,
  }
}

function completion(habitId: string, periodId: string): HabitCompletion {
  return { id: `c-${periodId}`, habitId, periodId, completedAt: 0 }
}

function findDay(rows: ReturnType<typeof classifyDailyEpochGrid>, dateISO: string) {
  for (const row of rows) {
    const day = row.days.find((d) => d.dateISO === dateISO)
    if (day) return day
  }
  return undefined
}

describe('classifyDailyEpochGrid', () => {
  it('never marks a non-scheduled weekday as missed for a Mon/Wed/Fri habit', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null } // Monday
    const habit = makeHabit({ weekdays: [1, 3, 5], epochs: [epoch] })
    const rows = classifyDailyEpochGrid(habit, epoch, [], '2026-07-24') // through Friday

    expect(findDay(rows, '2026-07-21')?.state).toBe('not-scheduled') // Tuesday
    expect(findDay(rows, '2026-07-23')?.state).toBe('not-scheduled') // Thursday
    expect(findDay(rows, '2026-07-21')?.state).not.toBe('missed')
    expect(findDay(rows, '2026-07-23')?.state).not.toBe('missed')
  })

  it('marks a due day with no completion as missed, and a completed due day as completed', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null }
    const habit = makeHabit({ weekdays: [1, 3, 5], epochs: [epoch] })
    const completions = [completion(habit.id, '2026-07-20')]
    const rows = classifyDailyEpochGrid(habit, epoch, completions, '2026-07-24')

    expect(findDay(rows, '2026-07-20')?.state).toBe('completed') // Monday, completed
    expect(findDay(rows, '2026-07-22')?.state).toBe('missed') // Wednesday, due but not completed
  })

  it('never renders an incomplete today as missed — the day is not over yet, so it reads as future', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null }
    const habit = makeHabit({ epochs: [epoch] })
    const rows = classifyDailyEpochGrid(habit, epoch, [], '2026-07-22')

    expect(findDay(rows, '2026-07-22')?.state).toBe('future')
  })

  it('still renders a completed today as completed', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null }
    const habit = makeHabit({ epochs: [epoch] })
    const completions = [completion(habit.id, '2026-07-22')]
    const rows = classifyDailyEpochGrid(habit, epoch, completions, '2026-07-22')

    expect(findDay(rows, '2026-07-22')?.state).toBe('completed')
  })

  it('never renders a day after today as missed — it is future', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 20), endDate: null }
    const habit = makeHabit({ epochs: [epoch] })
    const rows = classifyDailyEpochGrid(habit, epoch, [], '2026-07-21')

    expect(findDay(rows, '2026-07-22')?.state).toBe('future')
    expect(findDay(rows, '2026-07-22')?.state).not.toBe('missed')
  })

  it('renders days outside the epoch range (week-row padding) as not-scheduled, never as missed', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 22), endDate: null } // mid-week Wednesday
    const habit = makeHabit({ epochs: [epoch] })
    const rows = classifyDailyEpochGrid(habit, epoch, [], '2026-07-22')

    // The same week-row's Saturday/Sunday/Monday/Tuesday precede the epoch start.
    expect(findDay(rows, '2026-07-18')?.state).toBe('not-scheduled')
    expect(findDay(rows, '2026-07-18')?.state).not.toBe('missed')
  })

  it('a closed epoch grid never renders a paused band within it', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 1), endDate: ts(2026, 7, 15) }
    const habit = makeHabit({ epochs: [epoch] })
    const rows = classifyDailyEpochGrid(habit, epoch, [], '2026-07-25')

    const allStates = rows.flatMap((r) => r.days.map((d) => d.state))
    expect(allStates).not.toContain('paused')
  })
})

describe('classifyWeeklyEpochGrid', () => {
  it('classifies the open current week as in-progress, not missed, while incomplete', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 4), endDate: null }
    const habit = makeHabit({ frequency: 'weekly', epochs: [epoch] })
    const rows = classifyWeeklyEpochGrid(habit, epoch, [], '2026-07-11')

    const currentWeekRow = rows.find((r) => r.weekId === '2026-07-11')
    expect(currentWeekRow?.state).toBe('in-progress')
  })

  it('marks a fully-elapsed incomplete week as missed and a completed one as completed', () => {
    const epoch: HabitEpoch = { id: 'e1', startDate: ts(2026, 7, 4), endDate: null }
    const habit = makeHabit({ frequency: 'weekly', epochs: [epoch] })
    const completions = [completion(habit.id, '2026-07-04')]
    const rows = classifyWeeklyEpochGrid(habit, epoch, completions, '2026-07-18')

    expect(rows.find((r) => r.weekId === '2026-07-04')?.state).toBe('completed')
    expect(rows.find((r) => r.weekId === '2026-07-11')?.state).toBe('missed')
  })
})

describe('groupByMonth', () => {
  it('groups rows into month sections, most recent month first', () => {
    const rows = [{ weekId: '2026-05-30' }, { weekId: '2026-07-04' }, { weekId: '2026-06-06' }]
    const sections = groupByMonth(rows)
    expect(sections.map((s) => s.monthKey)).toEqual(['2026-07', '2026-06', '2026-05'])
  })

  it('scales to many months without losing any rows (supports lazy-loading a long history)', () => {
    const rows = Array.from({ length: 104 }, (_, i) => ({ weekId: `2024-${String((i % 12) + 1).padStart(2, '0')}-0${(i % 4) + 1}` }))
    const sections = groupByMonth(rows)
    const totalRows = sections.reduce((sum, s) => sum + s.weeks.length, 0)
    expect(totalRows).toBe(rows.length)
    expect(sections.length).toBeGreaterThan(1)
  })
})
