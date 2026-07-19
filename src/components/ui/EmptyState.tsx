import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-surface-sunken">
        <Icon size={20} className="text-ink-faint" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-[26ch] text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
