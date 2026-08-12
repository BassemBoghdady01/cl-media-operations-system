/**
 * /debug/auth — Auth Diagnostics Page
 *
 * Shows the full auth state, Supabase session, raw DB profile, and env vars.
 * Useful for diagnosing blank-screen / login loop issues in production.
 *
 * This page is PUBLIC (no auth guard). Remove or gate it before shipping to end users.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, LogOut, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isSupabaseReady } from '../../lib/supabase'
import { APP_CONFIG } from '../../config/app'

interface RawProfile {
  id: string
  agency_id: string | null
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
}

interface RawSession {
  user?: {
    id: string
    email?: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
    created_at?: string
  }
  expires_at?: number
  access_token?: string
}

type Status = 'ok' | 'warn' | 'error' | 'info'

function Row({
  label,
  value,
  status = 'info',
  mono = false,
}: {
  label: string
  value: string | React.ReactNode
  status?: Status
  mono?: boolean
}) {
  const icons: Record<Status, React.ReactNode> = {
    ok: <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />,
    warn: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
    info: <div className="w-3.5 h-3.5 rounded-full bg-slate-600 flex-shrink-0" />,
  }
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-400 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        {icons[status]}
        <span className={`text-sm text-right ${mono ? 'font-mono text-xs' : ''} text-white break-all`}>
          {value}
        </span>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{
        background: 'rgba(14,30,60,0.6)',
        border: '1px solid rgba(59,130,246,0.15)',
      }}
    >
      <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function DebugAuthPage() {
  const { user, isAuthenticated, isLoading, role, authError, logout } = useAuth()
  const [session, setSession] = useState<RawSession | null>(null)
  const [rawProfile, setRawProfile] = useState<RawProfile | null>(null)
  const [profileQueryError, setProfileQueryError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  const runChecks = async () => {
    setChecking(true)
    setProfileQueryError(null)
    setRawProfile(null)

    if (supabase) {
      const { data } = await supabase.auth.getSession()
      setSession(data.session as RawSession | null)

      if (data.session?.user) {
        const { data: p, error: pe } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single()

        if (pe) setProfileQueryError(pe.message)
        if (p) setRawProfile(p as RawProfile)
      }
    }

    setCheckedAt(new Date().toLocaleTimeString())
    setChecking(false)
  }

  useEffect(() => {
    runChecks()
  }, [])

  const env = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    realAuth: import.meta.env.VITE_ENABLE_REAL_AUTH,
    demoMode: import.meta.env.VITE_DEMO_MODE,
    aiEnabled: import.meta.env.VITE_ENABLE_AI,
    appUrl: import.meta.env.VITE_APP_URL,
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: '#04081A' }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
            >
              EZ
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Auth Diagnostics</h1>
              <p className="text-[11px] text-slate-500">
                /debug/auth · {checkedAt ? `checked ${checkedAt}` : 'loading…'}
              </p>
            </div>
          </div>
          <button
            onClick={runChecks}
            disabled={checking}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Auth error banner */}
        {authError && (
          <div
            className="rounded-xl p-4 mb-4 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{authError}</p>
          </div>
        )}

        {/* Context state */}
        <Card title="Auth Context (React State)">
          <Row
            label="isLoading"
            value={String(isLoading)}
            status={isLoading ? 'warn' : 'ok'}
          />
          <Row
            label="isAuthenticated"
            value={String(isAuthenticated)}
            status={isAuthenticated ? 'ok' : 'error'}
          />
          <Row
            label="role"
            value={role ?? 'null'}
            status={role ? 'ok' : 'error'}
          />
          <Row
            label="user.id"
            value={user?.id ?? 'null'}
            status={user ? 'ok' : 'error'}
            mono
          />
          <Row
            label="user.email"
            value={user?.email ?? 'null'}
            status={user ? 'ok' : 'warn'}
          />
          <Row
            label="user.agencyId"
            value={user?.agencyId || '⚠ empty — agency auto-create may be pending'}
            status={user?.agencyId ? 'ok' : 'error'}
            mono
          />
          <Row
            label="user.name"
            value={user?.name ?? 'null'}
            status={user?.name ? 'ok' : 'info'}
          />
        </Card>

        {/* Supabase session */}
        <Card title="Supabase Session (Live Query)">
          <Row
            label="isSupabaseReady"
            value={String(isSupabaseReady)}
            status={isSupabaseReady ? 'ok' : 'error'}
          />
          <Row
            label="session exists"
            value={session ? 'yes' : 'null'}
            status={session ? 'ok' : 'error'}
          />
          <Row
            label="session.user.id"
            value={session?.user?.id ?? 'null'}
            status={session?.user ? 'ok' : 'error'}
            mono
          />
          <Row
            label="session.user.email"
            value={session?.user?.email ?? 'null'}
            status={session?.user?.email ? 'ok' : 'warn'}
          />
          <Row
            label="token expires"
            value={
              session?.expires_at
                ? new Date(session.expires_at * 1000).toLocaleString()
                : 'null'
            }
            status={session?.expires_at ? 'ok' : 'info'}
          />
        </Card>

        {/* Raw DB profile */}
        <Card title="Profile Row (Direct DB Read)">
          {profileQueryError ? (
            <div
              className="rounded-lg p-3 mb-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-xs text-red-400 font-mono break-all">{profileQueryError}</p>
              {profileQueryError.includes('agency_id') || profileQueryError.includes('permission') ? (
                <p className="text-xs text-slate-400 mt-2">
                  ⚠ RLS is blocking the profile read. Apply the updated{' '}
                  <code className="text-blue-400">supabase/rls-policies.sql</code> in Supabase SQL Editor.
                </p>
              ) : null}
            </div>
          ) : null}
          <Row
            label="profile found"
            value={rawProfile ? 'yes ✓' : profileQueryError ? 'ERROR (see above)' : 'null'}
            status={rawProfile ? 'ok' : 'error'}
          />
          {rawProfile && (
            <>
              <Row label="profile.id" value={rawProfile.id} mono />
              <Row
                label="profile.agency_id"
                value={rawProfile.agency_id ?? '⚠ NULL — this is the blank-screen root cause!'}
                status={rawProfile.agency_id ? 'ok' : 'error'}
                mono
              />
              <Row
                label="profile.role"
                value={rawProfile.role ?? 'null'}
                status={rawProfile.role ? 'ok' : 'warn'}
              />
              <Row label="profile.full_name" value={rawProfile.full_name ?? 'null'} />
              <Row label="profile.email" value={rawProfile.email ?? 'null'} />
              <Row
                label="profile.status"
                value={rawProfile.status ?? 'null'}
                status={rawProfile.status === 'active' ? 'ok' : 'warn'}
              />
            </>
          )}
        </Card>

        {/* Environment */}
        <Card title="Environment Variables">
          <Row
            label="VITE_SUPABASE_URL"
            value={env.supabaseUrl ? 'set ✓' : '⚠ MISSING'}
            status={env.supabaseUrl && env.supabaseUrl !== 'https://your-project.supabase.co' ? 'ok' : 'error'}
          />
          <Row
            label="VITE_SUPABASE_ANON_KEY"
            value={env.supabaseKey ? 'set ✓' : '⚠ MISSING'}
            status={env.supabaseKey ? 'ok' : 'error'}
          />
          <Row
            label="VITE_ENABLE_REAL_AUTH"
            value={env.realAuth || 'not set'}
            status={env.realAuth === 'true' ? 'ok' : 'warn'}
          />
          <Row
            label="VITE_DEMO_MODE"
            value={env.demoMode || 'not set (defaults to true)'}
            status={env.demoMode === 'false' ? 'ok' : 'warn'}
          />
          <Row
            label="VITE_ENABLE_AI"
            value={env.aiEnabled || 'not set'}
            status={env.aiEnabled === 'true' ? 'ok' : 'info'}
          />
          <Row
            label="VITE_APP_URL"
            value={env.appUrl || 'not set'}
            status={env.appUrl ? 'ok' : 'warn'}
          />
        </Card>

        {/* Checklist */}
        <Card title="Blank Screen Diagnosis">
          <div className="space-y-2 text-sm">
            {[
              {
                ok: isSupabaseReady,
                text: 'Supabase env vars configured',
                fix: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel',
              },
              {
                ok: APP_CONFIG.features.realAuth,
                text: 'VITE_ENABLE_REAL_AUTH=true',
                fix: 'Set VITE_ENABLE_REAL_AUTH=true in Vercel environment variables',
              },
              {
                ok: !!session,
                text: 'Supabase session is active',
                fix: 'Session not found — try logging in again at /login',
              },
              {
                ok: !!rawProfile,
                text: 'Profile row readable in DB',
                fix: 'Apply the updated rls-policies.sql in Supabase SQL Editor (adds id = auth.uid() to profiles SELECT)',
              },
              {
                ok: !!(rawProfile?.agency_id),
                text: 'Profile has agency_id set',
                fix: 'agency_id is NULL — the app will auto-create one on next login, OR run the migration SQL below',
              },
              {
                ok: isAuthenticated,
                text: 'AuthContext has user loaded',
                fix: 'Auth context is not authenticated — check the errors above',
              },
            ].map(({ ok, text, fix }) => (
              <div key={text} className="flex items-start gap-2">
                {ok
                  ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className={ok ? 'text-slate-300' : 'text-white font-medium'}>{text}</p>
                  {!ok && <p className="text-xs text-slate-500 mt-0.5">Fix: {fix}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick fix SQL */}
        {rawProfile && !rawProfile.agency_id && (
          <Card title="Quick Fix — Run in Supabase SQL Editor">
            <p className="text-xs text-slate-400 mb-3">
              This SQL applies only to the specific user shown above and
              immediately fixes the blank screen for them:
            </p>
            <pre
              className="text-[11px] font-mono text-green-300 rounded-xl p-4 overflow-x-auto"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
            >{`-- Step 1: Create an agency
INSERT INTO agencies (name, plan)
VALUES ('My Agency', 'starter')
RETURNING id;

-- Step 2: Set the returned agency id below, then run:
UPDATE profiles
SET agency_id = '<paste-agency-id-from-step-1>',
    role = 'agency_admin'
WHERE id = '${rawProfile.id}';`}</pre>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-2">
          <Link
            to="/login"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-400 transition-all"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <ArrowRight className="w-4 h-4" /> Go to Login
          </Link>
          {isAuthenticated && (
            <Link
              to={APP_CONFIG.routes.adminHome}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-green-400 transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <ArrowRight className="w-4 h-4" /> Go to Dashboard
            </Link>
          )}
          <button
            onClick={async () => {
              localStorage.clear()
              sessionStorage.clear()
              if (supabase) await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <LogOut className="w-4 h-4" /> Clear Storage &amp; Sign Out
          </button>
          <button
            onClick={runChecks}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Re-run Checks
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-8">
          ⚠ Remove or restrict this page before going to production.
        </p>
      </div>
    </div>
  )
}
