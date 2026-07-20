import type { Goal } from '@/types/models'
import { parseDateOnly } from '@/lib/date/week'

/**
 * Detailed Goal records are retained for a deterministic ~2 calendar-year
 * window: a record "belonging to" year Y remains available throughout Y and
 * Y+1, and becomes eligible for purge once the current year is Y+2 or later
 * (e.g. a 2026 record is purged once 2028 begins). Its contribution to
 * long-term Analytics has already been folded permanently into a
 * WeeklySnapshot by then (snapshots are created when a week closes, which —
 * by construction — happens well within this window).
 *
 * Safety rules, in order:
 *   - Incomplete Scheduled / Recurring / Weekly goals are NEVER eligible:
 *     they stay perpetually active (possibly "Late") until completed,
 *     rolled over, or manually deleted — an "old, incomplete" one is still
 *     the live state for that task.
 *   - Incomplete Today Only tasks ARE eligible once their assigned day is
 *     more than `retentionYears` calendar years in the past — they stop
 *     being actionable the moment their day ends, so there is nothing left
 *     to preserve beyond the retention window.
 *   - Completed goals of any kind: eligible once `retentionYears` calendar
 *     years have passed since completion.
 *   - Archived goals: eligible on the same schedule, keyed off completion
 *     date if completed, otherwise creation date.
 */
export const RETENTION_YEARS = 2

function yearOf(ms: number): number {
  return new Date(ms).getFullYear()
}

export function isGoalEligibleForRetentionCleanup(goal: Goal, now: number, retentionYears = RETENTION_YEARS): boolean {
  const currentYear = yearOf(now)

  if (goal.archived) {
    const recordYear = goal.completed && goal.completedAt ? yearOf(goal.completedAt) : yearOf(goal.createdAt)
    return currentYear - recordYear >= retentionYears
  }

  if (goal.completed) {
    if (!goal.completedAt) return false
    return currentYear - yearOf(goal.completedAt) >= retentionYears
  }

  if (goal.kind === 'today') {
    if (!goal.scheduledDateISO) return false
    const recordYear = parseDateOnly(goal.scheduledDateISO).getFullYear()
    return currentYear - recordYear >= retentionYears
  }

  // Incomplete scheduled / recurring / weekly goals: always potentially
  // active or Late — never eligible for retention cleanup.
  return false
}

export function getGoalsEligibleForRetentionCleanup(
  goals: Goal[],
  now: number,
  retentionYears = RETENTION_YEARS,
): Goal[] {
  return goals.filter((g) => isGoalEligibleForRetentionCleanup(g, now, retentionYears))
}
