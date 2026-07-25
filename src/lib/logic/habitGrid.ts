import { addDays, format, formatDateOnly, getNextWeekId, getWeekId, parseDateOnly } from '@/lib/date/week'
import { isHabitDueOnDate } from '@/lib/logic/habitSchedule'
import { progressCountForRecord, targetForHabit } from '@/lib/logic/habitProgress'
import type { Habit, HabitCompletion, HabitEpoch } from '@/types/models'

/**
 * Categorical (never continuous-intensity) day state for the Visual
 * Consistency Grid. 'paused' exists as a real, visually distinct state the
 * renderer supports, but — see classifyDailyEpochGrid below — a single
 * epoch's own grid can structurally never produce it: an epoch's date range
 * excludes the paused gap that closed it by definition, so 'paused' would
 * only ever apply to a *between-epochs* view, which this app never renders
 * (the Epoch Selector always shows exactly one epoch at a time).
 *
 * 'partial' exists only for a quantity (daily-target > 1) habit: a past,
 * scheduled day with count > 0 but < target. It reads as "in progress," not
 * a failure — distinct from 'missed' via fill/border/icon (see
 * HabitConsistencyGrid.tsx), never via color alone. A quantity habit's
 * *today*, even with partial progress, still classifies as 'future' below
 * (never 'partial', never 'missed') — same rule v2.1.0 established for
 * binary habits, just extended rather than replaced.
 */
export type DayState = 'completed' | 'missed' | 'not-scheduled' | 'paused' | 'future' | 'partial'

export interface GridDayCell {
  dateISO: string
  state: DayState
}

export interface GridDayWeekRow {
  weekId: string
  days: GridDayCell[]
}

export type WeekUnitState = 'completed' | 'missed' | 'in-progress' | 'future'

export interface GridWeekUnitRow {
  weekId: string
  state: WeekUnitState
}

export interface GridMonthSection<Row> {
  monthKey: string
  label: string
  weeks: Row[]
}

function classifyDailyDay(
  habit: Habit,
  dateISO: string,
  startISO: string,
  endISO: string | null,
  todayISO: string,
  countsByDate: Map<string, number>,
  target: number,
): DayState {
  if (dateISO < startISO) return 'not-scheduled'
  if (endISO !== null && dateISO > endISO) return 'not-scheduled'
  if (!isHabitDueOnDate(habit, dateISO)) return 'not-scheduled'
  const count = countsByDate.get(dateISO) ?? 0
  if (count >= target) return 'completed'
  // "Future" is defined as today-or-later — today's day isn't over yet, so
  // an incomplete today (untouched, or with partial quantity progress) must
  // read the same calm, neutral way as a day that hasn't arrived: never as
  // an accusatory "missed" before the day is done, and never as "partial"
  // either — that state is reserved for a *past* under-target day.
  if (dateISO >= todayISO) return 'future'
  if (count > 0) return 'partial'
  return 'missed'
}

/**
 * Day-by-day grid for a 'daily'-frequency habit (with or without a weekday
 * restriction), scoped to exactly one epoch. Rows are Momentum's custom
 * Saturday–Friday weeks; days outside the epoch's own [startDate, endDate]
 * range (week-row padding at the boundaries) render as 'not-scheduled'
 * rather than fabricating a missed day for a period the habit wasn't even
 * in this epoch.
 */
export function classifyDailyEpochGrid(
  habit: Habit,
  epoch: HabitEpoch,
  completions: HabitCompletion[],
  todayISO: string,
): GridDayWeekRow[] {
  const startISO = formatDateOnly(new Date(epoch.startDate))
  const endISO = epoch.endDate ? formatDateOnly(new Date(epoch.endDate)) : null
  const target = targetForHabit(habit)
  const countsByDate = new Map(
    completions
      .filter((c) => c.habitId === habit.id && c.periodId >= startISO)
      .map((c) => [c.periodId, progressCountForRecord(c, target)] as const),
  )

  const lastRenderedISO = endISO !== null ? (endISO > todayISO ? todayISO : endISO) : todayISO
  const startWeekId = getWeekId(parseDateOnly(startISO))
  const endWeekId = getWeekId(parseDateOnly(lastRenderedISO))

  const rows: GridDayWeekRow[] = []
  let weekCursor = startWeekId
  let guard = 0
  while (weekCursor <= endWeekId && guard < 520) {
    const weekStart = parseDateOnly(weekCursor)
    const days: GridDayCell[] = []
    for (let i = 0; i < 7; i++) {
      const dateISO = formatDateOnly(addDays(weekStart, i))
      days.push({ dateISO, state: classifyDailyDay(habit, dateISO, startISO, endISO, todayISO, countsByDate, target) })
    }
    rows.push({ weekId: weekCursor, days })
    weekCursor = getNextWeekId(weekCursor)
    guard++
  }
  return rows
}

function classifyWeekUnit(
  weekId: string,
  epochEndWeekId: string | null,
  currentWeekId: string,
  completedSet: Set<string>,
): WeekUnitState {
  if (weekId > currentWeekId) return 'future'
  if (weekId === currentWeekId && epochEndWeekId === null) {
    return completedSet.has(weekId) ? 'completed' : 'in-progress'
  }
  return completedSet.has(weekId) ? 'completed' : 'missed'
}

/**
 * Week-unit grid for a 'weekly'-frequency habit, scoped to one epoch.
 * Weekly habits have no per-day due-ness (the commitment is "once anywhere
 * in the custom week," not a specific day) — respecting that schedule
 * exactly means rendering one merged state per week rather than fabricating
 * seven independent daily due-cells that don't reflect how the habit
 * actually works.
 */
export function classifyWeeklyEpochGrid(
  habit: Habit,
  epoch: HabitEpoch,
  completions: HabitCompletion[],
  currentWeekId: string,
): GridWeekUnitRow[] {
  const startWeekId = getWeekId(new Date(epoch.startDate))
  const epochEndWeekId = epoch.endDate ? getWeekId(new Date(epoch.endDate)) : null
  const lastRenderedWeekId = epochEndWeekId !== null ? (epochEndWeekId > currentWeekId ? currentWeekId : epochEndWeekId) : currentWeekId

  const completedSet = new Set(
    completions.filter((c) => c.habitId === habit.id && c.periodId >= startWeekId).map((c) => c.periodId),
  )

  const rows: GridWeekUnitRow[] = []
  let cursor = startWeekId
  let guard = 0
  while (cursor <= lastRenderedWeekId && guard < 520) {
    rows.push({ weekId: cursor, state: classifyWeekUnit(cursor, epochEndWeekId, currentWeekId, completedSet) })
    cursor = getNextWeekId(cursor)
    guard++
  }
  return rows
}

/** Calendar month/year (of a week's Saturday start) a week-row is attributed to — mirrors the WeeklySnapshot month-attribution convention already used in Analytics. */
function monthKeyForWeek(weekId: string): string {
  const start = parseDateOnly(weekId)
  return format(start, 'yyyy-MM')
}

/** Groups week-rows into month sections, most recent month first (for top-down lazy loading of older history). */
export function groupByMonth<Row extends { weekId: string }>(rows: Row[]): GridMonthSection<Row>[] {
  const byMonth = new Map<string, Row[]>()
  for (const row of rows) {
    const key = monthKeyForWeek(row.weekId)
    const existing = byMonth.get(key)
    if (existing) existing.push(row)
    else byMonth.set(key, [row])
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthKey, weeks]) => ({
      monthKey,
      label: format(parseDateOnly(`${monthKey}-01`), 'MMMM yyyy'),
      weeks,
    }))
}
