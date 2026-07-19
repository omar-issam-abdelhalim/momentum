import { describe, expect, it } from 'vitest'
import { sortGoals } from './goalSort'
import type { Goal } from '@/types/models'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Goal',
    type: 'weekly',
    createdAt: 0,
    completedAt: null,
    completed: false,
    originalWeekId: '2026-07-18',
    currentWeekId: '2026-07-18',
    rolledOver: false,
    rolloverCount: 0,
    archived: false,
    ...overrides,
  }
}

describe('sortGoals', () => {
  it('puts deadline goals first, sorted by nearest deadline', () => {
    const a = makeGoal({ id: 'a', deadlineISO: '2026-07-25' })
    const b = makeGoal({ id: 'b', deadlineISO: '2026-07-20' })
    const c = makeGoal({ id: 'c', deadlineISO: '2026-07-22' })
    const noDeadline = makeGoal({ id: 'd' })
    const sorted = sortGoals([a, noDeadline, c, b])
    expect(sorted.map((g) => g.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('places rolled-over goals after deadline goals but before new goals', () => {
    const deadline = makeGoal({ id: 'deadline', deadlineISO: '2026-07-20' })
    const rolled = makeGoal({ id: 'rolled', rolledOver: true, originalWeekId: '2026-07-04' })
    const fresh = makeGoal({ id: 'fresh', createdAt: 100 })
    const sorted = sortGoals([fresh, rolled, deadline])
    expect(sorted.map((g) => g.id)).toEqual(['deadline', 'rolled', 'fresh'])
  })

  it('orders rolled-over goals by oldest original week first', () => {
    const older = makeGoal({ id: 'older', rolledOver: true, originalWeekId: '2026-06-27' })
    const newer = makeGoal({ id: 'newer', rolledOver: true, originalWeekId: '2026-07-11' })
    const sorted = sortGoals([newer, older])
    expect(sorted.map((g) => g.id)).toEqual(['older', 'newer'])
  })

  it('orders new no-deadline goals by creation time ascending', () => {
    const first = makeGoal({ id: 'first', createdAt: 10 })
    const second = makeGoal({ id: 'second', createdAt: 20 })
    const sorted = sortGoals([second, first])
    expect(sorted.map((g) => g.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const goals = [makeGoal({ id: 'a', createdAt: 2 }), makeGoal({ id: 'b', createdAt: 1 })]
    const copy = [...goals]
    sortGoals(goals)
    expect(goals).toEqual(copy)
  })
})
