import { db } from './db'
import { gatherSnapshotPool } from './snapshotPool'
import { getCurrentWeekId } from '@/lib/date/week'
import { buildWeeklySnapshot } from '@/lib/logic/rollover'
import type { WeeklySnapshot } from '@/types/models'

export async function upsertSnapshot(snapshot: WeeklySnapshot): Promise<void> {
  await db.weeklySnapshots.put(snapshot)
}

export async function getSnapshot(weekId: string): Promise<WeeklySnapshot | undefined> {
  return db.weeklySnapshots.get(weekId)
}

export async function getAllSnapshots(): Promise<WeeklySnapshot[]> {
  const all = await db.weeklySnapshots.toArray()
  return all.sort((a, b) => a.weekStart - b.weekStart)
}

export async function getRecentSnapshots(limit: number): Promise<WeeklySnapshot[]> {
  const all = await getAllSnapshots()
  return all.slice(Math.max(0, all.length - limit))
}

/**
 * Stats for `weekId`: the stored permanent snapshot if that week has
 * already closed, or a freshly computed live snapshot if it's the current
 * (still-open) week — which never has a stored snapshot until it closes.
 */
export async function getSnapshotForWeek(weekId: string): Promise<WeeklySnapshot> {
  const stored = await db.weeklySnapshots.get(weekId)
  if (stored) return stored
  const pool = await gatherSnapshotPool(weekId)
  return buildWeeklySnapshot(weekId, pool)
}

/**
 * All permanent snapshots, plus a freshly computed live snapshot for the
 * current week appended if it isn't stored yet (it never is, until it
 * closes) — so Analytics ranges that include "now" stay accurate without
 * waiting for the week to close.
 */
export async function getAllSnapshotsIncludingLive(): Promise<WeeklySnapshot[]> {
  const stored = await getAllSnapshots()
  const currentWeekId = getCurrentWeekId()
  if (stored.some((s) => s.weekId === currentWeekId)) return stored
  const live = await getSnapshotForWeek(currentWeekId)
  return [...stored, live].sort((a, b) => a.weekStart - b.weekStart)
}
