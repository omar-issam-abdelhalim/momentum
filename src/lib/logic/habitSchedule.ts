import { parseDateOnly } from '@/lib/date/week'
import type { Habit } from '@/types/models'

/**
 * True if `habit` is due on the given calendar day, per its own schedule —
 * never per an assumption that every day is a due day. Mirrors
 * lib/logic/recurrence.ts#matchesRecurrence for RecurringDefinition.
 *
 * - 'weekly' frequency has no per-day due-ness: the commitment is "once
 *   somewhere in the custom week," not a specific day. Callers that need a
 *   day-level answer for a weekly habit should not call this function —
 *   see lib/logic/epochs.ts, which handles weekly habits at week
 *   granularity instead.
 * - 'daily' frequency with no `weekdays` (or an empty array) is due every
 *   day — the original, unrestricted behavior, unchanged.
 * - 'daily' frequency with `weekdays` set is due only on those weekdays
 *   (date-fns getDay() convention: 0=Sun..6=Sat).
 */
export function isHabitDueOnDate(habit: Habit, dateISO: string): boolean {
  if (habit.frequency !== 'daily') return false
  if (!habit.weekdays || habit.weekdays.length === 0) return true
  const weekday = parseDateOnly(dateISO).getDay()
  return habit.weekdays.includes(weekday)
}

/** True if a daily habit has been restricted to specific weekdays rather than being due every day. */
export function hasWeekdayRestriction(habit: Habit): boolean {
  return habit.frequency === 'daily' && !!habit.weekdays && habit.weekdays.length > 0
}
