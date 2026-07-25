import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup, migrateBackupToLatest, validateBackupFile } from './backup'
import { db } from '@/lib/db/db'
import type { BackupFile } from '@/types/models'

function validBackup(): BackupFile {
  return {
    schemaVersion: 2,
    exportedAt: Date.now(),
    appVersion: '2.0.0',
    data: {
      goals: [
        {
          id: 'g1',
          title: 'Test goal',
          kind: 'weekly',
          createdAt: Date.now(),
          completedAt: null,
          completed: false,
          originalWeekId: '2026-07-18',
          currentWeekId: '2026-07-18',
          rolledOver: false,
          rolloverCount: 0,
          archived: false,
        },
      ],
      recurringDefinitions: [
        {
          id: 'r1',
          title: 'Study Tuesday lecture',
          recurrenceType: 'weekly',
          weekdays: [2],
          active: true,
          createdAt: Date.now(),
          lastGeneratedThroughISO: '2026-07-18',
        },
      ],
      habits: [
        { id: 'h1', name: 'Read', frequency: 'daily', order: 0, active: true, createdAt: Date.now() } as unknown as BackupFile['data']['habits'][number],
      ],
      habitCompletions: [{ id: 'c1', habitId: 'h1', periodId: '2026-07-18', completedAt: Date.now() }],
      weeklySnapshots: [
        {
          weekId: '2026-07-11',
          weekStart: 0,
          weekEnd: 0,
          weeklyPlanned: 3,
          weeklyCompleted: 2,
          weeklyRolledOver: 1,
          weeklyCompletionPct: 67,
          scheduledPlanned: 0,
          scheduledCompleted: 0,
          scheduledCompletedLate: 0,
          scheduledLateDaysSum: 0,
          todayOnlyPlanned: 0,
          todayOnlyCompleted: 0,
          todayOnlyMissed: 0,
          recurringPlanned: 0,
          recurringCompleted: 0,
          recurringCompletedLate: 0,
          recurringLateDaysSum: 0,
          deadlinesDue: 0,
          deadlinesMetOnTime: 0,
          deadlinesMetLate: 0,
          deadlinesMissed: 0,
          createdAt: Date.now(),
        },
      ],
      settings: [{ id: 'app', theme: 'system', lastWeekIdSeen: '2026-07-18', lastCleanupAt: null, onboarded: true }],
    },
  }
}

function legacyV1Backup(): BackupFile {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    data: {
      goals: [
        {
          id: 'legacy-weekly',
          title: 'Legacy weekly goal',
          type: 'weekly',
          createdAt: Date.now(),
          completedAt: null,
          completed: false,
          originalWeekId: '2026-07-18',
          currentWeekId: '2026-07-18',
          rolledOver: false,
          rolloverCount: 0,
          archived: false,
        } as unknown as BackupFile['data']['goals'][number],
        {
          id: 'legacy-daily',
          title: 'Legacy daily goal',
          type: 'daily',
          dateISO: '2026-07-20',
          createdAt: Date.now(),
          completedAt: null,
          completed: false,
          originalWeekId: '2026-07-18',
          currentWeekId: '2026-07-18',
          rolledOver: false,
          rolloverCount: 0,
          archived: false,
        } as unknown as BackupFile['data']['goals'][number],
      ],
      recurringDefinitions: [],
      habits: [
        { id: 'h1', name: 'Read', frequency: 'daily', order: 0, active: true, createdAt: Date.now() } as unknown as BackupFile['data']['habits'][number],
      ],
      habitCompletions: [],
      weeklySnapshots: [
        {
          weekId: '2026-07-11',
          weekStart: 0,
          weekEnd: 0,
          totalPlanned: 3,
          completed: 2,
          notCompleted: 1,
          completionPct: 67,
          rolledOver: 1,
          withDeadline: 1,
          completedBeforeDeadline: 1,
          completedAfterDeadline: 0,
          dailyGoalsPlanned: 2,
          dailyGoalsCompleted: 1,
          createdAt: Date.now(),
        } as unknown as BackupFile['data']['weeklySnapshots'][number],
      ],
      settings: [{ id: 'app', theme: 'system', lastWeekIdSeen: '2026-07-18', lastCleanupAt: null, onboarded: true }],
    },
  }
}

