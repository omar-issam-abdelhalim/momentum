import { db } from './db'
import { createId } from '@/lib/id'
import type { Priority, RecurrenceType, RecurringDefinition } from '@/types/models'

export interface CreateRecurringDefinitionInput {
  title: string
  description?: string
  recurrenceType: RecurrenceType
  weekdays?: number[]
  priority?: Priority
}

export async function createRecurringDefinition(input: CreateRecurringDefinitionInput): Promise<RecurringDefinition> {
  const def: RecurringDefinition = {
    id: createId(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    recurrenceType: input.recurrenceType,
    weekdays: input.recurrenceType === 'weekly' ? [...(input.weekdays ?? [])].sort() : undefined,
    priority: input.priority,
    active: true,
    createdAt: Date.now(),
    lastGeneratedThroughISO: null,
  }
  await db.recurringDefinitions.add(def)
  return def
}

export interface UpdateRecurringDefinitionInput {
  title?: string
  description?: string
  recurrenceType?: RecurrenceType
  weekdays?: number[]
  priority?: Priority
}

export async function updateRecurringDefinition(id: string, input: UpdateRecurringDefinitionInput): Promise<void> {
  const patch: Partial<RecurringDefinition> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.recurrenceType !== undefined) patch.recurrenceType = input.recurrenceType
  if (input.weekdays !== undefined) patch.weekdays = [...input.weekdays].sort()
  if (input.priority !== undefined) patch.priority = input.priority
  await db.recurringDefinitions.update(id, patch)
}

/** Deactivates the definition so future generation stops. Past occurrences (already-created Goal rows) are preserved untouched. */
export async function deactivateRecurringDefinition(id: string): Promise<void> {
  await db.recurringDefinitions.update(id, { active: false })
}

export async function deleteRecurringDefinition(id: string): Promise<void> {
  await db.recurringDefinitions.delete(id)
}

export async function getActiveRecurringDefinitions(): Promise<RecurringDefinition[]> {
  const all = await db.recurringDefinitions.toArray()
  return all.filter((d) => d.active)
}

export async function getAllRecurringDefinitions(): Promise<RecurringDefinition[]> {
  return db.recurringDefinitions.toArray()
}
