import {
  addDays,
  formatDateOnly,
  getCurrentWeekId,
  getNextWeekId,
  getTodayISO,
  getWeekId,
  parseDateOnly,
} from '@/lib/date/week'
import { isHabitDueOnDate } from '@/lib/logic/habitSchedule'
import type { Habit, HabitCompletion, HabitEpoch } from '@/types/models'

/**
 * Epoch statistics are DERIVED (never persisted as snapshots). Architecture
 * decision, made by inspecting the real codebase (see PROJECT_CONTEXT.md):
 * HabitCompletion records are permanent and immutable — lib/db/cleanupRunner.ts
 * explicitly never touches habits or habitCompletions, unlike Goals, which
 * age out under a 2-year retention policy. Since completion history is
 * reliably retained forever, deriving stats from it avoids duplicated state
 * and self-corrects if a stats formula is ever fixed later. Epoch boundaries
 * themselves (startDate/endDate) are the only thing persisted per epoch.
 */

export function getOpenEpoch(habit: Habit): HabitEpoch | undefined {
  return habit.epochs.find((e) => e.endDate === null)
}

/** Closed epochs, most recent first (by startDate descending). */
export function getClosedEpochsMostRecentFirst(habit: Habit): HabitEpoch[] {
  return habit.epochs.filter((e) => e.endDate !== null).sort((a, b) => b.startDate - a.startDate)
}

/**
 * Resolves the epoch the Epoch Selector should show for a given chip id.
 * `'now'` resolves to the open epoch (if any); any other id resolves to the
 * matching closed epoch by its own `id`.
 */
export function resolveEpochSelection(habit: Habit, selectedId: string): HabitEpoch | undefined {
  if (selectedId === 'now') return getOpenEpoch(habit)
  return habit.epochs.find((e) => e.id === selectedId)
}

/** Default Epoch Selector chip: 'now' if an epoch is open, else the most recent closed epoch's id. */
export function defaultEpochSelectionId(habit: Habit): string {
  const open = getOpenEpoch(habit)
  if (open) return 'now'
  const closed = getClosedEpochsMostRecentFirst(habit)
  return closed[0]?.id ?? 'now'
}

/** All calendar-day due periods (daily habits) within an epoch, capped at today. Empty for 'weekly' habits — see dueWeekPeriodsForEpoch. */
function dueDayPeriodsForEpoch(habit: Habit, epoch: HabitEpoch, todayISO: string): string[] {
  if (habit.frequency !== 'daily') return []
  const startISO = formatDateOnly(new Date(epoch.startDate))
  const endISO = epoch.endDate ? formatDateOnly(new Date(epoch.endDate)) : todayISO
  const cappedEndISO = endISO > todayISO ? todayISO : endISO

  const periods: string[] = []
  let cursor = parseDateOnly(startISO)
  const end = parseDateOnly(cappedEndISO)
  let guard = 0
  while (cursor <= end && guard < 3660) {
    const iso = formatDateOnly(cursor)
    if (isHabitDueOnDate(habit, iso)) periods.push(iso)
    cursor = addDays(cursor, 1)
    guard++
  }
  return periods
}

/** All due weekIds (weekly habits) within an epoch, capped at the current week. Empty for 'daily' habits. */
function dueWeekPeriodsForEpoch(habit: Habit, epoch: HabitEpoch, currentWeekId: string): string[] {
  if (habit.frequency !== 'weekly') return []
  const startWeekId = getWeekId(new Date(epoch.startDate))
  const endWeekId = epoch.endDate ? getWeekId(new Date(epoch.endDate)) : currentWeekId
  const cappedEndWeekId = endWeekId > currentWeekId ? currentWeekId : endWeekId

  const periods: string[] = []
  let cursor = startWeekId
  let guard = 0
  while (cursor <= cappedEndWeekId && guard < 520) {
    periods.push(cursor)
    cursor = getNextWeekId(cursor)
    guard++
  }
  return periods
}

function duePeriodsForEpoch(habit: Habit, epoch: HabitEpoch, todayISO: string, currentWeekId: string): string[] {
  return habit.frequency === 'daily'
    ? dueDayPeriodsForEpoch(habit, epoch, todayISO)
    : dueWeekPeriodsForEpoch(habit, epoch, currentWeekId)
}

function currentPeriodIdFor(habit: Habit, todayISO: string, currentWeekId: string): string {
  return habit.frequency === 'daily' ? todayISO : currentWeekId
}

