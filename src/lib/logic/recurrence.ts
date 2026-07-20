import type { RecurringDefinition } from '@/types/models'
import { addDays, formatDateOnly, parseDateOnly } from '@/lib/date/week'

/** True if `dateISO` is a day this recurrence definition should produce an occurrence for. */
export function matchesRecurrence(def: RecurringDefinition, dateISO: string): boolean {
  if (def.recurrenceType === 'daily') return true
  const weekday = parseDateOnly(dateISO).getDay()
  return (def.weekdays ?? []).includes(weekday)
}

/**
 * All calendar days (inclusive) that need an occurrence generated for this
 * definition, given it was last generated through `fromISOExclusive` and
 * generation should advance up through `throughISOInclusive` (normally
 * today). Pure and deterministic — the caller is responsible for persisting
 * the resulting occurrences and advancing `lastGeneratedThroughISO`
 * atomically, which is what makes repeated generation idempotent.
 *
 * Capped at ~2 years of days as a safety guard against runaway loops on
 * corrupted data (mirrors the same guard in lib/date/week.ts).
 */
export function datesNeedingOccurrence(
  def: RecurringDefinition,
  fromISOExclusive: string,
  throughISOInclusive: string,
): string[] {
  const dates: string[] = []
  let cursor = addDays(parseDateOnly(fromISOExclusive), 1)
  const throughDate = parseDateOnly(throughISOInclusive)
  let guard = 0
  while (cursor <= throughDate && guard < 730) {
    const iso = formatDateOnly(cursor)
    if (matchesRecurrence(def, iso)) dates.push(iso)
    cursor = addDays(cursor, 1)
    guard++
  }
  return dates
}
