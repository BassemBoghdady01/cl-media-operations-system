/**
 * RoleGuard — protects routes by user role.
 *
 * IMPORTANT: Always checks isLoading before redirecting.
 * Without this check, the guard would redirect to /login while auth is still
 * being restored from the session — causing a false "not authorized" blank page.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { UserRole } from '../../types'
import { APP_CONFIG } from '../../config/app'

interface RoleGuardProps {
  /** Roles that are allowed to access this route */
  allowedRoles: UserRole[]
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { role, isLoading } = useAuth()

  // While auth is resolving, render nothing — ProtectedRoute already shows the spinner.
  // Never redirect during load; doing so causes a blank screen / redirect loop.
  if (isLoading) return null

  if (!role) return <Navigate to={APP_CONFIG.routes.login} replace />

  if (!allowedRoles.includes(role)) {
    // Redirect to role-appropriate home rather than a blank page
    if (role === 'client') return <Navigate to={APP_CONFIG.routes.clientHome} replace />
    if (role === 'accountant') return <Navigate to={APP_CONFIG.routes.accountantHome} replace />
    return <Navigate to={APP_CONFIG.routes.adminHome} replace />
  }

  return <Outlet />
}

/** Convenience: Admin + management roles only */
export function AdminRoute() {
  return <RoleGuard allowedRoles={['super_admin', 'agency_admin', 'project_manager']} />
}

/** Convenience: All internal team roles (not clients) */
export function TeamRoute() {
  return (
    <RoleGuard
      allowedRoles={[
        'super_admin',
        'agency_admin',
        'project_manager',
        'editor',
        'social_manager',
        'creator',
        'accountant',
      ]}
    />
  )
}

/** Convenience: Client portal only */
export function ClientRoute() {
  const { role, isLoading } = useAuth()

  // Wait for auth to resolve before making routing decisions
  if (isLoading) return null

  if (role && role !== 'client') {
    return <Navigate to={APP_CONFIG.routes.adminHome} replace />
  }
  return <Outlet />
}
