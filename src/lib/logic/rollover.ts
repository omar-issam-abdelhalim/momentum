import type { Goal, WeeklySnapshot } from '@/types/models'
import { getEndOfDay, parseDateOnly, weekIdToRange } from '@/lib/date/week'

/** Weekly, incomplete, non-archived goals — the ones that roll into the next week. */
export function getGoalsToRollover(weekGoals: Goal[]): Goal[] {
  return weekGoals.filter((g) => g.type === 'weekly' && !g.completed && !g.archived)
}

/**
 * Pure transform: moves a goal into the next week. This mutates the same
 * logical goal record (rather than creating a copy), which is what makes
 * rollover duplicate-proof — a goal only ever has one `currentWeekId` at a
 * time, so re-running rollover against already-moved goals is a no-op.
 */
export function applyRollover(goal: Goal, toWeekId: string): Goal {
  return {
    ...goal,
    currentWeekId: toWeekId,
    rolledOver: true,
    rolloverCount: goal.rolloverCount + 1,
  }
}

/**
 * Builds the immutable aggregate record for a week that is closing, from
 * the goals that belonged to it (by currentWeekId) at close time — i.e.
 * before rollover moves the incomplete ones forward.
 */
export function buildWeeklySnapshot(weekId: string, goalsInWeek: Goal[]): WeeklySnapshot {
  const { start, end } = weekIdToRange(weekId)
  const weekly = goalsInWeek.filter((g) => g.type === 'weekly' && !g.archived)
  const daily = goalsInWeek.filter((g) => g.type === 'daily' && !g.archived)

  const totalPlanned = weekly.length
  const completed = weekly.filter((g) => g.completed).length
  const notCompleted = totalPlanned - completed
  const completionPct = totalPlanned === 0 ? 0 : Math.round((completed / totalPlanned) * 100)

  const withDeadlineGoals = weekly.filter((g) => g.deadlineISO)
  const withDeadline = withDeadlineGoals.length
  let completedBeforeDeadline = 0
  let completedAfterDeadline = 0
  for (const g of withDeadlineGoals) {
    if (!g.completed || !g.completedAt || !g.deadlineISO) continue
    const deadlineEnd = getEndOfDay(parseDateOnly(g.deadlineISO)).getTime()
    if (g.completedAt <= deadlineEnd) completedBeforeDeadline++
    else completedAfterDeadline++
  }

  return {
    weekId,
    weekStart: start.getTime(),
    weekEnd: end.getTime(),
    totalPlanned,
    completed,
    notCompleted,
    completionPct,
    rolledOver: notCompleted,
    withDeadline,
    completedBeforeDeadline,
    completedAfterDeadline,
    dailyGoalsPlanned: daily.length,
    dailyGoalsCompleted: daily.filter((g) => g.completed).length,
    createdAt: Date.now(),
  }
}
