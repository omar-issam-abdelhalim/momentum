import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle className="text-danger" size={28} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
            <p className="max-w-xs text-sm text-ink-muted">
              An unexpected error occurred. Your data is saved locally and hasn't been lost.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white active:scale-[0.98]"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
