import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ChevronLeft, ChevronRight, Flame, Lightbulb, RotateCcw, TrendingUp } from 'lucide-react'
import { getAllSnapshotsIncludingLive } from '@/lib/db/snapshots.repo'
import { getAllHabits, getAllCompletions } from '@/lib/db/habits.repo'
import {
  aggregateSnapshots,
  filterSnapshotsInRange,
  generatePlanningInsights,
  weeklyCompletionSeries,
  summarizeHabitAnalytics,
} from '@/lib/logic/analytics'
import { getCurrentWeekId, getPreviousWeekId, getTodayISO } from '@/lib/date/week'
import { previousDayISO } from '@/lib/logic/streaks'
import {
  ANALYTICS_RANGE_LABEL,
  ANALYTICS_RANGE_TYPES,
  resolveRange,
  shiftAnchor,
  type AnalyticsRangeType,
  type AnalyticsSelection,
} from '@/lib/date/ranges'
import { EmptyState } from '@/components/ui/EmptyState'
import { HABIT_ICONS } from '@/components/habits/HabitFormSheet'

const chartTooltipStyle = {
  background: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--ink))',
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof TrendingUp }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
      <div className="mb-1.5 flex items-center gap-1.5 text-ink-faint">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

const pctLabel = (v: number | null) => (v === null ? '—' : `${v}%`)

export function AnalyticsScreen() {
  const snapshots = useLiveQuery(() => getAllSnapshotsIncludingLive(), [])
  const habits = useLiveQuery(() => getAllHabits(), [])
  const completions = useLiveQuery(() => getAllCompletions(), [])

  const [selection, setSelection] = useState<AnalyticsSelection>({ type: 'week', anchor: new Date() })

  const resolvedRange = useMemo(() => resolveRange(selection), [selection])

  if (!snapshots || !habits || !completions) {
    return <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top" aria-busy="true" />
  }

  if (snapshots.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
        <h1 className="mb-6 text-lg font-semibold text-ink">Analytics</h1>
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Complete your first week to start seeing planning insights."
        />
      </div>
    )
  }

  const snapshotsInRange = filterSnapshotsInRange(snapshots, resolvedRange)
  const stats = aggregateSnapshots(snapshotsInRange)
  const insights = generatePlanningInsights(snapshotsInRange)

  const trendSeries = weeklyCompletionSeries(snapshots.slice(-12))

  const activeHabits = habits.filter((h) => h.active)
  const habitSummaries = summarizeHabitAnalytics(
    activeHabits,
    completions,
    getTodayISO(),
    getCurrentWeekId(),
    previousDayISO,
    getPreviousWeekId,
  )

  const handleRangeType = (type: AnalyticsRangeType) => setSelection({ type, anchor: new Date() })
  const handleShift = (direction: 1 | -1) =>
    setSelection((s) => ({ ...s, anchor: shiftAnchor(s, direction) }))

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <h1 className="mb-4 text-lg font-semibold text-ink">Analytics</h1>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {ANALYTICS_RANGE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleRangeType(type)}
            aria-pressed={selection.type === type}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selection.type === type
                ? 'border-accent bg-accent-muted text-accent'
                : 'border-border text-ink-muted hover:bg-surface-sunken'
            }`}
          >
            {ANALYTICS_RANGE_LABEL[type]}
          </button>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3 py-2.5 shadow-soft">
        <button
          type="button"
          onClick={() => handleShift(-1)}
          disabled={selection.type === 'all'}
          aria-label="Previous period"
          className="rounded-full p-1.5 text-ink-muted hover:bg-surface-sunken disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-ink">{resolvedRange.label}</span>
        <button
          type="button"
          onClick={() => handleShift(1)}
          disabled={selection.type === 'all'}
          aria-label="Next period"
          className="rounded-full p-1.5 text-ink-muted hover:bg-surface-sunken disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-3 flex gap-3">
        <StatTile label="Completion" value={pctLabel(stats.overallCompletionPct)} icon={TrendingUp} />
        <StatTile label="Rollover rate" value={pctLabel(stats.rolloverRatePct)} icon={RotateCcw} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Weekly goals</p>
          <p className="mt-1 text-sm text-ink">
            {stats.weeklyCompleted}/{stats.weeklyPlanned} · {pctLabel(stats.weeklyCompletionPct)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Scheduled tasks</p>
          <p className="mt-1 text-sm text-ink">
            {stats.scheduledCompleted}/{stats.scheduledPlanned} · {pctLabel(stats.scheduledCompletionPct)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Today only</p>
          <p className="mt-1 text-sm text-ink">
            {stats.todayOnlyCompleted}/{stats.todayOnlyPlanned} · missed {stats.todayOnlyMissed}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Recurring</p>
          <p className="mt-1 text-sm text-ink">
            {stats.recurringCompleted}/{stats.recurringPlanned} · {pctLabel(stats.recurringCompletionPct)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Deadlines met</p>
          <p className="mt-1 text-sm text-ink">
            {stats.deadlinesMetOnTime}/{stats.deadlinesDue} · overdue {stats.overdueDeadlineCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Avg. lateness</p>
          <p className="mt-1 text-sm text-ink">
            {stats.averageLatenessDays === null ? '—' : `${stats.averageLatenessDays} days`}
          </p>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {insights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-raised p-3.5">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <p className="text-sm text-ink-muted">{insight.text}</p>
            </div>
          ))}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Weekly completion trend</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => [`${value}%`, 'Completion']}
              />
              <Line
                type="monotone"
                dataKey="completionPct"
                stroke="rgb(var(--accent))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'rgb(var(--accent))' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Planned vs completed</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="planned" name="Planned" fill="rgb(var(--border-strong))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Rollover per week</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trendSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="rolledOver" name="Rolled over" fill="rgb(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Habits</h2>
        {habitSummaries.length === 0 ? (
          <EmptyState icon={Flame} title="No habits yet" description="Add a habit to see consistency stats here." />
        ) : (
          <div className="flex flex-col gap-2">
            {habitSummaries.map((h) => {
              const habit = activeHabits.find((a) => a.id === h.habitId)
              const Icon = HABIT_ICONS[habit?.icon ?? 'sparkles'] ?? Flame
              return (
                <div
                  key={h.habitId}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                    <p className="text-xs text-ink-muted">
                      {h.completionRatePct}% consistency · best streak {h.bestStreak}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-warning">
                    <Flame size={14} />
                    {h.currentStreak}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
