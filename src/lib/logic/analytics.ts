import type { Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'
import { formatWeekRangeLabel } from '@/lib/date/week'
import type { ResolvedRange } from '@/lib/date/ranges'
import { computeHabitStreak } from './streaks'

/** Snapshots whose selected range overlaps [startMs, endMs] (attributed by weekStart — see lib/date/ranges.ts). `range.startMs === null` (All time) matches everything. */
export function filterSnapshotsInRange(snapshots: WeeklySnapshot[], range: ResolvedRange): WeeklySnapshot[] {
  if (range.startMs === null || range.endMs === null) return snapshots
  return snapshots.filter((s) => s.weekStart >= (range.startMs as number) && s.weekStart <= (range.endMs as number))
}

function pct(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 100)
}

export interface AggregateStats {
  weeksCounted: number

  weeklyPlanned: number
  weeklyCompleted: number
  weeklyCompletionPct: number | null
  weeklyRolledOver: number
  rolloverRatePct: number | null

  scheduledPlanned: number
  scheduledCompleted: number
  scheduledCompletionPct: number | null
  scheduledCompletedLate: number

  todayOnlyPlanned: number
  todayOnlyCompleted: number
  todayOnlyCompletionPct: number | null
  todayOnlyMissed: number
  todayOnlyMissedPct: number | null

  recurringPlanned: number
  recurringCompleted: number
  recurringCompletionPct: number | null
  recurringCompletedLate: number

  deadlinesDue: number
  deadlinesMetOnTime: number
  deadlinesMetLate: number
  deadlinesMissed: number
  deadlinePerformancePct: number | null
  overdueDeadlineCount: number

  averageLatenessDays: number | null

  totalPlanned: number
  totalCompleted: number
  overallCompletionPct: number | null
}

/** Sums every counter across a set of weekly snapshots into range-wide totals and rates. Never fabricates a rate when the denominator is zero — returns null instead. */
export function aggregateSnapshots(snapshots: WeeklySnapshot[]): AggregateStats {
  const sum = (key: keyof WeeklySnapshot) => snapshots.reduce((acc, s) => acc + ((s[key] as number) ?? 0), 0)

  const weeklyPlanned = sum('weeklyPlanned')
  const weeklyCompleted = sum('weeklyCompleted')
  const weeklyRolledOver = sum('weeklyRolledOver')

  const scheduledPlanned = sum('scheduledPlanned')
  const scheduledCompleted = sum('scheduledCompleted')
  const scheduledCompletedLate = sum('scheduledCompletedLate')
  const scheduledLateDaysSum = sum('scheduledLateDaysSum')

  const todayOnlyPlanned = sum('todayOnlyPlanned')
  const todayOnlyCompleted = sum('todayOnlyCompleted')
  const todayOnlyMissed = sum('todayOnlyMissed')

  const recurringPlanned = sum('recurringPlanned')
  const recurringCompleted = sum('recurringCompleted')
  const recurringCompletedLate = sum('recurringCompletedLate')
  const recurringLateDaysSum = sum('recurringLateDaysSum')

  const deadlinesDue = sum('deadlinesDue')
  const deadlinesMetOnTime = sum('deadlinesMetOnTime')
  const deadlinesMetLate = sum('deadlinesMetLate')
  const deadlinesMissed = sum('deadlinesMissed')

  const totalPlanned = weeklyPlanned + scheduledPlanned + todayOnlyPlanned + recurringPlanned
  const totalCompleted = weeklyCompleted + scheduledCompleted + todayOnlyCompleted + recurringCompleted

  const lateCount = scheduledCompletedLate + recurringCompletedLate
  const lateDaysSum = scheduledLateDaysSum + recurringLateDaysSum

  return {
    weeksCounted: snapshots.length,

    weeklyPlanned,
    weeklyCompleted,
    weeklyCompletionPct: pct(weeklyCompleted, weeklyPlanned),
    weeklyRolledOver,
    rolloverRatePct: pct(weeklyRolledOver, weeklyPlanned),

    scheduledPlanned,
    scheduledCompleted,
    scheduledCompletionPct: pct(scheduledCompleted, scheduledPlanned),
    scheduledCompletedLate,

    todayOnlyPlanned,
    todayOnlyCompleted,
    todayOnlyCompletionPct: pct(todayOnlyCompleted, todayOnlyPlanned),
    todayOnlyMissed,
    todayOnlyMissedPct: pct(todayOnlyMissed, todayOnlyPlanned),

    recurringPlanned,
    recurringCompleted,
    recurringCompletionPct: pct(recurringCompleted, recurringPlanned),
    recurringCompletedLate,

    deadlinesDue,
    deadlinesMetOnTime,
    deadlinesMetLate,
    deadlinesMissed,
    deadlinePerformancePct: pct(deadlinesMetOnTime, deadlinesDue),
    overdueDeadlineCount: deadlinesMissed,

    averageLatenessDays: lateCount === 0 ? null : Math.round((lateDaysSum / lateCount) * 10) / 10,

    totalPlanned,
    totalCompleted,
    overallCompletionPct: pct(totalCompleted, totalPlanned),
  }
}

export interface WeeklyCompletionPoint {
  weekId: string
  label: string
  completionPct: number
  planned: number
  completed: number
  rolledOver: number
}

