import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Flame, Lightbulb, RotateCcw, TrendingUp } from 'lucide-react'
import { getAllSnapshots } from '@/lib/db/snapshots.repo'
import { getAllHabits, getAllCompletions } from '@/lib/db/habits.repo'
import {
  averageCompletionRate,
  averageRolloverRate,
  generatePlanningInsights,
  weeklyCompletionSeries,
} from '@/lib/logic/analytics'
import { summarizeHabitAnalytics } from '@/lib/logic/analytics'
import { getCurrentWeekId, getPreviousWeekId, getTodayISO } from '@/lib/date/week'
import { previousDayISO } from '@/lib/logic/streaks'
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

export function AnalyticsScreen() {
  const snapshots = useLiveQuery(() => getAllSnapshots(), [])
  const habits = useLiveQuery(() => getAllHabits(), [])
  const completions = useLiveQuery(() => getAllCompletions(), [])

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

  const series = weeklyCompletionSeries(snapshots)
  const avgCompletion = averageCompletionRate(snapshots)
  const avgRollover = averageRolloverRate(snapshots)
  const insights = generatePlanningInsights(snapshots)

  const activeHabits = habits.filter((h) => h.active)
  const habitSummaries = summarizeHabitAnalytics(
    activeHabits,
    completions,
    getTodayISO(),
    getCurrentWeekId(),
    previousDayISO,
    getPreviousWeekId,
  )

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <h1 className="mb-6 text-lg font-semibold text-ink">Analytics</h1>

      <div className="mb-6 flex gap-3">
        <StatTile label="Avg completion" value={avgCompletion !== null ? `${avgCompletion}%` : '—'} icon={TrendingUp} />
        <StatTile label="Avg rollover" value={avgRollover !== null ? `${avgRollover}%` : '—'} icon={RotateCcw} />
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Weekly completion</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
            <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
            <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