interface RunResult {
  current: number
  best: number
}

/**
 * Streak over an ordered list of due periods only (never calendar days that
 * weren't actually due) — the epoch- and schedule-aware replacement for the
 * calendar-arithmetic streak walk used elsewhere for the un-scoped/current
 * view. If the epoch is open and its last due period is "now" and that
 * period isn't completed yet, it doesn't break the streak (still in
 * progress) — mirrors the grace period in lib/logic/streaks.ts#computeStreak.
 */
function streakOverDuePeriods(duePeriodsSorted: string[], completedSet: Set<string>, nowPeriodId: string): RunResult {
  let best = 0
  let run = 0
  for (const p of duePeriodsSorted) {
    if (completedSet.has(p)) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }

  let trailing = duePeriodsSorted
  const last = trailing[trailing.length - 1]
  if (last === nowPeriodId && !completedSet.has(last)) {
    trailing = trailing.slice(0, -1)
  }
  let current = 0
  for (let i = trailing.length - 1; i >= 0; i--) {
    if (completedSet.has(trailing[i])) current += 1
    else break
  }

  return { current, best }
}

export interface EpochStats {
  epoch: HabitEpoch
  isOpen: boolean
  startDate: number
  endDate: number | null
  durationDays: number
  totalCompletions: number
  totalDuePeriods: number
  completionRatePct: number | null
  currentStreak: number
  bestStreak: number
}

/**
 * Derives closed-epoch-stable statistics for a single epoch, bounded to its
 * [startDate, endDate ?? now] range and the habit's actual schedule. Never
 * fabricates a rate when there were zero due periods (e.g. a same-day
 * pause that lands on a non-scheduled weekday) — returns null instead.
 */
export function computeEpochStats(
  habit: Habit,
  epoch: HabitEpoch,
  completions: HabitCompletion[],
  todayISO: string = getTodayISO(),
  currentWeekId: string = getCurrentWeekId(),
): EpochStats {
  const duePeriods = duePeriodsForEpoch(habit, epoch, todayISO, currentWeekId).sort()
  const nowPeriodId = currentPeriodIdFor(habit, todayISO, currentWeekId)

  const startISO = formatDateOnly(new Date(epoch.startDate))
  const endISO = epoch.endDate ? formatDateOnly(new Date(epoch.endDate)) : null
  const completedSet = new Set(
    completions
      .filter((c) => c.habitId === habit.id)
      .filter((c) => c.periodId >= startISO && (endISO === null || c.periodId <= endISO))
      .map((c) => c.periodId),
  )

  const totalDuePeriods = duePeriods.length
  const totalCompletions = duePeriods.filter((p) => completedSet.has(p)).length
  const { current, best } = streakOverDuePeriods(duePeriods, completedSet, nowPeriodId)

  const durationDays = Math.max(
    0,
    Math.round(((epoch.endDate ?? Date.now()) - epoch.startDate) / (24 * 60 * 60 * 1000)),
  )

  return {
    epoch,
    isOpen: epoch.endDate === null,
    startDate: epoch.startDate,
    endDate: epoch.endDate,
    durationDays,
    totalCompletions,
    totalDuePeriods,
    completionRatePct: totalDuePeriods === 0 ? null : Math.round((totalCompletions / totalDuePeriods) * 100),
    currentStreak: current,
    bestStreak: best,
  }
}

export interface LifetimeSummary {
  totalCompletions: number
  totalActiveDurationMs: number
  bestStreakEver: number
  epochCount: number
}

/** Aggregate across all epochs combined — always labeled as a sum across separate periods, never a single continuous streak. */
export function computeLifetimeSummary(
  habit: Habit,
  completions: HabitCompletion[],
  todayISO: string = getTodayISO(),
  currentWeekId: string = getCurrentWeekId(),
): LifetimeSummary {
  const perEpoch = habit.epochs.map((e) => computeEpochStats(habit, e, completions, todayISO, currentWeekId))

  return {
    totalCompletions: perEpoch.reduce((sum, s) => sum + s.totalCompletions, 0),
    totalActiveDurationMs: habit.epochs.reduce((sum, e) => sum + ((e.endDate ?? Date.now()) - e.startDate), 0),
    bestStreakEver: perEpoch.reduce((max, s) => Math.max(max, s.bestStreak), 0),
    epochCount: habit.epochs.length,
  }
}
