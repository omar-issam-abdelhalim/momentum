import type { Habit, HabitCompletion } from '@/types/models'
import { effectiveTarget, isCounterTarget } from './quantity'

/**
 * The single choke point every consumer of HabitCompletion goes through to
 * decide "does this period count as done" — replaces the old assumption
 * (throughout habits.repo.ts, useHabits.ts, epochs.ts, habitGrid.ts,
 * analytics.ts) that a completion row's mere *existence* means "period
 * complete". That assumption still holds for binary habits (a row is only
 * ever written at full completion for them) but no longer holds for a
 * counter habit's in-progress rows.
 *
 * Quantity targets only ever apply to daily-frequency habits (decision made
 * with the user — weekly-frequency habits keep their existing single
 * week-level completion with no per-day/quantity concept at all).
 */

export function targetForHabit(habit: Habit): number {
  return habit.frequency === 'daily' ? effectiveTarget(habit.dailyTarget) : 1
}

export function isCounterHabit(habit: Habit): boolean {
  return habit.frequency === 'daily' && isCounterTarget(habit.dailyTarget)
}

/**
 * A record with no `count` field is either a legacy (pre-feature) row or a
 * binary-habit row written going forward — both are permanently interpreted
 * as "at target", since a row's mere existence has always meant "period
 * complete" and there is no historical count to reconstruct. Only a counter
 * habit's rows ever carry a real `count`, which must reach `target` to count.
 */
export function isCompletionAtTarget(record: HabitCompletion | undefined, target: number): boolean {
  if (!record) return false
  return record.count === undefined || record.count >= target
}

/** Progress count for display (partial-state grid cells, average-%-metric). Legacy/binary rows read as fully at target. */
export function progressCountForRecord(record: HabitCompletion | undefined, target: number): number {
  if (!record) return 0
  return record.count ?? target
}

/** Convenience: this habit's completions, filtered down to only the ones that actually reach its target — the counter-aware replacement for `completions.filter(c => c.habitId === habit.id)` used as a completedness check. */
export function filterCompletionsAtTarget(completions: HabitCompletion[], habit: Habit): HabitCompletion[] {
  const target = targetForHabit(habit)
  return completions.filter((c) => c.habitId === habit.id && isCompletionAtTarget(c, target))
}
