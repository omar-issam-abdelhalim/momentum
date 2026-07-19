import { useRef, useState } from 'react'
import { Download, FlaskConical, Info, Moon, Sun, Trash2, Upload, Monitor as MonitorIcon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { APP_CONFIG } from '@/config/app.config'
import { buildBackup, downloadBackup, importBackup, validateBackupFile } from '@/lib/backup/backup'
import { db } from '@/lib/db/db'
import { seedDevData } from '@/lib/seed/seedData'
import type { BackupFile, ThemePreference } from '@/types/models'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

export function SettingsScreen() {
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [storageEstimate, setStorageEstimate] = useState<string | null>(null)

  const handleExport = async () => {
    const backup = await buildBackup()
    downloadBackup(backup)
    showToast('Backup downloaded')
  }

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const { valid, errors } = validateBackupFile(parsed)
      if (!valid) {
        setImportError(errors.join(' '))
        return
      }
      setPendingImport(parsed as BackupFile)
    } catch {
      setImportError('That file could not be read as a valid backup.')
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    await importBackup(pendingImport)
    setPendingImport(null)
    showToast('Backup restored')
  }

  const handleClearAll = async () => {
    await db.transaction('rw', db.goals, db.habits, db.habitCompletions, db.weeklySnapshots, db.settings, async () => {
      await Promise.all([
        db.goals.clear(),
        db.habits.clear(),
        db.habitCompletions.clear(),
        db.weeklySnapshots.clear(),
        db.settings.clear(),
      ])
    })
    setConfirmClearOpen(false)
    showToast('All data cleared')
    window.location.reload()
  }

  const loadStorageEstimate = async () => {
    if (!navigator.storage?.estimate) {
      setStorageEstimate('Not available on this browser')
      return
    }
    const { usage, quota } = await navigator.storage.estimate()
    const mb = (n: number | undefined) => ((n ?? 0) / (1024 * 1024)).toFixed(1)
    setStorageEstimate(`${mb(usage)} MB used of ${mb(quota)} MB available`)
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <h1 className="mb-6 text-lg font-semibold text-ink">Settings</h1>

      <section className="mb-7">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-xs font-medium transition ${
                theme === value ? 'border-accent bg-accent-muted text-accent' : 'border-border text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Data</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-left text-sm font-medium text-ink shadow-soft hover:bg-surface-sunken"
          >
            <Download size={18} className="text-ink-muted" />
            Export backup
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-left text-sm font-medium text-ink shadow-soft hover:bg-surface-sunken"
          >
            <Upload size={18} className="text-ink-muted" />
            Import backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChosen} />
          {importError && <p className="text-xs text-danger">{importError}</p>}

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-danger/20 bg-surface-raised px-4 py-3.5 text-left text-sm font-medium text-danger shadow-soft hover:bg-danger/5"
          >
            <Trash2 size={18} />
            Clear all data
          </button>
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Storage</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <p className="text-sm text-ink-muted">{storageEstimate ?? 'Tap to check local storage usage.'}</p>
          {!storageEstimate && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={loadStorageEstimate}>
              Check usage
            </Button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">About</h2>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <Info size={18} className="mt-0.5 shrink-0 text-ink-muted" />
          <div>
            <p className="text-sm font-medium text-ink">{APP_CONFIG.fullName}</p>
            <p className="text-xs text-ink-muted">Version {APP_CONFIG.version}</p>
            <p className="mt-1.5 text-xs text-ink-muted">
              All data stays on this device. Nothing is sent to a server. The custom week runs Saturday through
              Friday.
            </p>
            <p className="mt-1.5 text-xs text-ink-muted">Developed by Omar Issam.</p>
          </div>
        </div>
      </section>

      {import.meta.env.DEV && (
        <section className="mt-7">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Developer</h2>
          <button
            type="button"
            onClick={async () => {
              await seedDevData()
              showToast('Sample data loaded')
            }}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface-raised px-4 py-3.5 text-left text-sm font-medium text-ink shadow-soft hover:bg-surface-sunken"
          >
            <FlaskConical size={18} className="text-ink-muted" />
            Load sample data (dev only)
          </button>
        </section>
      )}

      <ConfirmDialog
        open={!!pendingImport}
        title="Replace all data?"
        description="Importing this backup will replace everything currently stored on this device. This cannot be undone."
        confirmLabel="Replace data"
        destructive
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear all data?"
        description="This permanently deletes every goal, habit, and analytics record on this device. This cannot be undone."
        confirmLabel="Clear everything"
        destructive
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  )
}
