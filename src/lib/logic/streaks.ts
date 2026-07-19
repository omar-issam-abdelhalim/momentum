import { formatDateOnly, getPreviousWeekId, parseDateOnly, subDays } from '@/lib/date/week'
import type { Habit, HabitCompletion } from '@/types/models'

export interface StreakResult {
  current: number
  best: number
}

/**
 * Generic streak calculator over an ordered notion of "period" (a calendar
 * day or a custom week). Works backward from `currentPeriodId`: if the
 * current period isn't completed yet, that alone doesn't break the streak —
 * we fall back to checking the previous period, since the current one is
 * still in progress.
 */
export function computeStreak(
  completedPeriodIds: string[],
  currentPeriodId: string,
  getPreviousPeriodId: (id: string) => string,
): StreakResult {
  const set = new Set(completedPeriodIds)
  const sorted = [...set].sort()

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const p of sorted) {
    run = prev !== null && getPreviousPeriodId(p) === prev ? run + 1 : 1
    best = Math.max(best, run)
    prev = p
  }

  let cursor = currentPeriodId
  if (!set.has(cursor)) {
    cursor = getPreviousPeriodId(cursor)
    if (!set.has(cursor)) return { current: 0, best }
  }
  let current = 0
  while (set.has(cursor)) {
    current += 1
    cursor = getPreviousPeriodId(cursor)
  }
  return { current, best }
}

export function previousDayISO(iso: string): string {
  return formatDateOnly(subDays(parseDateOnly(iso), 1))
}

export function computeDailyStreak(completedDateISOs: string[], todayISO: string): StreakResult {
  return computeStreak(completedDateISOs, todayISO, previousDayISO)
}

export function computeWeeklyStreak(completedWeekIds: string[], currentWeekId: string): StreakResult {
  return computeStreak(completedWeekIds, currentWeekId, getPreviousWeekId)
}

export function computeHabitStreak(
  habit: Habit,
  completions: HabitCompletion[],
  todayISO: string,
  currentWeekId: string,
): StreakResult {
  const periodIds = completions.filter((c) => c.habitId === habit.id).map((c) => c.periodId)
  return habit.frequency === 'daily'
    ? computeDailyStreak(periodIds, todayISO)
    : computeWeeklyStreak(periodIds, currentWeekId)
}
