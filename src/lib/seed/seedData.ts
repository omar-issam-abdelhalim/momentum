import { db } from '@/lib/db/db'
import { createId } from '@/lib/id'
import { formatDateOnly, getCurrentWeekId, getPreviousWeekId, getTodayISO, subDays, weekIdToStart } from '@/lib/date/week'
import type { Goal, Habit, HabitCompletion, RecurringDefinition, WeeklySnapshot } from '@/types/models'

/**
 * Populates the local database with realistic sample data spanning every
 * task kind — Scheduled (including a Late one), Weekly (plain and rolled
 * over), Today Only, a Recurring definition with occurrences, daily/weekly
 * habits with streak history, and several weeks of snapshot history for
 * Analytics. Dev-only: wired to a button that only renders when
 * import.meta.env.DEV is true (see SettingsScreen). Never runs automatically.
 */
export async function seedDevData(): Promise<void> {
  const now = Date.now()
  const currentWeekId = getCurrentWeekId()
  const todayISO = getTodayISO()
  const yesterdayISO = formatDateOnly(subDays(new Date(), 1))
  const twoDaysAgoISO = formatDateOnly(subDays(new Date(), 2))

  const goals: Goal[] = [
    {
      id: createId(),
      title: 'Submit expense report',
      kind: 'weekly',
      deadlineISO: formatDateOnly(subDays(new Date(), -1)),
      createdAt: now - 2 * 86400000,
      completedAt: null,
      completed: false,
      originalWeekId: currentWeekId,
      currentWeekId,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Renew car insurance',
      kind: 'weekly',
      deadlineISO: formatDateOnly(subDays(new Date(), -4)),
      createdAt: now - 5 * 86400000,
      completedAt: null,
      completed: false,
      originalWeekId: currentWeekId,
      currentWeekId,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Finish the Q3 planning doc',
      kind: 'weekly',
      createdAt: now - 12 * 86400000,
      completedAt: null,
      completed: false,
      originalWeekId: getPreviousWeekId(currentWeekId),
      currentWeekId,
      rolledOver: true,
      rolloverCount: 1,
      archived: false,
    },
    {
      id: createId(),
      title: 'Read one chapter of a book',
      kind: 'weekly',
      createdAt: now - 1 * 86400000,
      completedAt: null,
      completed: false,
      originalWeekId: currentWeekId,
      currentWeekId,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Deep-clean the kitchen',
      kind: 'weekly',
      createdAt: now - 3 * 86400000,
      completedAt: now - 1 * 86400000,
      completed: true,
      originalWeekId: currentWeekId,
      currentWeekId,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Study Monday lecture',
      kind: 'scheduled',
      scheduledDateISO: twoDaysAgoISO,
      createdAt: now - 2 * 86400000,
      completedAt: null,
      completed: false,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Finish project draft',
      kind: 'scheduled',
      scheduledDateISO: yesterdayISO,
      deadlineISO: todayISO,
      createdAt: now - 1 * 86400000,
      completedAt: null,
      completed: false,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Call Ahmed today',
      kind: 'today',
      scheduledDateISO: todayISO,
      createdAt: now,
      completedAt: null,
      completed: false,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
    {
      id: createId(),
      title: 'Pick up dry cleaning',
      kind: 'today',
      scheduledDateISO: todayISO,
      createdAt: now,
      completedAt: now,
      completed: true,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
  ]

  const recurringDefinitions: RecurringDefinition[] = [
    {
      id: createId(),
      title: 'Study Tuesday lecture',
      recurrenceType: 'weekly',
      weekdays: [2],
      active: true,
      createdAt: now - 21 * 86400000,
      lastGeneratedThroughISO: todayISO,
    },
  ]

  const recurringOccurrences: Goal[] = [
    {
      id: createId(),
      title: 'Study Tuesday lecture',
      kind: 'recurring',
      scheduledDateISO: yesterdayISO,
      recurringDefinitionId: recurringDefinitions[0].id,
      createdAt: now - 1 * 86400000,
      completedAt: null,
      completed: false,
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    },
  ]

  const habits: Habit[] = [
    { id: createId(), name: 'Drink water', frequency: 'daily', icon: 'droplet', order: 0, active: true, createdAt: now - 20 * 86400000 },
    { id: createId(), name: 'Read', frequency: 'daily', icon: 'book', order: 1, active: true, createdAt: now - 20 * 86400000 },
    { id: createId(), name: 'Meditate', frequency: 'daily', icon: 'brain', order: 2, active: true, createdAt: now - 20 * 86400000 },
    { id: createId(), name: 'Weekly review', frequency: 'weekly', icon: 'pen', order: 3, active: true, createdAt: now - 40 * 86400000 },
  ]

  const completions: HabitCompletion[] = []
  // 6-day streak for "Drink water", one gap for "Read", steady weekly review.
  for (let i = 1; i <= 6; i++) {
    completions.push({
      id: createId(),
      habitId: habits[0].id,
      periodId: formatDateOnly(subDays(new Date(), i)),
      completedAt: now - i * 86400000,
    })
  }
  for (const i of [1, 2, 4, 5]) {
    completions.push({
      id: createId(),
      habitId: habits[1].id,
      periodId: formatDateOnly(subDays(new Date(), i)),
      completedAt: now - i * 86400000,
    })
  }
  let weekCursor = currentWeekId
  for (let i = 0; i < 4; i++) {
    weekCursor = getPreviousWeekId(weekCursor)
    completions.push({ id: createId(), habitId: habits[3].id, periodId: weekCursor, completedAt: weekIdToStart(weekCursor).getTime() })
  }

  const snapshots: WeeklySnapshot[] = []
  const completionPcts = [45, 60, 55, 70, 65, 80, 90]
  let snapWeek = currentWeekId
  for (let i = 0; i < completionPcts.length; i++) {
    snapWeek = getPreviousWeekId(snapWeek)
    const targetPct = completionPcts[completionPcts.length - 1 - i]
    const planned = 5
    const completed = Math.round((planned * targetPct) / 100)
    const start = weekIdToStart(snapWeek)
    snapshots.push({
      weekId: snapWeek,
      weekStart: start.getTime(),
      weekEnd: start.getTime() + 6 * 86400000,
      weeklyPlanned: planned,
      weeklyCompleted: completed,
      weeklyRolledOver: planned - completed,
      weeklyCompletionPct: Math.round((completed / planned) * 100),
      scheduledPlanned: 3,
      scheduledCompleted: 2,
      scheduledCompletedLate: 1,
      scheduledLateDaysSum: 2,
      todayOnlyPlanned: 3,
      todayOnlyCompleted: 2,
      todayOnlyMissed: 1,
      recurringPlanned: 1,
      recurringCompleted: 1,
      recurringCompletedLate: 0,
      recurringLateDaysSum: 0,
      deadlinesDue: 2,
      deadlinesMetOnTime: 1,
      deadlinesMetLate: Math.max(0, completed - 1),
      deadlinesMissed: 0,
      createdAt: start.getTime() + 7 * 86400000,
    })
  }

  await db.transaction(
    'rw',
    db.goals,
    db.recurringDefinitions,
    db.habits,
    db.habitCompletions,
    db.weeklySnapshots,
    async () => {
      await db.goals.bulkAdd([...goals, ...recurringOccurrences])
      await db.recurringDefinitions.bulkAdd(recurringDefinitions)
      await db.habits.bulkAdd(habits)
      await db.habitCompletions.bulkAdd(completions)
      await db.weeklySnapshots.bulkAdd(snapshots)
    },
  )
}
