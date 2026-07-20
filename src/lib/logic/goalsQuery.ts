import type { Goal } from '@/types/models'
import { sortGoals } from './goalSort'
import { isActiveToday } from './goalKind'

/** Is this goal something the user still needs to act on, right now? */
export function isRelevantActive(goal: Goal, todayISO: string, currentWeekId: string): boolean {
  if (goal.archived || goal.completed) return false
  if (goal.kind === 'weekly') return goal.currentWeekId === currentWeekId
  return isActiveToday(goal, todayISO)
}

/**
 * Completed during the current custom week — regardless of kind, and
 * regardless of how "late" it was when finished. This is what keeps
 * completed items visible in Home's collapsed Completed section for the
 * rest of the week they were finished in (see README "Completed this week").
 */
export function isCompletedThisWeek(goal: Goal, weekStartMs: number, weekEndMs: number): boolean {
  if (goal.archived || !goal.completed || !goal.completedAt) return false
  return goal.completedAt >= weekStartMs && goal.completedAt <= weekEndMs
}

/** Goals relevant to Home: active items needing action, plus anything completed this custom week. */
export function selectRelevantGoals(
  goals: Goal[],
  todayISO: string,
  currentWeekId: string,
  weekStartMs: number,
  weekEndMs: number,
): Goal[] {
  return goals.filter(
    (g) => isRelevantActive(g, todayISO, currentWeekId) || isCompletedThisWeek(g, weekStartMs, weekEndMs),
  )
}

export interface GoalBuckets {
  active: Goal[]
  completed: Goal[]
}

export function splitAndSortGoals(goals: Goal[], todayISO: string): GoalBuckets {
  const active = sortGoals(
    goals.filter((g) => !g.completed),
    todayISO,
  )
  const completed = goals
    .filter((g) => g.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  return { active, completed }
}
