import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup, validateBackupFile } from './backup'
import { db } from '@/lib/db/db'
import type { BackupFile } from '@/types/models'

function validBackup(): BackupFile {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    data: {
      goals: [
        {
          id: 'g1',
          title: 'Test goal',
          type: 'weekly',
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
      habits: [
        { id: 'h1', name: 'Read', frequency: 'daily', order: 0, active: true, createdAt: Date.now() },
      ],
      habitCompletions: [{ id: 'c1', habitId: 'h1', periodId: '2026-07-18', completedAt: Date.now() }],
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
          withDeadline: 0,
          completedBeforeDeadline: 0,
          completedAfterDeadline: 0,
          dailyGoalsPlanned: 0,
          dailyGoalsCompleted: 0,
          createdAt: Date.now(),
        },
      ],
      settings: [{ id: 'app', theme: 'system', lastWeekIdSeen: '2026-07-18', lastCleanupAt: null, onboarded: true }],
    },
  }
}

describe('validateBackupFile', () => {
  it('accepts a well-formed backup', () => {
    const result = validateBackupFile(validBackup())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects non-object input', () => {
    expect(validateBackupFile('not json').valid).toBe(false)
    expect(validateBackupFile(null).valid).toBe(false)
    expect(validateBackupFile([1, 2, 3]).valid).toBe(false)
  })

  it('rejects a backup missing the data section', () => {
    const result = validateBackupFile({ schemaVersion: 1, exportedAt: Date.now() })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing data section.')
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
})

describe('importBackup', () => {
  beforeEach(async () => {
    await db.goals.clear()
    await db.habits.clear()
    await db.habitCompletions.clear()
    await db.weeklySnapshots.clear()
    await db.settings.clear()
  })

  it('replaces existing data with the backup contents', async () => {
    await db.goals.add({
      id: 'stale',
      title: 'Old data',
      type: 'weekly',
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
  })

  it('round-trips through buildBackup', async () => {
    await importBackup(validBackup())
    const rebuilt = await buildBackup()
    expect(rebuilt.data.goals).toHaveLength(1)
    expect(rebuilt.data.habits).toHaveLength(1)
    expect(rebuilt.data.weeklySnapshots).toHaveLength(1)
  })
})
