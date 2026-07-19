import { BottomSheet } from './BottomSheet'
import type { LucideIcon } from 'lucide-react'

export interface ActionSheetItem {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title: string
  items: ActionSheetItem[]
}

export function ActionSheet({ open, onClose, title, items }: ActionSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="-mx-1 flex flex-col">
        {items.map(({ label, icon: Icon, onSelect, destructive }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onSelect()
              onClose()
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-surface-sunken ${
              destructive ? 'text-danger' : 'text-ink'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
