import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { parseDateOnly } from './week'

export function formatFriendlyDate(iso: string): string {
  const date = parseDateOnly(iso)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, MMM d')
}

export function formatShortDate(iso: string): string {
  return format(parseDateOnly(iso), 'MMM d')
}

export function formatLongDate(date: Date): string {
  return format(date, 'EEEE, MMMM d, yyyy')
}

export function formatTime(ts: number): string {
  return format(new Date(ts), 'h:mm a')
}
