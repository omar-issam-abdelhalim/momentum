import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Minus } from 'lucide-react'
import { getTodayISO, getCurrentWeekId } from '@/lib/date/week'
import {
  classifyDailyEpochGrid,
  classifyWeeklyEpochGrid,
  groupByMonth,
  type DayState,
  type GridDayWeekRow,
  type GridWeekUnitRow,
  type WeekUnitState,
} from '@/lib/logic/habitGrid'
import type { Habit, HabitCompletion, HabitEpoch } from '@/types/models'

interface HabitConsistencyGridProps {
  habit: Habit
  epoch: HabitEpoch
  completions: HabitCompletion[]
}

const ROW_HEADER_LABELS = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr']
const INITIAL_MONTHS = 3
const LOAD_MORE_MONTHS = 3

const DAY_STATE_STYLE: Record<DayState, string> = {
  completed: 'bg-accent text-white border border-accent',
  missed: 'border-2 border-danger/40 text-danger/70 bg-transparent',
  // Distinct from 'missed' via fill, border style, and icon (never color
  // alone) — reads as "in progress," reusing the same accent-tinted dashed
  // language already used for a weekly habit's 'in-progress' week band.
  partial: 'border-2 border-dashed border-accent/50 bg-accent-muted text-accent',
  'not-scheduled': 'border border-dashed border-border/50 bg-transparent',
  paused: 'border border-border-strong bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgb(var(--border-strong))_2px,rgb(var(--border-strong))_3px)]',
  future: 'border border-border/30 bg-transparent',
}

function DayCell({ dateISO, state }: { dateISO: string; state: DayState }) {
  const dayNum = Number(dateISO.slice(-2))
  return (
    <div
      title={`${dateISO}: ${state.replace('-', ' ')}`}
      className={`flex size-6 shrink-0 items-center justify-center rounded text-[9px] font-medium sm:size-7 ${DAY_STATE_STYLE[state]}`}
    >
      {state === 'completed' && <Check size={11} strokeWidth={3} aria-hidden="true" />}
      {state === 'missed' && <Minus size={9} strokeWidth={3} aria-hidden="true" />}
      {state === 'partial' && <Circle size={7} className="fill-current" aria-hidden="true" />}
      {(state === 'not-scheduled' || state === 'future') && (
        <span className="opacity-40">{dayNum}</span>
      )}
    </div>
  )
}

const WEEK_UNIT_STYLE: Record<WeekUnitState, string> = {
  completed: 'bg-accent text-white border border-accent',
  missed: 'border-2 border-danger/40 text-danger/80 bg-transparent',
  'in-progress': 'border border-dashed border-accent/50 text-accent bg-accent-muted',
  future: 'border border-border/30 text-ink-faint bg-transparent',
}

const WEEK_UNIT_LABEL: Record<WeekUnitState, string> = {
  completed: 'Completed',
  missed: 'Missed',
  'in-progress': 'This week',
  future: 'Upcoming',
}

function WeekUnitRow({ row }: { row: GridWeekUnitRow }) {
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium ${WEEK_UNIT_STYLE[row.state]}`}>
      <span>{row.weekId}</span>
      <span className="flex items-center gap-1">
        {row.state === 'completed' && <Check size={12} strokeWidth={3} aria-hidden="true" />}
        {row.state === 'missed' && <Minus size={10} strokeWidth={3} aria-hidden="true" />}
        {WEEK_UNIT_LABEL[row.state]}
      </span>
    </div>
  )
}

function useLazyMonthCount(totalMonths: number) {
  const [visibleCount, setVisibleCount] = useState(Math.min(INITIAL_MONTHS, totalMonths))
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisibleCount((v) => Math.min(v, totalMonths) || Math.min(INITIAL_MONTHS, totalMonths))
  }, [totalMonths])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(v + LOAD_MORE_MONTHS, totalMonths))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [totalMonths])

  return { visibleCount, sentinelRef, loadMore: () => setVisibleCount((v) => Math.min(v + LOAD_MORE_MONTHS, totalMonths)) }
}

export function HabitConsistencyGrid({ habit, epoch, completions }: HabitConsistencyGridProps) {
  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()

  const dailySections = useMemo(() => {
    if (habit.frequency !== 'daily') return []
    return groupByMonth<GridDayWeekRow>(classifyDailyEpochGrid(habit, epoch, completions, todayISO))
  }, [habit, epoch, completions, todayISO])

  const weeklySections = useMemo(() => {
    if (habit.frequency !== 'weekly') return []
    return groupByMonth<GridWeekUnitRow>(classifyWeeklyEpochGrid(habit, epoch, completions, currentWeekId))
  }, [habit, epoch, completions, currentWeekId])

  const sections = habit.frequency === 'daily' ? dailySections : weeklySections
  const { visibleCount, sentinelRef, loadMore } = useLazyMonthCount(sections.length)
  const visibleSections = sections.slice(0, visibleCount)
  const hasMore = visibleCount < sections.length

  if (sections.length === 0) {
    return <p className="rounded-md bg-surface-sunken px-3 py-3 text-xs text-ink-muted">No days in this period yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {habit.frequency === 'daily' && (
        <div className="flex gap-1 pl-0.5 text-[9px] font-medium text-ink-faint sm:gap-1.5">
          {ROW_HEADER_LABELS.map((l, i) => (
            <span key={i} className="flex size-6 shrink-0 items-center justify-center sm:size-7">
              {l}
            </span>
          ))}
        </div>
      )}

      {visibleSections.map((section) => (
        <div key={section.monthKey}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{section.label}</h3>
          <div className="flex flex-col gap-1 sm:gap-1.5">
            {habit.frequency === 'daily'
              ? (section.weeks as GridDayWeekRow[]).map((row) => (
                  <div key={row.weekId} className="flex gap-1 sm:gap-1.5">
                    {row.days.map((day) => (
                      <DayCell key={day.dateISO} dateISO={day.dateISO} state={day.state} />
                    ))}
                  </div>
                ))
              : (section.weeks as GridWeekUnitRow[]).map((row) => <WeekUnitRow key={row.weekId} row={row} />)}
          </div>
        </div>
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-2">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
          >
            Load earlier months
          </button>
        </div>
      )}
    </div>
  )
}
