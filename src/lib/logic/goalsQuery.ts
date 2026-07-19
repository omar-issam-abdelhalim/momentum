import type { Goal } from '@/types/models'
import { sortGoals } from './goalSort'

/**
 * Goals relevant to "right now": weekly goals belonging to the current week
 * plus daily goals scheduled for today. Archived goals are always excluded.
 */
export function selectRelevantGoals(goals: Goal[], todayISO: string, currentWeekId: string): Goal[] {
  return goals.filter((g) => {
    if (g.archived) return false
    if (g.type === 'weekly') return g.currentWeekId === currentWeekId
    return g.dateISO === todayISO
  })
}

export interface GoalBuckets {
  active: Goal[]
  completed: Goal[]
}

export function splitAndSortGoals(goals: Goal[]): GoalBuckets {
  const active = sortGoals(goals.filter((g) => !g.completed))
  const completed = goals
    .filter((g) => g.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  return { active, completed }
}

export function weeklyGoalsOnly(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.type === 'weekly')
}

export function dailyGoalsOnly(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.type === 'daily')
}
