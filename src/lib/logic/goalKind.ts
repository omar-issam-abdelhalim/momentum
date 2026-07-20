import type { Goal } from '@/types/models'

/** Kinds that persist and become "Late" if their scheduled date passes uncompleted. */
export function tracksLateness(kind: Goal['kind']): boolean {
  return kind === 'scheduled' || kind === 'recurring'
}

/** True if `goal` is currently overdue relative to its own scheduled date (not a deadline). */
export function isLate(goal: Goal, todayISO: string): boolean {
  if (goal.completed || goal.archived) return false
  if (!tracksLateness(goal.kind) || !goal.scheduledDateISO) return false
  return goal.scheduledDateISO < todayISO
}

/** Whole number of days a scheduled/recurring goal is currently late, or 0 if not late. */
export function lateDays(goal: Goal, todayISO: string): number {
  if (!isLate(goal, todayISO) || !goal.scheduledDateISO) return 0
  const [y1, m1, d1] = goal.scheduledDateISO.split('-').map(Number)
  const [y2, m2, d2] = todayISO.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

/**
 * Whether this goal counts as "active right now" for Home, independent of
 * which custom week or day it belongs to. Weekly goals are matched by the
 * caller against currentWeekId separately (see goalsQuery.ts) since that
 * needs live week context; this only covers day-based kinds.
 */
export function isActiveToday(goal: Goal, todayISO: string): boolean {
  if (goal.completed || goal.archived) return false
  if (!goal.scheduledDateISO) return false
  switch (goal.kind) {
    case 'today':
      return goal.scheduledDateISO === todayISO
    case 'scheduled':
    case 'recurring':
      return goal.scheduledDateISO <= todayISO
    default:
      return false
  }
}

/** A Today Only task whose day has passed without completion — expired, never active again. */
export function isExpiredTodayOnly(goal: Goal, todayISO: string): boolean {
  if (goal.kind !== 'today' || goal.completed || goal.archived) return false
  return !!goal.scheduledDateISO && goal.scheduledDateISO < todayISO
}
