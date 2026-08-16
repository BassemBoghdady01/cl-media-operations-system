/**
 * PermissionGuard — route-level permission check.
 *
 * This is UX, not security. A user who bypasses it still receives zero rows,
 * because every finance table's RLS policy calls has_permission() server-side
 * (see supabase/migrations/006_finance_rls.sql).
 *
 * No branch returns null.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FullScreenLoader, FullScreenMessage } from '../system/FullScreenState'
import { SETUP_ROUTE, type Permission } from '../../config/roles'
import { APP_CONFIG } from '../../config/app'

export default function PermissionGuard({
  permission,
  areaLabel = 'this area',
}: {
  permission: Permission
  areaLabel?: string
}) {
  const { status, isLoading, session, hasPermission, role } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') return <FullScreenLoader />
  if (!session) return <Navigate to={APP_CONFIG.routes.login} replace />
  if (status !== 'ready' || !role) {
    return <Navigate to={SETUP_ROUTE} replace state={{ from: location.pathname }} />
  }

  if (!hasPermission(permission)) {
    return (
      <FullScreenMessage
        tone="warning"
        icon="🔐"
        title="You don't have access to this area"
        description={`Your role does not include permission to view ${areaLabel}. If you need access, ask a Super Admin or your Finance Manager to grant it.`}
        details={import.meta.env.DEV ? `Required permission: ${permission}` : null}
      >
        <a className="btn-secondary flex-1 justify-center py-3" href="/app/dashboard">
          Back to dashboard
        </a>
      </FullScreenMessage>
    )
  }

  return <Outlet />
}
