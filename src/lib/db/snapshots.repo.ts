import { db } from './db'
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
