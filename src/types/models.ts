/**
 * Core data model. IDs are client-generated UUIDs. All timestamps are epoch
 * milliseconds. Dates that represent a calendar day (not an instant) are
 * stored as 'yyyy-MM-dd' strings so they are immune to timezone drift.
 */

export type GoalType = 'daily' | 'weekly'
export type Priority = 'low' | 'medium' | 'high'

export interface Goal {
  id: string
  title: string
  description?: string
  type: GoalType

  /** For daily goals: the calendar day it belongs to, 'yyyy-MM-dd'. Unused for weekly goals. */
  dateISO?: string

  /** Optional deadline as a calendar day, 'yyyy-MM-dd'. Treated as end-of-day local time. */
  deadlineISO?: string

  priority?: Priority

  createdAt: number
  completedAt: number | null
  completed: boolean

  /** The custom week id this goal was first created in. Never changes. */
  originalWeekId: string
  /** The custom week id this goal currently belongs to. Advances on rollover. */
  currentWeekId: string

  rolledOver: boolean
  rolloverCount: number

  archived: boolean
}

export type HabitFrequency = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  description?: string
  frequency: HabitFrequency
  icon?: string
  order: number
  active: boolean
  createdAt: number
}

export interface HabitCompletion {
  id: string
  habitId: string
  /** 'yyyy-MM-dd' for daily habits, weekId for weekly habits. */
  periodId: string
  completedAt: number
}

export interface WeeklySnapshot {
  weekId: string
  weekStart: number
  weekEnd: number

  totalPlanned: number
  completed: number
  notCompleted: number
  completionPct: number

  rolledOver: number

  withDeadline: number
  completedBeforeDeadline: number
  completedAfterDeadline: number

  dailyGoalsPlanned: number
  dailyGoalsCompleted: number

  createdAt: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface AppSettings {
  id: 'app'
  theme: ThemePreference
  lastWeekIdSeen: string | null
  lastCleanupAt: number | null
  onboarded: boolean
}

/** Shape of an exported backup file. */
export interface BackupFile {
  schemaVersion: number
  exportedAt: number
  appVersion: string
  data: {
    goals: Goal[]
    habits: Habit[]
    habitCompletions: HabitCompletion[]
    weeklySnapshots: WeeklySnapshot[]
    settings: AppSettings[]
  }
}
