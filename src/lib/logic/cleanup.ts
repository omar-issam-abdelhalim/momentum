import type { Goal } from '@/types/models'
import { getEndOfDay, parseDateOnly } from '@/lib/date/week'

export const CLEANUP_RETENTION_DAYS = 14

/**
 * A detailed goal record may be removed once it's no longer operationally
 * necessary AND has been retained for at least `retentionDays`. Its
 * contribution to long-term stats has already been folded into a
 * WeeklySnapshot by then (snapshots are created when a week closes, which —
 * by construction — happens well within the retention window).
 *
 * Safety rules, in order:
 *   - Incomplete weekly goals are NEVER eligible: rollover keeps them
 *     perpetually attached to the current week until completed or archived,
 *     so an "old, incomplete, still-weekly" goal should not exist, and if it
 *     somehow does, it's still the live state for that goal.
 *   - Completed weekly goals: eligible `retentionDays` after completion.
 *   - Completed daily goals: eligible `retentionDays` after completion.
 *   - Incomplete daily goals: eligible `retentionDays` after their day ended
 *     (the day has passed; there's nothing left to act on).
 */
export function isGoalEligibleForCleanup(goal: Goal, now: number, retentionDays = CLEANUP_RETENTION_DAYS): boolean {
  const thresholdMs = retentionDays * 24 * 60 * 60 * 1000

  if (goal.type === 'weekly') {
    if (!goal.completed || !goal.completedAt) return false
    return now - goal.completedAt >= thresholdMs
  }

  // Daily goal.
  if (goal.completed && goal.completedAt) {
    return now - goal.completedAt >= thresholdMs
  }
  if (goal.dateISO) {
    const dayEnd = getEndOfDay(parseDateOnly(goal.dateISO)).getTime()
    return now - dayEnd >= thresholdMs
  }
  return false
}

export function getGoalsEligibleForCleanup(goals: Goal[], now: number, retentionDays = CLEANUP_RETENTION_DAYS): Goal[] {
  return goals.filter((g) => isGoalEligibleForCleanup(g, now, retentionDays))
}