describe('validateBackupFile', () => {
  it('accepts a well-formed current-version backup', () => {
    const result = validateBackupFile(validBackup())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts a well-formed legacy v1 backup', () => {
    const result = validateBackupFile(legacyV1Backup())
    expect(result.valid).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(validateBackupFile('not json').valid).toBe(false)
    expect(validateBackupFile(null).valid).toBe(false)
    expect(validateBackupFile([1, 2, 3]).valid).toBe(false)
  })

  it('rejects a backup missing the data section', () => {
    const result = validateBackupFile({ schemaVersion: 2, exportedAt: Date.now() })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing data section.')
  })

  it('rejects an unsupported schema version', () => {
    const backup = validBackup()
    backup.schemaVersion = 99
    const result = validateBackupFile(backup)
    expect(result.valid).toBe(false)
  })

  it('rejects malformed goal records', () => {
    const backup = validBackup()
    // @ts-expect-error intentionally malformed for the test
    backup.data.goals = [{ id: 'bad' }]
    const result = validateBackupFile(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('goals'))).toBe(true)
  })

  it('rejects an invalid theme value', () => {
    const backup = validBackup()
    // @ts-expect-error intentionally malformed for the test
    backup.data.settings[0].theme = 'rainbow'
    const result = validateBackupFile(backup)
    expect(result.valid).toBe(false)
  })

  it('accepts a well-formed v3 backup with status/epochs habits', () => {
    const backup = validBackup()
    backup.schemaVersion = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        order: 0,
        status: 'active',
        epochs: [{ id: 'e1', startDate: 0, endDate: null }],
        createdAt: 0,
      },
    ]
    const result = validateBackupFile(backup)
    expect(result.valid).toBe(true)
  })

  it('accepts a well-formed v4 backup with counter-completion fields populated', () => {
    const backup = validBackup()
    backup.schemaVersion = 4
    backup.data.goals[0].targetCount = 5
    backup.data.goals[0].currentCount = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        dailyTarget: 3,
        order: 0,
        status: 'active',
        epochs: [{ id: 'e1', startDate: 0, endDate: null }],
        createdAt: 0,
      },
    ]
    backup.data.habitCompletions[0].count = 2
    const result = validateBackupFile(backup)
    expect(result.valid).toBe(true)
  })
})

describe('migrateBackupToLatest', () => {
  it('maps legacy weekly goals through unchanged', () => {
    const migrated = migrateBackupToLatest(legacyV1Backup())
    const weekly = migrated.data.goals.find((g) => g.id === 'legacy-weekly')
    expect(weekly?.kind).toBe('weekly')
  })

  it('maps legacy daily goals to "today" (their v1 behavior never persisted past the day)', () => {
    const migrated = migrateBackupToLatest(legacyV1Backup())
    const daily = migrated.data.goals.find((g) => g.id === 'legacy-daily')
    expect(daily?.kind).toBe('today')
    expect(daily?.scheduledDateISO).toBe('2026-07-20')
  })

  it('maps legacy snapshot counters onto the v2 shape without losing data', () => {
    const migrated = migrateBackupToLatest(legacyV1Backup())
    const snapshot = migrated.data.weeklySnapshots[0]
    expect(snapshot.weeklyPlanned).toBe(3)
    expect(snapshot.weeklyCompleted).toBe(2)
    expect(snapshot.todayOnlyPlanned).toBe(2)
    expect(snapshot.todayOnlyCompleted).toBe(1)
    expect(snapshot.deadlinesDue).toBe(1)
  })

  it('leaves an already-current backup untouched aside from filling recurringDefinitions', () => {
    const migrated = migrateBackupToLatest(validBackup())
    expect(migrated.data.recurringDefinitions).toHaveLength(1)
  })

  it('migrates a pre-v3 (schemaVersion 2) habit to status/epochs using the same active-flag mapping as the live DB migration', () => {
    const migrated = migrateBackupToLatest(validBackup())
    const habit = migrated.data.habits[0]
    expect(habit.status).toBe('active')
    expect(habit.epochs).toHaveLength(1)
    expect(habit.epochs[0].endDate).toBeNull()
    expect((habit as unknown as { active?: boolean }).active).toBeUndefined()
  })

  it('migrates a legacy v1 habit to status/epochs as well', () => {
    const migrated = migrateBackupToLatest(legacyV1Backup())
    const habit = migrated.data.habits[0]
    expect(habit.status).toBe('active')
    expect(habit.epochs).toHaveLength(1)
  })

  it('leaves an already-v3 habit (status/epochs already present) untouched', () => {
    const backup = validBackup()
    backup.schemaVersion = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        order: 0,
        status: 'paused',
        epochs: [{ id: 'e1', startDate: 0, endDate: 100 }],
        createdAt: 0,
      },
    ]
    const migrated = migrateBackupToLatest(backup)
    expect(migrated.data.habits[0].status).toBe('paused')
    expect(migrated.data.habits[0].epochs).toEqual([{ id: 'e1', startDate: 0, endDate: 100 }])
  })
})

