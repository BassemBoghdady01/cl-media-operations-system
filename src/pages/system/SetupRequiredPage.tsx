/**
 * EZ Marketing Agency — Workspace Setup / Access states
 *
 * Terminal destination for every authenticated session that is NOT `ready`.
 * This route lives inside ProtectedRoute but OUTSIDE the role guards, so it can
 * never participate in a redirect loop.
 */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FullScreenMessage, FullScreenLoader } from '../../components/system/FullScreenState'
import { homeRouteForRole, ROLE_LABELS, ALL_ROLES } from '../../config/roles'

export default function SetupRequiredPage() {
  const { status, isLoading, session, profile, role, error, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  if (isLoading || status === 'loading') return <FullScreenLoader />

  // No session at all — the login route owns this case.
  if (!session) return <Navigate to="/login" replace />

  // Everything resolved while the user sat here: send them to their real home.
  if (status === 'ready' && role) return <Navigate to={homeRouteForRole(role)} replace />

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  const handleSignOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const isDev = import.meta.env.DEV

  const copy = {
    needs_profile: {
      icon: '👤',
      tone: 'warning' as const,
      title: 'Your account is not set up yet',
      description:
        'You signed in successfully, but no profile record exists for this account and one could not be created automatically. An administrator needs to finish provisioning your access.',
    },
    needs_agency: {
      icon: '🏢',
      tone: 'warning' as const,
      title: 'Workspace setup required',
      description:
        'Your profile exists but is not linked to a workspace, and one could not be created automatically. An administrator needs to assign you to an agency.',
    },
    unsupported_role: {
      icon: '🔐',
      tone: 'warning' as const,
      title: 'Your account access is not configured yet',
      description: (
        <>
          Your profile carries a role this application does not recognise, so we
          cannot decide what you should see. An administrator needs to set it to one
          of: {ALL_ROLES.map((r) => ROLE_LABELS[r]).join(', ')}.
        </>
      ),
    },
    error: {
      icon: '⚠️',
      tone: 'error' as const,
      title: 'We could not load your workspace',
      description:
        'Something went wrong while loading your account. This is usually temporary — retry, or sign out and back in.',
    },
    unauthenticated: {
      icon: '🔑',
      tone: 'info' as const,
      title: 'Please sign in',
      description: 'Your session has ended.',
    },
    ready: {
      icon: '✅',
      tone: 'info' as const,
      title: 'Workspace ready',
      description: 'Redirecting…',
    },
    loading: {
      icon: '⏳',
      tone: 'info' as const,
      title: 'Loading',
      description: 'One moment…',
    },
  }[status]

  // Diagnostics are safe to show: identifiers only, never keys or tokens.
  const details = [
    error && `Reason: ${error}`,
    isDev && session?.user?.id && `Auth user: ${session.user.id}`,
    isDev && session?.user?.email && `Email: ${session.user.email}`,
    isDev && `Profile row: ${profile ? 'found' : 'missing'}`,
    isDev && profile && `Stored role: ${profile.role ?? '(none)'}`,
    isDev && profile && `Agency id: ${profile.agency_id ?? '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <FullScreenMessage
      icon={copy.icon}
      tone={copy.tone}
      title={copy.title}
      description={copy.description}
      details={details || null}
    >
      <button
        className="btn-primary flex-1 justify-center py-3"
        onClick={handleRetry}
        disabled={retrying}
      >
        {retrying ? 'Checking…' : 'Retry'}
      </button>
      <button className="btn-secondary flex-1 justify-center py-3" onClick={handleSignOut}>
        Sign out
      </button>
    </FullScreenMessage>
  )
}
