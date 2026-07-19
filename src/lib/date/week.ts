/**
 * Centralized custom-week utilities.
 *
 * The app week runs Saturday 00:00:00.000 -> Friday 23:59:59.999, always in
 * the device's local timezone. Every part of the app that needs "the current
 * week" must go through these functions rather than computing it ad hoc —
 * that's the only way rollover, snapshots, and analytics stay consistent.
 *
 * A "week id" is the ISO date ('yyyy-MM-dd') of that week's Saturday. It is
 * stable, sortable as a string, and cheap to store/compare.
 */
import { addDays, format, isAfter, isBefore, isEqual, subDays } from 'date-fns'

const SATURDAY = 6 // date-fns weekStartsOn: 0=Sunday ... 6=Saturday

/** Parse a 'yyyy-MM-dd' calendar-day string as local midnight (never UTC). */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** Format a Date as a 'yyyy-MM-dd' calendar-day string in local time. */
export function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getTodayISO(): string {
  return formatDateOnly(new Date())
}

/** Start of the custom week (Saturday 00:00:00.000 local) containing `date`. */
export function getCustomWeekStart(date: Date): Date {
  const day = date.getDay() // 0=Sun..6=Sat
  const diff = (day - SATURDAY + 7) % 7
  const start = subDays(date, diff)
  start.setHours(0, 0, 0, 0)
  return start
}

/** End of the custom week (Friday 23:59:59.999 local) containing `date`. */
export function getCustomWeekEnd(date: Date): Date {
  const start = getCustomWeekStart(date)
  const end = addDays(start, 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/** Stable week identifier: the 'yyyy-MM-dd' of the week's Saturday. */
export function getWeekId(date: Date): string {
  return formatDateOnly(getCustomWeekStart(date))
}

export function getCurrentWeekId(): string {
  return getWeekId(new Date())
}

export function weekIdToStart(weekId: string): Date {
  return parseDateOnly(weekId)
}

export function weekIdToEnd(weekId: string): Date {
  const end = addDays(weekIdToStart(weekId), 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function weekIdToRange(weekId: string): { start: Date; end: Date } {
  return { start: weekIdToStart(weekId), end: weekIdToEnd(weekId) }
}

export function isInWeek(date: Date, weekId: string): boolean {
  return getWeekId(date) === weekId
}

export function isInCurrentWeek(date: Date): boolean {
  return isInWeek(date, getCurrentWeekId())
}

export function getPreviousWeekId(weekId: string): string {
  return formatDateOnly(subDays(weekIdToStart(weekId), 7))
}

export function getNextWeekId(weekId: string): string {
  return formatDateOnly(addDays(weekIdToStart(weekId), 7))
}

/** True if `weekId` is strictly before the current week. */
export function isPastWeek(weekId: string): boolean {
  return weekId < getCurrentWeekId()
}

/**
 * All week ids from `fromWeekId` (exclusive) up to and including `toWeekId`,
 * in chronological order. Used to walk forward through weeks that were
 * missed while the app was closed, so rollover can process each one.
 * Returns [] if fromWeekId >= toWeekId.
 */
export function getWeekIdsBetweenExclusiveStart(fromWeekId: string, toWeekId: string): string[] {
  const ids: string[] = []
  let cursor = fromWeekId
  // Safety cap: never walk more than ~10 years of weeks, even with corrupted data.
  let guard = 0
  while (cursor < toWeekId && guard < 520) {
    cursor = getNextWeekId(cursor)
    ids.push(cursor)
    guard++
  }
  return ids
}

export function formatWeekRangeLabel(weekId: string): string {
  const { start, end } = weekIdToRange(weekId)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = format(start, sameMonth ? 'MMM d' : 'MMM d')
  const endLabel = format(end, sameMonth ? 'd' : 'MMM d')
  const year = start.getFullYear() !== new Date().getFullYear() ? `, ${start.getFullYear()}` : ''
  return `${startLabel} – ${endLabel}${year}`
}

/** Detects a daily transition: `lastSeenISO` (yyyy-MM-dd) differs from today. */
export function isNewDay(lastSeenISO: string | null): boolean {
  if (!lastSeenISO) return true
  return lastSeenISO !== getTodayISO()
}

/** Detects a weekly transition: `lastSeenWeekId` differs from the current week id. */
export function isNewWeek(lastSeenWeekId: string | null): boolean {
  if (!lastSeenWeekId) return true
  return lastSeenWeekId !== getCurrentWeekId()
}

export function daysBetween(a: Date, b: Date): number {
  const ms = getStartOfDay(b).getTime() - getStartOfDay(a).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export { isAfter, isBefore, isEqual, addDays, subDays, format }
