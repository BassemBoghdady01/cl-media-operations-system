/**
 * RoleGuard — protects routes by user role.
 * Redirects unauthorized users to their home route.
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
  const { role, user } = useAuth()

  if (!role) return <Navigate to={APP_CONFIG.routes.login} replace />

  if (!allowedRoles.includes(role)) {
    // Redirect to role-appropriate home
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
      allowedRoles={['super_admin', 'agency_admin', 'project_manager', 'editor', 'social_manager', 'creator', 'accountant']}
    />
  )
}

/** Convenience: Client portal only */
export function ClientRoute() {
  const { role } = useAuth()
  if (role && role !== 'client') {
    return <Navigate to={APP_CONFIG.routes.adminHome} replace />
  }
  return <Outlet />
}
