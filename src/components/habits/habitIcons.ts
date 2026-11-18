import {
  Activity,
  BookOpen,
  Brain,
  Droplet,
  Dumbbell,
  Moon,
  PenLine,
  Salad,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react'

/** Icon choices offered for a habit, keyed by the id stored on the Habit record. */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  activity: Activity,
  book: BookOpen,
  brain: Brain,
  droplet: Droplet,
  dumbbell: Dumbbell,
  moon: Moon,
  pen: PenLine,
  salad: Salad,
  sun: Sun,
}
