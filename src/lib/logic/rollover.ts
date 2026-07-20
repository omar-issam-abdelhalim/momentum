import type { Goal, WeeklySnapshot } from '@/types/models'
import { formatDateOnly, getEndOfDay, parseDateOnly, weekIdToRange } from '@/lib/date/week'

/** Whole days between a scheduledDateISO and the day a goal was actually completed. 0 if not completed late. */
function lateDaysAtCompletion(goal: Goal): number {
  if (!goal.completed || !goal.completedAt || !goal.scheduledDateISO) return 0
  const completedDateISO = formatDateOnly(new Date(goal.completedAt))
  if (completedDateISO <= goal.scheduledDateISO) return 0
  const a = parseDateOnly(goal.scheduledDateISO).getTime()
  const b = parseDateOnly(completedDateISO).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

/** Weekly, incomplete, non-archived goals — the ones that roll into the next week. */
export function getGoalsToRollover(weekGoals: Goal[]): Goal[] {
  return weekGoals.filter((g) => g.kind === 'weekly' && !g.completed && !g.archived)
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
 * Builds the immutable aggregate record for a week that is closing. `pool`
 * must contain the union of: goals whose currentWeekId is this week (weekly
 * goals), goals whose scheduledDateISO falls in this week (scheduled/today/
 * recurring), and goals whose deadlineISO falls in this week (any kind) —
 * deduplicated by id. Each metric below re-filters `pool` for the precise
 * condition it needs, so it's safe for `pool` to be a superset.
 */
export function buildWeeklySnapshot(weekId: string, pool: Goal[]): WeeklySnapshot {
  const { start, end } = weekIdToRange(weekId)
  const weekStartISO = formatDateOnly(start)
  const weekEndISO = formatDateOnly(end)
  const inWeek = (iso: string | undefined) => !!iso && iso >= weekStartISO && iso <= weekEndISO

  const weekly = pool.filter((g) => g.kind === 'weekly' && g.currentWeekId === weekId && !g.archived)
  const weeklyCompleted = weekly.filter((g) => g.completed).length

  const scheduled = pool.filter((g) => g.kind === 'scheduled' && !g.archived && inWeek(g.scheduledDateISO))
  const scheduledCompleted = scheduled.filter((g) => g.completed)
  const scheduledLateDays = scheduledCompleted.map(lateDaysAtCompletion).filter((d) => d > 0)

  const todayOnly = pool.filter((g) => g.kind === 'today' && !g.archived && inWeek(g.scheduledDateISO))
  const todayOnlyCompleted = todayOnly.filter((g) => g.completed).length

  const recurring = pool.filter((g) => g.kind === 'recurring' && !g.archived && inWeek(g.scheduledDateISO))
  const recurringCompleted = recurring.filter((g) => g.completed)
  const recurringLateDays = recurringCompleted.map(lateDaysAtCompletion).filter((d) => d > 0)

  const withDeadline = pool.filter((g) => !g.archived && inWeek(g.deadlineISO))
  let deadlinesMetOnTime = 0
  let deadlinesMetLate = 0
  let deadlinesMissed = 0
  for (const g of withDeadline) {
    if (!g.deadlineISO) continue
    if (!g.completed || !g.completedAt) {
      deadlinesMissed++
      continue
    }
    const deadlineEnd = getEndOfDay(parseDateOnly(g.deadlineISO)).getTime()
    if (g.completedAt <= deadlineEnd) deadlinesMetOnTime++
    else deadlinesMetLate++
  }

  return {
    weekId,
    weekStart: start.getTime(),
    weekEnd: end.getTime(),

    weeklyPlanned: weekly.length,
    weeklyCompleted,
    weeklyRolledOver: weekly.length - weeklyCompleted,
    weeklyCompletionPct: weekly.length === 0 ? 0 : Math.round((weeklyCompleted / weekly.length) * 100),

    scheduledPlanned: scheduled.length,
    scheduledCompleted: scheduledCompleted.length,
    scheduledCompletedLate: scheduledLateDays.length,
    scheduledLateDaysSum: scheduledLateDays.reduce((a, b) => a + b, 0),

    todayOnlyPlanned: todayOnly.length,
    todayOnlyCompleted,
    todayOnlyMissed: todayOnly.length - todayOnlyCompleted,

    recurringPlanned: recurring.length,
    recurringCompleted: recurringCompleted.length,
    recurringCompletedLate: recurringLateDays.length,
    recurringLateDaysSum: recurringLateDays.reduce((a, b) => a + b, 0),

    deadlinesDue: withDeadline.length,
    deadlinesMetOnTime,
    deadlinesMetLate,
    deadlinesMissed,

    createdAt: Date.now(),
  }
}
