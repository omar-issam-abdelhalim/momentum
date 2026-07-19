import { db } from '@/lib/db/db'
import { createId } from '@/lib/id'
import { formatDateOnly, getCurrentWeekId, getPreviousWeekId, getTodayISO, subDays, weekIdToStart } from '@/lib/date/week'
import type { Goal, Habit, HabitCompletion, WeeklySnapshot } from '@/types/models'

/**
 * Populates the local database with realistic sample data — deadline goals,
 * rolled-over goals, plain weekly goals, daily goals, daily/weekly habits
 * with streak history, and several weeks of snapshot history for
 * Analytics. Dev-only: wired to a button that only renders when
 * import.meta.env.DEV is true (see SettingsScreen). Never runs automatically.
 */
export async function seedDevData(): Promise<void> {
  const now = Date.now()
  const currentWeekId = getCurrentWeekId()
  const todayISO = getTodayISO()

  const goals: Goal[] = [
    {
      id: createId(),
      title: 'Submit expense report',
      type: 'weekly',
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
      type: 'weekly',
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
      type: 'weekly',
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
      type: 'weekly',
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
      type: 'weekly',
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
      title: 'Morning run',
      type: 'daily',
      dateISO: todayISO,
      createdAt: now,
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
      title: 'Call the dentist',
      type: 'daily',
      dateISO: todayISO,
      createdAt: now,
      completedAt: now,
      completed: true,
      originalWeekId: currentWeekId,
      currentWeekId,
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
    // Derive the displayed percentage from the actual completed/planned counts
    // rather than reusing targetPct directly — rounding `completed` means the
    // two can otherwise disagree (e.g. 2/5 stored as "45%" instead of 40%).
    const completionPct = Math.round((completed / planned) * 100)
    const start = weekIdToStart(snapWeek)
    snapshots.push({
      weekId: snapWeek,
      weekStart: start.getTime(),
      weekEnd: start.getTime() + 6 * 86400000,
      totalPlanned: planned,
      completed,
      notCompleted: planned - completed,
      completionPct,
      rolledOver: planned - completed,
      withDeadline: 2,
      completedBeforeDeadline: 1,
      completedAfterDeadline: Math.max(0, completed - 1),
      dailyGoalsPlanned: 3,
      dailyGoalsCompleted: 2,
      createdAt: start.getTime() + 7 * 86400000,
    })
  }

  await db.transaction('rw', db.goals, db.habits, db.habitCompletions, db.weeklySnapshots, async () => {
    await db.goals.bulkAdd(goals)
    await db.habits.bulkAdd(habits)
    await db.habitCompletions.bulkAdd(completions)
    await db.weeklySnapshots.bulkAdd(snapshots)
  })
}
