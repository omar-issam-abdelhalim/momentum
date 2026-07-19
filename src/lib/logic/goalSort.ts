import type { Goal } from '@/types/models'

/**
 * Centralized ordering for the active goals list, per the product priority
 * rules:
 *   1. Goals with a deadline, nearest deadline first.
 *   2. Rolled-over incomplete goals (no deadline), oldest original week first.
 *   3. New goals without a deadline, oldest created first.
 */
export function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const rankA = rankOf(a)
    const rankB = rankOf(b)
    if (rankA !== rankB) return rankA - rankB

    if (rankA === 0) {
      // Both have deadlines: nearest first, then oldest created first.
      const cmp = (a.deadlineISO as string).localeCompare(b.deadlineISO as string)
      if (cmp !== 0) return cmp
      return a.createdAt - b.createdAt
    }

    if (rankA === 1) {
      // Both are rolled-over, no deadline: older original week first.
      const cmp = a.originalWeekId.localeCompare(b.originalWeekId)
      if (cmp !== 0) return cmp
      return a.createdAt - b.createdAt
    }

    // Both are new, no deadline: oldest created first.
    return a.createdAt - b.createdAt
  })
}

function rankOf(goal: Goal): 0 | 1 | 2 {
  if (goal.deadlineISO) return 0
  if (goal.rolledOver) return 1
  return 2
}
