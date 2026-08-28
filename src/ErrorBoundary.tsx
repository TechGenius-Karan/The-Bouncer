import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from './reportError'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const combined = new Error(error.message)
    combined.stack = `${error.stack}\n${info.componentStack}`
    reportError('react-render', combined)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
          <div className="font-sans text-ink-soft">Something went wrong.</div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-bin bg-ink px-5 py-2.5 font-display text-sm font-bold text-screen"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
