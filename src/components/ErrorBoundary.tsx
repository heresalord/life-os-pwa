import React from 'react'

interface State { hasError: boolean; error: Error | null }

interface Props {
  children: React.ReactNode
  /** Optional custom fallback. Defaults to a full-screen error card. */
  fallback?: React.ReactNode
  /** If true, shows a minimal inline error instead of full-screen. */
  inline?: boolean
}

/**
 * Catches any render/lifecycle error below this boundary and shows a
 * recoverable fallback instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>…</ErrorBoundary>
 *   <ErrorBoundary inline fallback={<span>Widget unavailable</span>}>…</ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LifeOS] Uncaught render error:', error.message, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    if (this.props.inline) {
      return (
        <div className="flex items-center justify-center p-4 text-xs text-text-muted">
          Component unavailable
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-3xl font-display text-accent">Life OS</div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-text">Something went wrong</p>
          <p className="text-xs text-text-muted max-w-xs leading-relaxed font-mono bg-surface-2 px-3 py-2 rounded-lg border border-border">
            {this.state.error?.message ?? 'Unknown error'}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-accent text-bg text-sm font-semibold rounded-xl hover:bg-accent/90 transition-colors"
        >
          Reload App
        </button>
      </div>
    )
  }
}
