import { describe, expect, it } from 'vitest'
import { getPriorityBucket, sortGoals } from './goalSort'
import type { Goal } from '@/types/models'

const TODAY = '2026-07-22' // a Wednesday

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? Math.random().toString(36),
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

describe('getPriorityBucket', () => {
  it('classifies an overdue deadline first, ahead of everything else', () => {
    const g = makeGoal({ deadlineISO: '2026-07-20', scheduledDateISO: TODAY })
    expect(getPriorityBucket(g, TODAY)).toBe('overdue-deadline')
  })

  it('classifies a deadline of today as deadline-today, ahead of scheduled-today', () => {
    const g = makeGoal({ deadlineISO: TODAY })
    expect(getPriorityBucket(g, TODAY)).toBe('deadline-today')
  })

  it('classifies a scheduled/recurring goal whose date has passed as late-scheduled', () => {
    const g = makeGoal({ kind: 'scheduled', scheduledDateISO: '2026-07-20' })
    expect(getPriorityBucket(g, TODAY)).toBe('late-scheduled')
    const recurring = makeGoal({ kind: 'recurring', scheduledDateISO: '2026-07-20' })
    expect(getPriorityBucket(recurring, TODAY)).toBe('late-scheduled')
  })

  it('classifies scheduled/today/recurring goals due today as scheduled-today', () => {
    expect(getPriorityBucket(makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY }), TODAY)).toBe('scheduled-today')
    expect(getPriorityBucket(makeGoal({ kind: 'today', scheduledDateISO: TODAY }), TODAY)).toBe('scheduled-today')
    expect(getPriorityBucket(makeGoal({ kind: 'recurring', scheduledDateISO: TODAY }), TODAY)).toBe('scheduled-today')
  })

  it('classifies a future deadline with no scheduled-today conflict as upcoming-deadline', () => {
    const g = makeGoal({ kind: 'scheduled', deadlineISO: '2026-07-25' })
    expect(getPriorityBucket(g, TODAY)).toBe('upcoming-deadline')
  })

  it('a future deadline never outranks a task scheduled for today', () => {
    const scheduledToday = makeGoal({ kind: 'scheduled', scheduledDateISO: TODAY })
    const futureDeadline = makeGoal({ kind: 'scheduled', deadlineISO: '2026-07-25' })
    expect(getPriorityBucket(scheduledToday, TODAY)).toBe('scheduled-today')
    expect(getPriorityBucket(futureDeadline, TODAY)).toBe('upcoming-deadline')
  })

  it('classifies rolled-over vs plain weekly goals', () => {
    expect(getPriorityBucket(makeGoal({ kind: 'weekly', rolledOver: true }), TODAY)).toBe('rolled-over-weekly')
    expect(getPriorityBucket(makeGoal({ kind: 'weekly', rolledOver: false }), TODAY)).toBe('weekly')
  })
})

describe('sortGoals — worked examples from the product spec', () => {
  it('example 1: today = Monday — a task scheduled today outranks a task with a future deadline', () => {
    const MON = '2026-07-20'
    const scheduledMonday = makeGoal({ id: 'A', title: 'Study Monday Lecture', kind: 'scheduled', scheduledDateISO: MON })
    const futureDeadline = makeGoal({ id: 'B', title: 'Finish Project', kind: 'scheduled', deadlineISO: '2026-07-21' })
    const sorted = sortGoals([futureDeadline, scheduledMonday], MON)
    expect(sorted.map((g) => g.id)).toEqual(['A', 'B'])
  })

  it('example 2: today = Tuesday — a deadline due today outranks a task scheduled today', () => {
    const TUE = '2026-07-21'
    const scheduledTuesday = makeGoal({ id: 'A', title: 'Study Tuesday Lecture', kind: 'scheduled', scheduledDateISO: TUE })
    const deadlineToday = makeGoal({ id: 'B', title: 'Finish Project', kind: 'scheduled', deadlineISO: TUE })
    const sorted = sortGoals([scheduledTuesday, deadlineToday], TUE)
    expect(sorted.map((g) => g.id)).toEqual(['B', 'A'])
  })

  it('sorts overdue deadlines with the most-overdue first', () => {
    const a = makeGoal({ id: 'a', deadlineISO: '2026-07-20' })
    const b = makeGoal({ id: 'b', deadlineISO: '2026-07-15' })
    const sorted = sortGoals([a, b], TODAY)
    expect(sorted.map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('sorts upcoming deadlines nearest first', () => {
    const far = makeGoal({ id: 'far', deadlineISO: '2026-08-01' })
    const near = makeGoal({ id: 'near', deadlineISO: '2026-07-25' })
    const sorted = sortGoals([far, near], TODAY)
    expect(sorted.map((g) => g.id)).toEqual(['near', 'far'])
  })

  it('sorts late-scheduled tasks with the oldest scheduled date (most late) first', () => {
    const recent = makeGoal({ id: 'recent', kind: 'scheduled', scheduledDateISO: '2026-07-21' })
    const old = makeGoal({ id: 'old', kind: 'scheduled', scheduledDateISO: '2026-07-10' })
    const sorted = sortGoals([recent, old], TODAY)
    expect(sorted.map((g) => g.id)).toEqual(['old', 'recent'])
  })

  it('orders rolled-over weekly goals by oldest original week first', () => {
    const older = makeGoal({ id: 'older', kind: 'weekly', rolledOver: true, originalWeekId: '2026-06-27' })
    const newer = makeGoal({ id: 'newer', kind: 'weekly', rolledOver: true, originalWeekId: '2026-07-11' })
    const sorted = sortGoals([newer, older], TODAY)
    expect(sorted.map((g) => g.id)).toEqual(['older', 'newer'])
  })

  it('orders same-bucket items by creation time ascending as the final tiebreak', () => {
    const first = makeGoal({ id: 'first', kind: 'weekly', createdAt: 10 })
    const second = makeGoal({ id: 'second', kind: 'weekly', createdAt: 20 })
    const sorted = sortGoals([second, first], TODAY)
    expect(sorted.map((g) => g.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const goals = [makeGoal({ id: 'a', kind: 'weekly', createdAt: 2 }), makeGoal({ id: 'b', kind: 'weekly', createdAt: 1 })]
    const copy = [...goals]
    sortGoals(goals, TODAY)
    expect(goals).toEqual(copy)
  })
})
