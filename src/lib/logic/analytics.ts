import type { Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'
import { formatWeekRangeLabel } from '@/lib/date/week'
import { computeHabitStreak } from './streaks'

/** Snapshots that actually had goals planned — weeks with nothing planned don't count against realism metrics. */
function withPlannedGoals(snapshots: WeeklySnapshot[]): WeeklySnapshot[] {
  return snapshots.filter((s) => s.totalPlanned > 0)
}

export interface WeeklyCompletionPoint {
  weekId: string
  label: string
  completionPct: number
  planned: number
  completed: number
  rolledOver: number
}

export function weeklyCompletionSeries(snapshots: WeeklySnapshot[]): WeeklyCompletionPoint[] {
  return [...snapshots]
    .sort((a, b) => a.weekStart - b.weekStart)
    .map((s) => ({
      weekId: s.weekId,
      label: formatWeekRangeLabel(s.weekId),
      completionPct: s.completionPct,
      planned: s.totalPlanned,
      completed: s.completed,
      rolledOver: s.rolledOver,
    }))
}

export function averageCompletionRate(snapshots: WeeklySnapshot[]): number | null {
  const relevant = withPlannedGoals(snapshots)
  if (relevant.length === 0) return null
  const sum = relevant.reduce((acc, s) => acc + s.completionPct, 0)
  return Math.round(sum / relevant.length)
}

export function averageRolloverRate(snapshots: WeeklySnapshot[]): number | null {
  const relevant = withPlannedGoals(snapshots)
  if (relevant.length === 0) return null
  const sum = relevant.reduce((acc, s) => acc + s.rolledOver / s.totalPlanned, 0)
  return Math.round((sum / relevant.length) * 100)
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
  const relevant = withPlannedGoals(snapshots)
  if (relevant.length < 2) return []

  const recent = [...relevant].sort((a, b) => b.weekStart - a.weekStart).slice(0, recentWindow)
  const avg = Math.round(recent.reduce((acc, s) => acc + s.completionPct, 0) / recent.length)
  const rolloverAvg = Math.round(recent.reduce((acc, s) => acc + s.rolledOver / s.totalPlanned, 0) / recent.length * 100)

  const insights: PlanningInsight[] = []

  if (avg < 50) {
    insights.push({
      id: 'completion-low',
      tone: 'observation',
      text: `Over your last ${recent.length} planned weeks, you've completed about ${avg}% of your weekly goals on average. This suggests you may be planning more goals than you can realistically complete in one week.`,
    })
  } else if (avg < 80) {
    insights.push({
      id: 'completion-moderate',
      tone: 'neutral',
      text: `You've completed about ${avg}% of your planned weekly goals on average over your last ${recent.length} planned weeks — a moderate, workable pace.`,
    })
  } else {
    insights.push({
      id: 'completion-high',
      tone: 'positive',
      text: `Your weekly planning has been consistently achievable — about ${avg}% of planned goals completed on average over your last ${recent.length} planned weeks.`,
    })
  }

  if (rolloverAvg >= 40) {
    insights.push({
      id: 'rollover-high',
      tone: 'observation',
      text: `On average, ${rolloverAvg}% of your weekly goals roll over into the next week. Fewer, more targeted weekly goals may be easier to finish.`,
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