describe('importBackup', () => {
  beforeEach(async () => {
    await db.goals.clear()
    await db.recurringDefinitions.clear()
    await db.habits.clear()
    await db.habitCompletions.clear()
    await db.weeklySnapshots.clear()
    await db.settings.clear()
  })

  it('replaces existing data with the backup contents', async () => {
    await db.goals.add({
      id: 'stale',
      title: 'Old data',
      kind: 'weekly',
      createdAt: 0,
      completedAt: null,
      completed: false,
      originalWeekId: '2020-01-01',
      currentWeekId: '2020-01-01',
      rolledOver: false,
      rolloverCount: 0,
      archived: false,
    })

    await importBackup(validBackup())

    const goals = await db.goals.toArray()
    expect(goals).toHaveLength(1)
    expect(goals[0].id).toBe('g1')

    const habits = await db.habits.toArray()
    expect(habits).toHaveLength(1)

    const defs = await db.recurringDefinitions.toArray()
    expect(defs).toHaveLength(1)
  })

  it('round-trips through buildBackup', async () => {
    await importBackup(validBackup())
    const rebuilt = await buildBackup()
    expect(rebuilt.data.goals).toHaveLength(1)
    expect(rebuilt.data.habits).toHaveLength(1)
    expect(rebuilt.data.weeklySnapshots).toHaveLength(1)
    expect(rebuilt.data.recurringDefinitions).toHaveLength(1)
  })

  it('successfully imports a legacy v1 backup after migration', async () => {
    await importBackup(legacyV1Backup())
    const goals = await db.goals.toArray()
    expect(goals).toHaveLength(2)
    expect(goals.every((g) => g.kind !== undefined)).toBe(true)
  })

  it('round-trips habit status and epoch history through export/import', async () => {
    const backup = validBackup()
    backup.schemaVersion = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        order: 0,
        status: 'paused',
        epochs: [
          { id: 'e1', startDate: 100, endDate: 200 },
          { id: 'e2', startDate: 300, endDate: 400 },
        ],
        createdAt: 100,
      },
    ]
    await importBackup(backup)

    const habit = await db.habits.get('h1')
    expect(habit?.status).toBe('paused')
    expect(habit?.epochs).toHaveLength(2)

    const rebuilt = await buildBackup()
    const rebuiltHabit = rebuilt.data.habits.find((h) => h.id === 'h1')
    expect(rebuiltHabit?.status).toBe('paused')
    expect(rebuiltHabit?.epochs).toHaveLength(2)
  })

  it('imports a v3 (pre-feature) backup cleanly — counter fields resolve to undefined, exactly binary behavior', async () => {
    const backup = validBackup()
    backup.schemaVersion = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        order: 0,
        status: 'active',
        epochs: [{ id: 'e1', startDate: 0, endDate: null }],
        createdAt: 0,
      },
    ]
    await importBackup(backup)

    const goal = await db.goals.get('g1')
    expect(goal?.targetCount).toBeUndefined()
    expect(goal?.currentCount).toBeUndefined()

    const habit = await db.habits.get('h1')
    expect(habit?.dailyTarget).toBeUndefined()

    const completion = await db.habitCompletions.get('c1')
    expect(completion?.count).toBeUndefined()
  })

  it('round-trips a v4 backup with counter-completion fields populated', async () => {
    const backup = validBackup()
    backup.schemaVersion = 4
    backup.data.goals[0].targetCount = 5
    backup.data.goals[0].currentCount = 3
    backup.data.habits = [
      {
        id: 'h1',
        name: 'Read',
        frequency: 'daily',
        dailyTarget: 3,
        order: 0,
        status: 'active',
        epochs: [{ id: 'e1', startDate: 0, endDate: null }],
        createdAt: 0,
      },
    ]
    backup.data.habitCompletions[0].count = 2
    await importBackup(backup)

    const goal = await db.goals.get('g1')
    expect(goal?.targetCount).toBe(5)
    expect(goal?.currentCount).toBe(3)

    const habit = await db.habits.get('h1')
    expect(habit?.dailyTarget).toBe(3)

    const completion = await db.habitCompletions.get('c1')
    expect(completion?.count).toBe(2)

    const rebuilt = await buildBackup()
    expect(rebuilt.data.goals[0].targetCount).toBe(5)
    expect(rebuilt.data.habits[0].dailyTarget).toBe(3)
    expect(rebuilt.data.habitCompletions[0].count).toBe(2)
  })
})
