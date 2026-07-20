import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Clock, History as HistoryIcon, ListTree } from 'lucide-react'
import { db } from '@/lib/db/db'
import { getRecentSnapshots } from '@/lib/db/snapshots.repo'
import { formatWeekRangeLabel } from '@/lib/date/week'
import { formatFriendlyDate, formatShortDate } from '@/lib/date/format'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Goal } from '@/types/models'

const KIND_LABEL: Record<Goal['kind'], string> = {
  scheduled: 'Scheduled',
  weekly: 'Weekly',
  today: 'Today only',
  recurring: 'Recurring',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function completionDetails(goal: Goal): string[] {
  const details: string[] = []
  if (goal.scheduledDateISO && (goal.kind === 'scheduled' || goal.kind === 'recurring')) {
    details.push(`Scheduled ${formatShortDate(goal.scheduledDateISO)}`)
    if (goal.completedAt) {
      const completedISO = new Date(goal.completedAt).toISOString().slice(0, 10)
      if (completedISO > goal.scheduledDateISO) details.push('Completed late')
    }
  }
  if (goal.deadlineISO) {
    details.push(`Deadline ${formatShortDate(goal.deadlineISO)}`)
  }
  if (goal.kind === 'weekly' && goal.rolledOver) {
    details.push(`Rolled over ×${goal.rolloverCount}`)
  }
  return details
}

interface MonthGroup {
  key: string
  monthIndex: number
  goals: Goal[]
}

interface YearGroup {
  year: number
  months: MonthGroup[]
  total: number
}

function groupByYearMonth(goals: Goal[]): YearGroup[] {
  const byYear = new Map<number, Map<number, Goal[]>>()
  for (const g of goals) {
    if (!g.completedAt) continue
    const d = new Date(g.completedAt)
    const year = d.getFullYear()
    const month = d.getMonth()
    if (!byYear.has(year)) byYear.set(year, new Map())
    const monthMap = byYear.get(year) as Map<number, Goal[]>
    if (!monthMap.has(month)) monthMap.set(month, [])
    ;(monthMap.get(month) as Goal[]).push(g)
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthMap]) => {
      const months = [...monthMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([monthIndex, monthGoals]) => ({
          key: `${year}-${monthIndex}`,
          monthIndex,
          goals: monthGoals.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
        }))
      const total = months.reduce((acc, m) => acc + m.goals.length, 0)
      return { year, months, total }
    })
}

export function HistoryScreen() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), [])
  const snapshots = useLiveQuery(() => getRecentSnapshots(8), [])

  const thisYear = new Date().getFullYear()
  const thisMonthKey = `${thisYear}-${new Date().getMonth()}`
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([thisYear]))
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([thisMonthKey]))

  const completedGoals = useMemo(() => (goals ?? []).filter((g) => g.completed && g.completedAt), [goals])
  const yearGroups = useMemo(() => groupByYearMonth(completedGoals), [completedGoals])

  if (!goals || !habits || !completions || !snapshots) {
    return <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top" aria-busy="true" />
  }

  const recentCompletions = [...completions]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 20)
    .map((c) => ({ ...c, habitName: habits.find((h) => h.id === c.habitId)?.name ?? 'Habit' }))

  const hasAnyHistory = completedGoals.length > 0 || recentCompletions.length > 0 || snapshots.length > 0

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <h1 className="mb-6 text-lg font-semibold text-ink">Activity</h1>

      {!hasAnyHistory && (
        <EmptyState icon={HistoryIcon} title="Nothing here yet" description="Completed goals and habit activity will show up here." />
      )}

      {snapshots.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <ListTree size={16} className="text-ink-faint" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Weekly performance</h2>
          </div>
          <div className="flex flex-col gap-2">
            {[...snapshots].reverse().map((s) => {
              const displayPct = s.weeklyPlanned === 0 ? 0 : Math.round((s.weeklyCompleted / s.weeklyPlanned) * 100)
              return (
                <div key={s.weekId} className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{formatWeekRangeLabel(s.weekId)}</p>
                    <p className="text-xs text-ink-muted">
                      {s.weeklyCompleted}/{s.weeklyPlanned} weekly goals · {s.weeklyRolledOver} rolled over
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-accent">{displayPct}%</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Long-term weekly summaries are kept indefinitely; detailed task records are retained for about 2 years.
          </p>
        </section>
      )}

      {yearGroups.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <HistoryIcon size={16} className="text-ink-faint" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Completed</h2>
          </div>
          <div className="flex flex-col gap-2">
            {yearGroups.map(({ year, months, total }) => {
              const yearOpen = expandedYears.has(year)
              return (
                <div key={year} className="rounded-lg border border-border bg-surface-raised">
                  <button
                    type="button"
                    onClick={() => toggleYear(year)}
                    aria-expanded={yearOpen}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-ink">{year}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      {total} completed
                      <ChevronRight size={14} className={`transition-transform ${yearOpen ? 'rotate-90' : ''}`} />
                    </span>
                  </button>

                  {yearOpen && (
                    <div className="flex flex-col gap-1 border-t border-border px-2 pb-2 pt-1">
                      {months.map(({ key, monthIndex, goals: monthGoals }) => {
                        const monthOpen = expandedMonths.has(key)
                        return (
                          <div key={key}>
                            <button
                              type="button"
                              onClick={() => toggleMonth(key)}
                              aria-expanded={monthOpen}
                              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-surface-sunken"
                            >
                              <span className="text-xs font-medium text-ink-muted">{MONTH_NAMES[monthIndex]}</span>
                              <span className="flex items-center gap-2 text-[11px] text-ink-faint">
                                {monthGoals.length}
                                <ChevronRight size={12} className={`transition-transform ${monthOpen ? 'rotate-90' : ''}`} />
                              </span>
                            </button>

                            {monthOpen && (
                              <div className="flex flex-col gap-1.5 px-2 pb-2">
                                {monthGoals.map((g) => {
                                  const details = completionDetails(g)
                                  return (
                                    <div key={g.id} className="rounded-md bg-surface-sunken px-3 py-2">
                                      <p className="text-sm text-ink">{g.title}</p>
                                      <p className="mt-0.5 text-[11px] text-ink-faint">
                                        {KIND_LABEL[g.kind]} · completed {formatFriendlyDate(new Date(g.completedAt as number).toISOString().slice(0, 10))}
                                        {details.length > 0 ? ` · ${details.join(' · ')}` : ''}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {recentCompletions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock size={16} className="text-ink-faint" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Recent habit activity</h2>
          </div>
          <div className="flex flex-col gap-2">
            {recentCompletions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
                <p className="text-sm font-medium text-ink">{c.habitName}</p>
                <p className="text-xs text-ink-muted">
                  {c.periodId.length === 10 && c.periodId.includes('-') ? formatFriendlyDate(c.periodId) : c.periodId}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