/** Trend series across a set of snapshots, for the completion/rollover charts. Combines every task kind's planned/completed into one figure per week. */
export function weeklyCompletionSeries(snapshots: WeeklySnapshot[]): WeeklyCompletionPoint[] {
  return [...snapshots]
    .sort((a, b) => a.weekStart - b.weekStart)
    .map((s) => {
      const planned = s.weeklyPlanned + s.scheduledPlanned + s.todayOnlyPlanned + s.recurringPlanned
      const completed = s.weeklyCompleted + s.scheduledCompleted + s.todayOnlyCompleted + s.recurringCompleted
      return {
        weekId: s.weekId,
        label: formatWeekRangeLabel(s.weekId),
        completionPct: planned === 0 ? 0 : Math.round((completed / planned) * 100),
        planned,
        completed,
        rolledOver: s.weeklyRolledOver,
      }
    })
}

/** Snapshots that had at least one planned item — weeks with nothing planned don't count against realism metrics. */
function withPlannedItems(snapshots: WeeklySnapshot[]): WeeklySnapshot[] {
  return snapshots.filter(
    (s) => s.weeklyPlanned + s.scheduledPlanned + s.todayOnlyPlanned + s.recurringPlanned > 0,
  )
}

export interface PlanningInsight {
  id: string
  tone: 'positive' | 'neutral' | 'observation'
  text: string
}

/**
 * Rule-based, factual observations about planning realism — never
 * psychological/medical framing, just what the numbers show. Uses the most
 * recent snapshots (capped) so old history doesn't drown out recent trends.
 */
export function generatePlanningInsights(snapshots: WeeklySnapshot[], recentWindow = 6): PlanningInsight[] {
  const relevant = withPlannedItems(snapshots)
  if (relevant.length < 2) return []

  const recent = [...relevant].sort((a, b) => b.weekStart - a.weekStart).slice(0, recentWindow)
  const stats = aggregateSnapshots(recent)

  const insights: PlanningInsight[] = []
  const avg = stats.overallCompletionPct ?? 0

  if (avg < 50) {
    insights.push({
      id: 'completion-low',
      tone: 'observation',
      text: `Over your last ${recent.length} planned weeks, you've completed about ${avg}% of your planned goals and tasks on average. This suggests you may be planning more than you can realistically complete.`,
    })
  } else if (avg < 80) {
    insights.push({
      id: 'completion-moderate',
      tone: 'neutral',
      text: `You've completed about ${avg}% of your planned goals and tasks on average over your last ${recent.length} planned weeks — a moderate, workable pace.`,
    })
  } else {
    insights.push({
      id: 'completion-high',
      tone: 'positive',
      text: `Your planning has been consistently achievable — about ${avg}% completed on average over your last ${recent.length} planned weeks.`,
    })
  }

  if ((stats.rolloverRatePct ?? 0) >= 40) {
    insights.push({
      id: 'rollover-high',
      tone: 'observation',
      text: `On average, ${stats.rolloverRatePct}% of your weekly goals roll over into the next week. Fewer, more targeted weekly goals may be easier to finish.`,
    })
  }

  if (stats.averageLatenessDays !== null && stats.averageLatenessDays >= 2) {
    insights.push({
      id: 'lateness-high',
      tone: 'observation',
      text: `Scheduled and recurring tasks that finish late do so by about ${stats.averageLatenessDays} days on average recently.`,
    })
  }

  return insights
}

export interface HabitAnalyticsSummary {
  habitId: string
  name: string
  frequency: Habit['frequency']
  completionRatePct: number
  currentStreak: number
  bestStreak: number
}

/** Completion rate over a trailing window of periods (days for daily habits, weeks for weekly habits). */
export function habitCompletionRate(
  habit: Habit,
  completions: HabitCompletion[],
  windowSize: number,
  currentPeriodId: string,
  getPreviousPeriodId: (id: string) => string,
): number {
  const completedSet = new Set(completions.filter((c) => c.habitId === habit.id).map((c) => c.periodId))
  let cursor = currentPeriodId
  let hits = 0
  for (let i = 0; i < windowSize; i++) {
    if (completedSet.has(cursor)) hits++
    cursor = getPreviousPeriodId(cursor)
  }
  return Math.round((hits / windowSize) * 100)
}

export function summarizeHabitAnalytics(
  habits: Habit[],
  completions: HabitCompletion[],
  todayISO: string,
  currentWeekId: string,
  getPreviousDayISO: (id: string) => string,
  getPreviousWeekId: (id: string) => string,
): HabitAnalyticsSummary[] {
  return habits.map((habit) => {
    const streak = computeHabitStreak(habit, completions, todayISO, currentWeekId)
    const rate =
      habit.frequency === 'daily'
        ? habitCompletionRate(habit, completions, 30, todayISO, getPreviousDayISO)
        : habitCompletionRate(habit, completions, 12, currentWeekId, getPreviousWeekId)
    return {
      habitId: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      completionRatePct: rate,
      currentStreak: streak.current,
      bestStreak: streak.best,
    }
  })
}

/** Habit completions falling within a resolved range (null bounds = all time). Used for range-scoped habit activity counts. */
export function completionsInRange(completions: HabitCompletion[], range: ResolvedRange): HabitCompletion[] {
  if (range.startMs === null || range.endMs === null) return completions
  return completions.filter((c) => c.completedAt >= (range.startMs as number) && c.completedAt <= (range.endMs as number))
}
