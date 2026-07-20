import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, Goal, Habit, HabitCompletion, RecurringDefinition, WeeklySnapshot } from '@/types/models'

export class MomentumDB extends Dexie {
  goals!: EntityTable<Goal, 'id'>
  recurringDefinitions!: EntityTable<RecurringDefinition, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitCompletions!: EntityTable<HabitCompletion, 'id'>
  weeklySnapshots!: EntityTable<WeeklySnapshot, 'weekId'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('momentum-db')

    // Note: IndexedDB keys cannot be booleans, so boolean fields (completed,
    // archived, active, rolledOver) are intentionally left out of the index
    // list below and filtered in JS after a keyed query instead.
    this.version(1).stores({
      goals: 'id, type, currentWeekId, originalWeekId, dateISO, deadlineISO, createdAt',
      habits: 'id, frequency, order',
      habitCompletions: 'id, habitId, periodId, [habitId+periodId], completedAt',
      weeklySnapshots: 'weekId, weekStart',
      settings: 'id',
    })

    // v2: redesigned goal/task time model (Scheduled / Weekly / Today Only /
    // Recurring), recurring-task definitions + occurrences, and an extended
    // WeeklySnapshot that keeps long-term aggregates for every task kind.
    //
    // Migration mapping decision (documented, safe, non-destructive):
    //   - v1 `type: 'weekly'` -> v2 `kind: 'weekly'`, unchanged fields.
    //   - v1 `type: 'daily'` -> v2 `kind: 'today'` (NOT 'scheduled'). In v1, a
    //     daily goal only ever appeared on Home when `dateISO === today` and
    //     simply stopped appearing afterward (never "late"). That is exactly
    //     the new 'today' semantics, so this mapping preserves existing
    //     behavior exactly for every already-stored goal. Users get the new
    //     "Scheduled Task" (with Late tracking) as an explicit choice for
    //     anything created going forward.
    //   - v1 `dateISO` -> v2 `scheduledDateISO`.
    //   - v1 WeeklySnapshot counters are additively mapped onto the v2 shape
    //     (see fields below); nothing is dropped.
    this.version(2)
      .stores({
        goals:
          'id, kind, currentWeekId, originalWeekId, scheduledDateISO, deadlineISO, createdAt, recurringDefinitionId',
        recurringDefinitions: 'id, active, createdAt',
        habits: 'id, frequency, order',
        habitCompletions: 'id, habitId, periodId, [habitId+periodId], completedAt',
        weeklySnapshots: 'weekId, weekStart',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('goals')
          .toCollection()
          .modify((goal: Record<string, unknown>) => {
            const legacyType = goal.type as 'daily' | 'weekly' | undefined
            goal.kind = legacyType === 'weekly' ? 'weekly' : 'today'
            if (typeof goal.dateISO === 'string') goal.scheduledDateISO = goal.dateISO
            delete goal.type
            delete goal.dateISO
          })

        await tx
          .table('weeklySnapshots')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            const totalPlanned = (s.totalPlanned as number) ?? 0
            const completed = (s.completed as number) ?? 0
            const rolledOver = (s.rolledOver as number) ?? 0
            const completionPct = (s.completionPct as number) ?? 0
            const withDeadline = (s.withDeadline as number) ?? 0
            const completedBeforeDeadline = (s.completedBeforeDeadline as number) ?? 0
            const completedAfterDeadline = (s.completedAfterDeadline as number) ?? 0
            const dailyGoalsPlanned = (s.dailyGoalsPlanned as number) ?? 0
            const dailyGoalsCompleted = (s.dailyGoalsCompleted as number) ?? 0

            s.weeklyPlanned = totalPlanned
            s.weeklyCompleted = completed
            s.weeklyRolledOver = rolledOver
            s.weeklyCompletionPct = completionPct

            s.scheduledPlanned = 0
            s.scheduledCompleted = 0
            s.scheduledCompletedLate = 0
            s.scheduledLateDaysSum = 0

            s.todayOnlyPlanned = dailyGoalsPlanned
            s.todayOnlyCompleted = dailyGoalsCompleted
            s.todayOnlyMissed = Math.max(0, dailyGoalsPlanned - dailyGoalsCompleted)

            s.recurringPlanned = 0
            s.recurringCompleted = 0
            s.recurringCompletedLate = 0
            s.recurringLateDaysSum = 0

            s.deadlinesDue = withDeadline
            s.deadlinesMetOnTime = completedBeforeDeadline
            s.deadlinesMetLate = completedAfterDeadline
            s.deadlinesMissed = Math.max(0, withDeadline - completedBeforeDeadline - completedAfterDeadline)

            delete s.totalPlanned
            delete s.completed
            delete s.notCompleted
            delete s.completionPct
            delete s.withDeadline
            delete s.completedBeforeDeadline
            delete s.completedAfterDeadline
            delete s.dailyGoalsPlanned
            delete s.dailyGoalsCompleted
          })
      })
  }
}

export const db = new MomentumDB()

export async function initSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app')
  if (existing) return existing
  const fresh: AppSettings = {
    id: 'app',
    theme: 'system',
    lastWeekIdSeen: null,
    lastCleanupAt: null,
    onboarded: false,
  }
  await db.settings.put(fresh)
  return fresh
}
