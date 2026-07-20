/**
 * Calendar period math for the Analytics time-range controls (All / Week /
 * Month / Quarter / Half-Year / Year). "Week" defers entirely to the custom
 * Saturday–Friday week engine in week.ts. Every other period is a plain
 * calendar range in local time.
 *
 * A WeeklySnapshot is attributed to the calendar month/quarter/half/year
 * containing its `weekStart` — the week it opened in — since a custom week
 * can straddle a month boundary. This is documented behavior, not a bug:
 * a week starting Saturday Jan 31 and ending Friday Feb 6 counts toward
 * January.
 */
import { addDays, addMonths, addYears, endOfMonth, startOfMonth, subDays } from 'date-fns'
import { format, formatWeekRangeLabel, getEndOfDay, getWeekId, weekIdToRange } from './week'

export type AnalyticsRangeType = 'all' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export const ANALYTICS_RANGE_TYPES: AnalyticsRangeType[] = ['all', 'week', 'month', 'quarter', 'half', 'year']

export interface AnalyticsSelection {
  type: AnalyticsRangeType
  /** Any day within the selected period. Ignored when type === 'all'. */
  anchor: Date
}

export interface ResolvedRange {
  label: string
  /** Inclusive bounds in epoch ms; null for 'all' (no bound). */
  startMs: number | null
  endMs: number | null
}

export function resolveRange(selection: AnalyticsSelection): ResolvedRange {
  switch (selection.type) {
    case 'all':
      return { label: 'All time', startMs: null, endMs: null }

    case 'week': {
      const weekId = getWeekId(selection.anchor)
      const { start, end } = weekIdToRange(weekId)
      return { label: formatWeekRangeLabel(weekId), startMs: start.getTime(), endMs: end.getTime() }
    }

    case 'month': {
      const start = startOfMonth(selection.anchor)
      const end = getEndOfDay(endOfMonth(selection.anchor))
      return { label: format(start, 'MMMM yyyy'), startMs: start.getTime(), endMs: end.getTime() }
    }

    case 'quarter': {
      const q = Math.floor(selection.anchor.getMonth() / 3)
      const start = new Date(selection.anchor.getFullYear(), q * 3, 1)
      const end = getEndOfDay(new Date(selection.anchor.getFullYear(), q * 3 + 3, 0))
      return { label: `Q${q + 1} ${start.getFullYear()}`, startMs: start.getTime(), endMs: end.getTime() }
    }

    case 'half': {
      const half = selection.anchor.getMonth() < 6 ? 0 : 1
      const start = new Date(selection.anchor.getFullYear(), half * 6, 1)
      const end = getEndOfDay(new Date(selection.anchor.getFullYear(), half * 6 + 6, 0))
      return { label: `H${half + 1} ${start.getFullYear()}`, startMs: start.getTime(), endMs: end.getTime() }
    }

    case 'year': {
      const start = new Date(selection.anchor.getFullYear(), 0, 1)
      const end = getEndOfDay(new Date(selection.anchor.getFullYear(), 11, 31))
      return { label: `${start.getFullYear()}`, startMs: start.getTime(), endMs: end.getTime() }
    }
  }
}

/** Anchor for the adjacent period (previous when direction is -1, next when +1). No-op for 'all'. */
export function shiftAnchor(selection: AnalyticsSelection, direction: 1 | -1): Date {
  switch (selection.type) {
    case 'week':
      return direction === 1 ? addDays(selection.anchor, 7) : subDays(selection.anchor, 7)
    case 'month':
      return addMonths(selection.anchor, direction)
    case 'quarter':
      return addMonths(selection.anchor, direction * 3)
    case 'half':
      return addMonths(selection.anchor, direction * 6)
    case 'year':
      return addYears(selection.anchor, direction)
    case 'all':
      return selection.anchor
  }
}

export const ANALYTICS_RANGE_LABEL: Record<AnalyticsRangeType, string> = {
  all: 'All',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  half: 'Half-Year',
  year: 'Year',
}
