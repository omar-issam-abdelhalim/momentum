import { formatDateOnly, getTodayISO, parseDateOnly } from '@/lib/date/week'
import { addDays } from 'date-fns'

export type DeadlineUrgency = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none'

/**
 * Classifies a deadline relative to "today". Deadline strings are
 * 'yyyy-MM-dd' so plain string comparison is chronologically correct and
 * avoids any timezone math.
 */
export function getDeadlineUrgency(deadlineISO: string | undefined, todayISO: string = getTodayISO()): DeadlineUrgency {
  if (!deadlineISO) return 'none'
  if (deadlineISO < todayISO) return 'overdue'
  if (deadlineISO === todayISO) return 'today'
  const tomorrowISO = formatDateOnly(addDays(parseDateOnly(todayISO), 1))
  if (deadlineISO === tomorrowISO) return 'tomorrow'
  return 'upcoming'
}

export function isOverdue(deadlineISO: string | undefined, todayISO: string = getTodayISO()): boolean {
  return getDeadlineUrgency(deadlineISO, todayISO) === 'overdue'
}

export function daysUntilDeadline(deadlineISO: string, todayISO: string = getTodayISO()): number {
  const ms = parseDateOnly(deadlineISO).getTime() - parseDateOnly(todayISO).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export const URGENCY_LABEL: Record<DeadlineUrgency, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  upcoming: 'Upcoming',
  none: '',
}
