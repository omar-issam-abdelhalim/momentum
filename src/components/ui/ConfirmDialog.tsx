import { BottomSheet } from './BottomSheet'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-muted">{description}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}
