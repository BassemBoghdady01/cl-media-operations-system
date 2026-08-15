/**
 * ProtectedRoute — requires a Supabase session.
 *
 * Deliberately gates on *session presence*, not on `status === 'ready'`. The
 * setup/onboarding route lives behind this guard and must stay reachable for
 * sessions whose profile, agency or role is not usable yet — otherwise those
 * users have nowhere to land.
 *
 * Role-level access is enforced one level deeper, in RoleGuard.
 * No branch returns null.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FullScreenLoader, FullScreenMessage } from '../system/FullScreenState'
import { APP_CONFIG } from '../../config/app'

export default function ProtectedRoute() {
  const { session, status, isLoading, error } = useAuth()
  const location = useLocation()

  if (isLoading || status === 'loading') return <FullScreenLoader />

  // Supabase itself is not configured — say so rather than bouncing to a login
  // form that cannot possibly work.
  if (!APP_CONFIG.isSupabaseConfigured || !APP_CONFIG.features.realAuth) {
    return (
      <FullScreenMessage
        tone="error"
        icon="🔌"
        title="Authentication is not configured"
        description="This deployment is missing its Supabase settings, so no one can sign in. Set the environment variables below in Vercel and redeploy."
        details={
          'VITE_SUPABASE_URL\nVITE_SUPABASE_ANON_KEY\nVITE_ENABLE_REAL_AUTH=true' +
          (error ? `\n\n${error}` : '')
        }
      >
        <a className="btn-secondary flex-1 justify-center py-3" href="/">
          Back to home
        </a>
      </FullScreenMessage>
    )
  }

  if (!session) {
    return <Navigate to={APP_CONFIG.routes.login} state={{ from: location }} replace />
  }

  return <Outlet />
}
