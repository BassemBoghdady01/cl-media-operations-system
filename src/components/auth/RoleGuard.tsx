/**
 * RoleGuard — protects routes by canonical role.
 *
 * ── Blank-screen post-mortem ─────────────────────────────────────────────────
 * The previous version redirected any unrecognised role to APP_CONFIG.routes
 * .adminHome ('/app/dashboard') — a route this very guard protects. A profile
 * carrying a database-only role value (e.g. 'admin' or 'owner') therefore
 * bounced /app/dashboard → /app/dashboard forever, React hit "Maximum update
 * depth exceeded", the tree unmounted, and the user saw a blank dark screen.
 *
 * Two rules now prevent that class of bug:
 *   1. Unresolvable state redirects to SETUP_ROUTE, which sits OUTSIDE all guards.
 *   2. If a computed redirect target equals the current path, render an explicit
 *      denied state instead of navigating.
 *
 * No branch returns null.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FullScreenLoader, FullScreenMessage } from '../system/FullScreenState'
import {
  homeRouteForRole,
  SETUP_ROUTE,
  ROLE_LABELS,
  INTERNAL_ROLES,
  CLIENT_ROLES,
  ADMIN_ROLES,
  type UserRole,
} from '../../config/roles'
import { APP_CONFIG } from '../../config/app'

interface RoleGuardProps {
  allowedRoles: readonly UserRole[]
  /** Shown in the denied state, e.g. "the internal workspace" */
  areaLabel?: string
}

function AccessDenied({ role, areaLabel }: { role: UserRole | null; areaLabel: string }) {
  return (
    <FullScreenMessage
      tone="warning"
      icon="🔐"
      title="You don't have access to this area"
      description={
        <>
          Your role{role ? ` (${ROLE_LABELS[role]})` : ''} does not grant access to {areaLabel}.
          If you believe this is wrong, ask an administrator to review your access.
        </>
      }
    >
      <a className="btn-secondary flex-1 justify-center py-3" href={SETUP_ROUTE}>
        Account status
      </a>
      <a className="btn-secondary flex-1 justify-center py-3" href={APP_CONFIG.routes.login}>
        Sign in as someone else
      </a>
    </FullScreenMessage>
  )
}

export default function RoleGuard({
  allowedRoles,
  areaLabel = 'this area',
}: RoleGuardProps) {
  const { status, role, isLoading, session } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') return <FullScreenLoader />

  // No Supabase session — the login page owns this.
  if (!session) return <Navigate to={APP_CONFIG.routes.login} replace />

  // Authenticated but not usable yet (no profile / no agency / unknown role /
  // resolution error). SETUP_ROUTE is outside every guard, so this cannot loop.
  if (status !== 'ready' || !role) {
    return <Navigate to={SETUP_ROUTE} replace state={{ from: location.pathname }} />
  }

  if (!allowedRoles.includes(role)) {
    const home = homeRouteForRole(role)

    // Safety net: never navigate to the path we are already on.
    if (home === location.pathname) {
      return <AccessDenied role={role} areaLabel={areaLabel} />
    }
    return <Navigate to={home} replace />
  }

  return <Outlet />
}

/** Admin + management roles only. */
export function AdminRoute() {
  return <RoleGuard allowedRoles={ADMIN_ROLES} areaLabel="agency administration" />
}

/** All internal team roles (not clients). */
export function TeamRoute() {
  return <RoleGuard allowedRoles={INTERNAL_ROLES} areaLabel="the internal workspace" />
}

/** Client portal only. */
export function ClientRoute() {
  return <RoleGuard allowedRoles={CLIENT_ROLES} areaLabel="the client portal" />
}
