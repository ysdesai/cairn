import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Empty } from '../ui'

interface Props {
  /** What to show instead. Omit for the standard "hit a snag" panel; pass null to render nothing. */
  fallback?: ReactNode
  /** Changing this clears the error (pass the current route). */
  resetKey?: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Keeps one broken screen or overlay from taking the whole app down. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Cairn: a screen failed to render', error, info.componentStack)
  }

  componentDidUpdate(previous: Props): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div className="page">
        <Empty
          seed={7}
          title="This screen lost its footing"
          body="Something went wrong while drawing it. Your data is safe. Reloading usually sorts it out."
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        />
      </div>
    )
  }
}
