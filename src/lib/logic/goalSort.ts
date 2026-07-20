import type { Goal } from '@/types/models'
import { tracksLateness } from './goalKind'

/**
 * Home priority buckets, most urgent first. A future deadline must never
 * outrank a task scheduled for today — but once a deadline reaches today (or
 * is overdue), it dominates. See PROJECT_CONTEXT.md / README for the worked
 * examples this ordering is derived from.
 */
export const PRIORITY_BUCKETS = [
  'overdue-deadline',
  'deadline-today',
  'late-scheduled',
  'scheduled-today',
  'upcoming-deadline',
  'rolled-over-weekly',
  'weekly',
  'other',
] as const

export type PriorityBucket = (typeof PRIORITY_BUCKETS)[number]

export function getPriorityBucket(goal: Goal, todayISO: string): PriorityBucket {
  if (goal.deadlineISO) {
    if (goal.deadlineISO < todayISO) return 'overdue-deadline'
    if (goal.deadlineISO === todayISO) return 'deadline-today'
  }

  if (tracksLateness(goal.kind) && goal.scheduledDateISO && goal.scheduledDateISO < todayISO) {
    return 'late-scheduled'
  }

  const scheduledForToday =
    (goal.kind === 'scheduled' || goal.kind === 'recurring' || goal.kind === 'today') &&
    goal.scheduledDateISO === todayISO
  if (scheduledForToday) return 'scheduled-today'

  if (goal.deadlineISO && goal.deadlineISO > todayISO) return 'upcoming-deadline'

  if (goal.kind === 'weekly') return goal.rolledOver ? 'rolled-over-weekly' : 'weekly'

  return 'other'
}

/**
 * Centralized ordering for the active goals list. Primary key is the
 * priority bucket above; secondary ordering within each bucket follows the
 * product rules (see README "Home priority" section):
 *   - overdue-deadline: most overdue first (earliest deadline first)
 *   - deadline-today: deterministic (createdAt) — no time-of-day deadlines
 *   - late-scheduled: oldest scheduled date first (most late)
 *   - scheduled-today: deterministic (createdAt)
 *   - upcoming-deadline: nearest deadline first
 *   - rolled-over-weekly: oldest original week first, then createdAt
 *   - weekly / other: deterministic (createdAt)
 * `createdAt` ascending is always the final tiebreaker.
 */
export function sortGoals(goals: Goal[], todayISO: string): Goal[] {
  return [...goals].sort((a, b) => {
    const bucketA = getPriorityBucket(a, todayISO)
    const bucketB = getPriorityBucket(b, todayISO)
    const rankA = PRIORITY_BUCKETS.indexOf(bucketA)
    const rankB = PRIORITY_BUCKETS.indexOf(bucketB)
    if (rankA !== rankB) return rankA - rankB

    switch (bucketA) {
      case 'overdue-deadline':
      case 'upcoming-deadline': {
        const cmp = (a.deadlineISO as string).localeCompare(b.deadlineISO as string)
        if (cmp !== 0) return cmp
        break
      }
      case 'late-scheduled': {
        const cmp = (a.scheduledDateISO as string).localeCompare(b.scheduledDateISO as string)
        if (cmp !== 0) return cmp
        break
      }
      case 'rolled-over-weekly': {
        const cmp = (a.originalWeekId ?? '').localeCompare(b.originalWeekId ?? '')
        if (cmp !== 0) return cmp
        break
      }
      default:
        break
    }

    return a.createdAt - b.createdAt
  })
}
