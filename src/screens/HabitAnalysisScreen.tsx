import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronDown, Flame, Play, Target, TrendingUp } from 'lucide-react'
import { db } from '@/lib/db/db'
import { resumeHabit } from '@/lib/db/habits.repo'
import { formatDateOnly, getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import { formatShortDate } from '@/lib/date/format'
import {
  computeEpochStats,
  computeLifetimeSummary,
  defaultEpochSelectionId,
  getClosedEpochsMostRecentFirst,
  getOpenEpoch,
  resolveEpochSelection,
} from '@/lib/logic/epochs'
import { HabitConsistencyGrid } from '@/components/habits/HabitConsistencyGrid'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { HabitEpoch } from '@/types/models'

interface HabitAnalysisScreenProps {
  habitId: string
  onBack: () => void
}

function epochLabel(epoch: HabitEpoch): string {
  const start = formatShortDate(formatDateOnly(new Date(epoch.startDate)))
  const end = epoch.endDate ? formatShortDate(formatDateOnly(new Date(epoch.endDate))) : start
  return `${start} – ${end}`
}

function formatDuration(days: number): string {
  if (days <= 0) return 'Same day'
  if (days === 1) return '1 day'
  if (days < 14) return `${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'}`
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof TrendingUp }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
      <div className="mb-1 flex items-center gap-1.5 text-ink-faint">
        <Icon size={13} aria-hidden="true" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

export function HabitAnalysisScreen({ habitId, onBack }: HabitAnalysisScreenProps) {
  const habit = useLiveQuery(() => db.habits.get(habitId), [habitId])
  const completions = useLiveQuery(() => db.habitCompletions.where('habitId').equals(habitId).toArray(), [habitId])
  const { showToast } = useToast()

  const [selectedEpochId, setSelectedEpochId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()

  const activeSelectionId = selectedEpochId ?? (habit ? defaultEpochSelectionId(habit) : 'now')

  const selectedEpoch = useMemo(() => {
    if (!habit) return undefined
    return resolveEpochSelection(habit, activeSelectionId)
  }, [habit, activeSelectionId])

  const selectedStats = useMemo(() => {
    if (!habit || !selectedEpoch || !completions) return null
    return computeEpochStats(habit, selectedEpoch, completions, todayISO, currentWeekId)
  }, [habit, selectedEpoch, completions, todayISO, currentWeekId])

  const lifetime = useMemo(() => {
    if (!habit || !completions) return null
    return computeLifetimeSummary(habit, completions, todayISO, currentWeekId)
  }, [habit, completions, todayISO, currentWeekId])

  if (!habit || !completions) {
    return <div className="fixed inset-0 z-50 bg-surface" aria-busy="true" />
  }

  const openEpoch = getOpenEpoch(habit)
  const closedEpochs = getClosedEpochsMostRecentFirst(habit)
  const hasEverPaused = closedEpochs.length > 0
  const isPaused = habit.status === 'paused'

  const handleResume = async () => {
    await resumeHabit(habit.id)
    showToast(`${habit.name} resumed`)
  }

  const pctLabel = (v: number | null) => (v === null ? '—' : `${v}%`)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
      <div className="mx-auto max-w-md px-4 pb-16 pt-6 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-ink">{habit.name}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isPaused ? 'bg-surface-sunken text-ink-muted' : 'bg-accent-muted text-accent'
              }`}
            >
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
          {isPaused && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={handleResume}>
              <Play size={14} aria-hidden="true" />
              Resume
            </Button>
          )}
        </header>

        <section aria-labelledby="quick-stats-heading" className="mb-5">
          <h2 id="quick-stats-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Quick stats
          </h2>
          <div className="flex gap-2.5">
            <StatTile label="Current streak" value={String(selectedStats?.currentStreak ?? 0)} icon={Flame} />
            <StatTile label="Best streak" value={String(selectedStats?.bestStreak ?? 0)} icon={Target} />
            <StatTile label="Completion" value={pctLabel(selectedStats?.completionRatePct ?? null)} icon={TrendingUp} />
          </div>
        </section>

        <section aria-labelledby="epoch-selector-heading" className="mb-5">
          <h2 id="epoch-selector-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Period
          </h2>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {openEpoch && (
              <button
                type="button"
                onClick={() => setSelectedEpochId('now')}
                aria-pressed={activeSelectionId === 'now'}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeSelectionId === 'now'
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                Now
              </button>
            )}
            {closedEpochs.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedEpochId(e.id)}
                aria-pressed={activeSelectionId === e.id}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeSelectionId === e.id
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {epochLabel(e)}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="grid-heading" className="mb-6">
          <h2 id="grid-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Consistency
          </h2>
          {selectedEpoch ? (
            <HabitConsistencyGrid habit={habit} epoch={selectedEpoch} completions={completions} />
          ) : (
            <p className="text-xs text-ink-muted">No period selected.</p>
          )}
        </section>

        {hasEverPaused && lifetime && (
          <section aria-labelledby="lifetime-heading" className="mb-6">
            <h2 id="lifetime-heading" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Lifetime summary
            </h2>
            <p className="mb-2 text-[11px] text-ink-faint">
              All-time, summed across {lifetime.epochCount} separate period{lifetime.epochCount === 1 ? '' : 's'} — not one
              continuous streak.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-surface-raised p-3 text-center shadow-soft">
                <p className="text-lg font-semibold tabular-nums text-ink">{lifetime.totalCompletions}</p>
                <p className="text-[10px] text-ink-faint">Total completions</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-raised p-3 text-center shadow-soft">
                <p className="text-lg font-semibold tabular-nums text-ink">
                  {formatDuration(Math.round(lifetime.totalActiveDurationMs / 86400000))}
                </p>
                <p className="text-[10px] text-ink-faint">Total active time</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-raised p-3 text-center shadow-soft">
                <p className="text-lg font-semibold tabular-nums text-ink">{lifetime.bestStreakEver}</p>
                <p className="text-[10px] text-ink-faint">Best streak ever</p>
              </div>
            </div>
          </section>
        )}

        {hasEverPaused && (
          <section aria-labelledby="epoch-history-heading">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-muted"
            >
              <span id="epoch-history-heading">Epoch history ({closedEpochs.length})</span>
              <ChevronDown size={14} className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
            {historyOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {closedEpochs.map((e) => {
                  const stats = computeEpochStats(habit, e, completions, todayISO, currentWeekId)
                  return (
                    <div key={e.id} className="rounded-xl border border-border bg-surface-raised p-3.5 shadow-soft">
                      <p className="text-sm font-medium text-ink">{epochLabel(e)}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatDuration(stats.durationDays)} · {stats.totalCompletions} completions ·{' '}
                        {pctLabel(stats.completionRatePct)} · best streak {stats.bestStreak}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
