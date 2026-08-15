/**
 * EZ Marketing Agency — App Error Boundary
 *
 * Last line of defence around the authenticated shell. Without this, any throw
 * inside a page (or an infinite render loop in a route guard) unmounts the whole
 * React tree and leaves the user staring at a blank dark screen.
 *
 * Uses window.location for its actions rather than router hooks: a class
 * component cannot use hooks, and a hard navigation guarantees a clean remount
 * of a tree that has already failed.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase'
import { FullScreenMessage } from './FullScreenState'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null })
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] Uncaught error in authenticated shell:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null })
  }

  handleDashboard = () => {
    window.location.assign('/app/dashboard')
  }

  handleSignOut = async () => {
    try {
      if (isSupabaseReady && supabase) await supabase.auth.signOut()
    } catch {
      // Signing out is best-effort here — never block the escape hatch.
    }
    window.location.assign('/login')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isDev = import.meta.env.DEV
    const { error, componentStack } = this.state

    // In production the message stays generic — no stack traces, no internals.
    const details = isDev
      ? [error?.name && `${error.name}: ${error.message}`, error?.stack, componentStack]
          .filter(Boolean)
          .join('\n\n')
      : null

    return (
      <FullScreenMessage
        tone="error"
        icon="💥"
        title="Something went wrong while loading your workspace."
        description={
          isDev
            ? 'A component crashed. The details below are shown in development only.'
            : 'The page failed to load. You can retry, return to the dashboard, or sign out and back in. If this keeps happening, contact your administrator.'
        }
        details={details}
      >
        <button className="btn-primary flex-1 justify-center py-3" onClick={this.handleRetry}>
          Retry
        </button>
        <button className="btn-secondary flex-1 justify-center py-3" onClick={this.handleDashboard}>
          Go to dashboard
        </button>
        <button className="btn-secondary flex-1 justify-center py-3" onClick={this.handleSignOut}>
          Sign out
        </button>
      </FullScreenMessage>
    )
  }
}
