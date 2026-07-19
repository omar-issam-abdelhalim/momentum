import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Clock, History as HistoryIcon, ListTree } from 'lucide-react'
import { db } from '@/lib/db/db'
import { getRecentSnapshots } from '@/lib/db/snapshots.repo'
import { formatWeekRangeLabel } from '@/lib/date/week'
import { formatFriendlyDate, formatTime } from '@/lib/date/format'
import { EmptyState } from '@/components/ui/EmptyState'

export function HistoryScreen() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), [])
  const snapshots = useLiveQuery(() => getRecentSnapshots(8), [])

  if (!goals || !habits || !completions || !snapshots) {
    return <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top" aria-busy="true" />
  }

  const recentCompletedGoals = goals
    .filter((g) => g.completed && g.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 20)

  const recentCompletions = [...completions]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 20)
    .map((c) => ({ ...c, habitName: habits.find((h) => h.id === c.habitId)?.name ?? 'Habit' }))

  const hasAnyHistory = recentCompletedGoals.length > 0 || recentCompletions.length > 0 || snapshots.length > 0

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <h1 className="mb-6 text-lg font-semibold text-ink">History</h1>

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
              // Compute the displayed percentage directly from the completed/planned
              // counts so it always exactly matches what's shown next to it, rather
              // than trusting a separately-stored completionPct field.
              const displayPct = s.totalPlanned === 0 ? 0 : Math.round((s.completed / s.totalPlanned) * 100)
              return (
                <div key={s.weekId} className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{formatWeekRangeLabel(s.weekId)}</p>
                    <p className="text-xs text-ink-muted">
                      {s.completed}/{s.totalPlanned} goals · {s.rolledOver} rolled over
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-accent">{displayPct}%</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Long-term weekly summaries are kept indefinitely; detailed goal records are retained for about 14 days.
          </p>
        </section>
      )}

      {recentCompletedGoals.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-ink-faint" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Recently completed goals</h2>
          </div>
          <div className="flex flex-col gap-2">
            {recentCompletedGoals.map((g) => (
              <div key={g.id} className="rounded-lg border border-border bg-surface-raised px-4 py-3">
                <p className="text-sm font-medium text-ink">{g.title}</p>
                <p className="text-xs text-ink-muted">
                  {g.type === 'daily' ? 'Daily' : 'Weekly'} · completed {formatTime(g.completedAt as number)}
                </p>
              </div>
            ))}
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
