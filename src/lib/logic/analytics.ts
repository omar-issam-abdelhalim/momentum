import type { Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'
import { formatDateOnly, formatWeekRangeLabel, getWeekId } from '@/lib/date/week'
import type { ResolvedRange } from '@/lib/date/ranges'
import { computeEpochStats, getOpenEpoch } from './epochs'
import { isHabitDueOnDate } from './habitSchedule'

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

export interface HabitCompletionRateOptions {
  /** Periods older than this (exclusive) are skipped entirely — used to stop the trailing window from crossing before the currently open epoch's start (a prior pause), or from padding in phantom misses before the habit existed. */
  earliestPeriodId?: string
  /** Periods this predicate rejects are skipped entirely, from both the numerator and the denominator — used so a weekday-restricted habit's non-scheduled days are never counted as misses. Defaults to "every period is due" (the original, unrestricted behavior). */
  isDue?: (periodId: string) => boolean
}

/**
 * Completion rate over a trailing window of `windowSize` *due* periods (days
 * for daily habits, weeks for weekly habits) — walking further back through
 * any skipped (not-due, or before `earliestPeriodId`) periods as needed so
 * the window still covers `windowSize` real opportunities. With no options,
 * behaves identically to the original fixed-window calendar walk.
 */
export function habitCompletionRate(
  habit: Habit,
  completions: HabitCompletion[],
  windowSize: number,
  currentPeriodId: string,
  getPreviousPeriodId: (id: string) => string,
  options?: HabitCompletionRateOptions,
): number {
  const isDue = options?.isDue ?? (() => true)
  const earliestPeriodId = options?.earliestPeriodId
  const completedSet = new Set(completions.filter((c) => c.habitId === habit.id).map((c) => c.periodId))

  let cursor = currentPeriodId
  let hits = 0
  let counted = 0
  let guard = 0
  const guardLimit = windowSize * 8 + 40
  while (counted < windowSize && guard < guardLimit) {
    guard++
    if (earliestPeriodId !== undefined && cursor < earliestPeriodId) break
    if (isDue(cursor)) {
      counted++
      if (completedSet.has(cursor)) hits++
    }
    cursor = getPreviousPeriodId(cursor)
  }
  return counted === 0 ? 0 : Math.round((hits / counted) * 100)
}

/**
 * Habits passed in are assumed active-status (the caller filters — see
 * AnalyticsScreen). Streaks are bounded to the currently open epoch so a
 * habit that was paused and resumed never shows a streak spanning the gap.
 * The trailing-window completion rate is likewise bounded to the open
 * epoch's start and, for weekday-restricted daily habits, only counts due
 * days — never fabricating a miss for a day that was never scheduled or
 * that predates the current epoch.
 */
export function summarizeHabitAnalytics(
  habits: Habit[],
  completions: HabitCompletion[],
  todayISO: string,
  currentWeekId: string,
  getPreviousDayISO: (id: string) => string,
  getPreviousWeekId: (id: string) => string,
): HabitAnalyticsSummary[] {
  return habits.map((habit) => {
    const openEpoch = getOpenEpoch(habit)
    const epochStats = openEpoch ? computeEpochStats(habit, openEpoch, completions, todayISO, currentWeekId) : null
    const earliestPeriodId = openEpoch
      ? habit.frequency === 'daily'
        ? formatDateOnly(new Date(openEpoch.startDate))
        : getWeekId(new Date(openEpoch.startDate))
      : undefined

    const rate =
      habit.frequency === 'daily'
        ? habitCompletionRate(habit, completions, 30, todayISO, getPreviousDayISO, {
            earliestPeriodId,
            isDue: (periodId) => isHabitDueOnDate(habit, periodId),
          })
        : habitCompletionRate(habit, completions, 12, currentWeekId, getPreviousWeekId, { earliestPeriodId })

    return {
      habitId: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      completionRatePct: rate,
      currentStreak: epochStats?.currentStreak ?? 0,
      bestStreak: epochStats?.bestStreak ?? 0,
    }
  })
}

/** Habit completions falling within a resolved range (null bounds = all time). Used for range-scoped habit activity counts. */
export function completionsInRange(completions: HabitCompletion[], range: ResolvedRange): HabitCompletion[] {
  if (range.startMs === null || range.endMs === null) return completions
  return completions.filter((c) => c.completedAt >= (range.startMs as number) && c.completedAt <= (range.endMs as number))
}
