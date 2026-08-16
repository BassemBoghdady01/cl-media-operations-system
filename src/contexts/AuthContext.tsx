/**
 * EZ Marketing Agency — Auth Context
 *
 * Authentication is handled exclusively by Supabase Auth
 * (`signInWithPassword` / `signUp`). There is no demo or seed credential path —
 * if Supabase is not configured, login and signup fail with a clear message
 * rather than falling back to hardcoded accounts.
 *
 * ── Contract ─────────────────────────────────────────────────────────────────
 * Every sign-in resolves to exactly one terminal `status`:
 *
 *   loading          — still resolving (isLoading true)
 *   unauthenticated  — no session; guards send the user to /login
 *   ready            — profile + agency + recognised role all present
 *   needs_profile    — auth user exists but no profiles row could be created
 *   needs_agency     — profile exists but has no usable agency
 *   unsupported_role — profile role is missing or not recognised
 *   error            — something threw; `error` holds the message
 *
 * `isLoading` ALWAYS becomes false — on success, on failure, on throw, and via a
 * hard timeout. No path leaves the app spinning or blank.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types'
import { supabase, isSupabaseReady } from '../lib/supabase'
import { APP_CONFIG } from '../config/app'
import {
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
  homeRouteForRole,
  ROLES,
  type Permission,
  type UserRole,
} from '../config/roles'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'ready'
  | 'needs_profile'
  | 'needs_agency'
  | 'unsupported_role'
  | 'error'

export interface ProfileRow {
  id: string
  agency_id: string | null
  full_name: string
  email: string
  role: string
  avatar_url?: string | null
  department?: string | null
  job_title?: string | null
  status?: string
  /** Set on portal users — links the login to its client record. */
  client_id?: string | null
  created_at: string
}

export interface AgencyRow {
  id: string
  name: string
  plan?: string | null
  created_at?: string
}

interface SignupParams {
  email: string
  password: string
  fullName?: string
  agencyName?: string
}

interface SignupResult {
  redirect: string
  /** True when Supabase created the user but withheld a session pending email confirmation */
  needsEmailConfirmation: boolean
}

interface AuthContextType {
  // ── Identity ──
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  agency: AgencyRow | null
  role: UserRole | null
  permissions: Permission[]

  // ── State ──
  status: AuthStatus
  isAuthenticated: boolean
  isLoading: boolean
  /** Alias of isLoading */
  loading: boolean
  error: string | null
  /** Alias of error (back-compat) */
  authError: string | null

  // ── Actions ──
  login: (identifier: string, password: string) => Promise<{ redirect: string }>
  signup: (params: SignupParams) => Promise<SignupResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasPermission: (permission: Permission) => boolean
}

// ─── Auth availability ────────────────────────────────────────────────────────
// Shown when Supabase credentials or VITE_ENABLE_REAL_AUTH are missing. There is
// deliberately no credential fallback — an unconfigured deployment must fail
// loudly rather than admit anyone.

const AUTH_UNAVAILABLE =
  'Authentication is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ' +
  'and VITE_ENABLE_REAL_AUTH=true, then reload.'

/** Hard ceiling on session resolution. Guarantees isLoading always clears. */
const RESOLVE_TIMEOUT_MS = 10_000

// ─── Debug logger (dev only) ─────────────────────────────────────────────────

function dbg(msg: string, data?: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`%c[Auth] ${msg}`, 'color:#60A5FA;font-weight:bold', data ?? '')
  }
}

/** Snapshot produced by resolveSession — mirrors what gets pushed into state. */
interface Resolved {
  status: AuthStatus
  user: User | null
  profile: ProfileRow | null
  agency: AgencyRow | null
  role: UserRole | null
  error: string | null
}

const EMPTY: Resolved = {
  status: 'unauthenticated',
  user: null,
  profile: null,
  agency: null,
  role: null,
  error: null,
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [agency, setAgency] = useState<AgencyRow | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Safety: prevent duplicate subscription in React StrictMode double-invoke
  const subscribedRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSessionRef = useRef<Session | null>(null)

  const applyResolved = useCallback((r: Resolved) => {
    setStatus(r.status)
    setUser(r.user)
    setProfile(r.profile)
    setAgency(r.agency)
    setRole(r.role)
    setError(r.error)
    setIsLoading(false)
  }, [])

  // ─── Map Supabase profile row → app User ────────────────────────────────────
  const mapProfile = (p: ProfileRow, resolvedRole: UserRole | null): User => ({
    id: p.id,
    name: p.full_name || p.email?.split('@')[0] || 'User',
    email: p.email,
    // Falls back to CLIENT (least privilege) purely to satisfy the type; callers
    // branch on `status`/`role`, never on user.role, when the role is unknown.
    role: resolvedRole ?? ROLES.CLIENT,
    agencyId: p.agency_id || '',
    avatar: p.avatar_url ?? undefined,
    createdAt: p.created_at,
  })

  // ─── Auto-create agency for first-time users ────────────────────────────────
  // Called when profile.agency_id is NULL — creates a default agency then links
  // the profile to it. Returns null when the repair could not be completed; the
  // caller surfaces `needs_agency` rather than blanking.
  const autoCreateAgency = async (
    userId: string,
    p: ProfileRow
  ): Promise<{ profile: ProfileRow | null; reason?: string }> => {
    if (!supabase) return { profile: null, reason: 'Supabase client unavailable.' }
    dbg('auto-creating agency', { userId })

    // Re-read first — a concurrent resolve may have just finished the repair.
    const { data: fresh } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (fresh && (fresh as ProfileRow).agency_id) {
      dbg('agency already created by concurrent call — using it')
      return { profile: fresh as ProfileRow }
    }

    const agencyName = p.full_name
      ? `${p.full_name}'s Agency`
      : `${(p.email || 'new').split('@')[0]}'s Agency`

    const { data: created, error: agencyErr } = await supabase
      .from('agencies')
      .insert({ name: agencyName, plan: 'starter' })
      .select()
      .single()

    if (agencyErr || !created) {
      dbg('agency insert failed', agencyErr)
      return { profile: null, reason: agencyErr?.message ?? 'Could not create an agency.' }
    }
    dbg('agency created', { id: created.id })

    // Link the profile and promote the workspace creator to agency admin.
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({ agency_id: created.id, role: ROLES.AGENCY_ADMIN })
      .eq('id', userId)
      .select()
      .single()

    if (updateErr || !updated) {
      dbg('profile update failed', updateErr)
      // The agency exists but the link failed — most commonly the profiles.role
      // CHECK constraint rejecting 'agency_admin' on an un-migrated database.
      // Retry linking the agency WITHOUT touching the role so the user still
      // gets a working workspace.
      const { data: linkOnly, error: linkErr } = await supabase
        .from('profiles')
        .update({ agency_id: created.id })
        .eq('id', userId)
        .select()
        .single()

      if (linkErr || !linkOnly) {
        return {
          profile: null,
          reason: updateErr?.message ?? 'Could not link your profile to an agency.',
        }
      }
      dbg('profile linked (role left unchanged)', linkOnly)
      return { profile: linkOnly as ProfileRow }
    }

    dbg('profile linked to agency', updated)
    return { profile: updated as ProfileRow }
  }

  // ─── Resolve a session into a terminal auth state ───────────────────────────
  const resolveSession = useCallback(async (s: Session | null): Promise<Resolved> => {
    if (!s?.user || !supabase) return { ...EMPTY }

    const userId = s.user.id
    const sessionEmail = s.user.email ?? undefined

    // ── 1. Load the profile ──────────────────────────────────────────────────
    const { data, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr) {
      dbg('profile query error', { code: profileErr.code, message: profileErr.message })
    }

    let p = (data as ProfileRow | null) ?? null

    // ── 2. Bootstrap a missing profile (trigger failure / manual auth user) ──
    if (!p && sessionEmail) {
      dbg('profile not found — bootstrapping')
      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: sessionEmail,
          full_name:
            (s.user.user_metadata?.full_name as string | undefined) ||
            sessionEmail.split('@')[0],
        })
        .select()
        .single()

      if (insertErr) {
        dbg('profile bootstrap failed', insertErr)
        return {
          status: 'needs_profile',
          user: null,
          profile: null,
          agency: null,
          role: null,
          error: insertErr.message,
        }
      }
      p = inserted as ProfileRow
    }

    if (!p) {
      return {
        status: 'needs_profile',
        user: null,
        profile: null,
        agency: null,
        role: null,
        error: 'No profile record exists for this account.',
      }
    }

    // ── 3. Resolve the role through the canonical mapping ────────────────────
    const resolvedRole = normalizeRole(p.role)

    // ── 4. Ensure an agency ──────────────────────────────────────────────────
    let agencyRepairError: string | undefined
    if (!p.agency_id) {
      dbg('profile.agency_id is NULL — running auto-recovery')
      const repair = await autoCreateAgency(userId, p)
      if (repair.profile) {
        p = repair.profile
      } else {
        agencyRepairError = repair.reason
      }
    }

    // Re-resolve: autoCreateAgency may have promoted the role.
    const finalRole = normalizeRole(p.role) ?? resolvedRole
    const appUser = mapProfile(p, finalRole)

    if (!p.agency_id) {
      return {
        status: 'needs_agency',
        user: appUser,
        profile: p,
        agency: null,
        role: finalRole,
        error: agencyRepairError ?? 'Your profile is not linked to a workspace.',
      }
    }

    // ── 5. Load the agency row (non-fatal if RLS hides it) ───────────────────
    let agencyRow: AgencyRow | null = null
    const { data: ag, error: agErr } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', p.agency_id)
      .maybeSingle()

    if (agErr) dbg('agency query error', { code: agErr.code, message: agErr.message })
    else agencyRow = (ag as AgencyRow | null) ?? null

    // ── 6. Unknown role → explicit state, never a guarded route ──────────────
    if (!finalRole) {
      return {
        status: 'unsupported_role',
        user: appUser,
        profile: p,
        agency: agencyRow,
        role: null,
        error: `Role "${p.role}" is not recognised.`,
      }
    }

    return {
      status: 'ready',
      user: appUser,
      profile: p,
      agency: agencyRow,
      role: finalRole,
      error: null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Resolve + push to state, converting any throw into a terminal error state. */
  const resolveAndApply = useCallback(
    async (s: Session | null) => {
      try {
        const resolved = await resolveSession(s)
        applyResolved(resolved)
        return resolved
      } catch (err) {
        dbg('resolveSession threw', err)
        const resolved: Resolved = {
          status: 'error',
          user: null,
          profile: null,
          agency: null,
          role: null,
          error:
            err instanceof Error ? err.message : 'Unexpected error while loading your workspace.',
        }
        applyResolved(resolved)
        return resolved
      }
    },
    [resolveSession, applyResolved]
  )

  // ─── Supabase Auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
      dbg('Supabase auth not configured')
      setStatus('error')
      setError(AUTH_UNAVAILABLE)
      setIsLoading(false)
      return
    }

    // Prevent double-subscription (React 18 StrictMode mounts effects twice in dev)
    if (subscribedRef.current) return
    subscribedRef.current = true

    dbg('starting auth listener')

    // Never hang forever — hard timeout resolves to an explicit error state.
    timeoutRef.current = setTimeout(() => {
      dbg('auth resolve timed out')
      setIsLoading((wasLoading) => {
        if (wasLoading) {
          setStatus('error')
          setError('Timed out while loading your workspace. Check your connection and retry.')
        }
        return false
      })
    }, RESOLVE_TIMEOUT_MS)

    // onAuthStateChange fires INITIAL_SESSION for existing sessions on page load,
    // which is what restores the session after a refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      dbg('onAuthStateChange', { event, userId: newSession?.user?.id })

      lastSessionRef.current = newSession
      setSession(newSession)

      // TOKEN_REFRESHED carries no profile change — don't re-query on every refresh.
      if (event === 'TOKEN_REFRESHED' && user) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        return
      }

      await resolveAndApply(newSession)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    })

    return () => {
      subscription.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      subscribedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (identifier: string, password: string): Promise<{ redirect: string }> => {
      const key = identifier.toLowerCase().trim()
      setError(null)

      if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
        throw new Error(AUTH_UNAVAILABLE)
      }

      // A full email address is always used verbatim. A bare username ("admin")
      // is expanded to the agency domain — and, for accounts created before the
      // EZ Marketing Agency rebrand, retried against the legacy domain.
      // See APP_CONFIG.auth.legacyEmailDomain for the migration path.
      const { emailDomain, legacyEmailDomain } = APP_CONFIG.auth
      const candidates = key.includes('@')
        ? [key]
        : [`${key}@${emailDomain}`, ...(legacyEmailDomain ? [`${key}@${legacyEmailDomain}`] : [])]

      let authedSession: Session | null = null
      let lastError: Error | null = null

      for (const email of candidates) {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (!signInErr && data.session) {
          authedSession = data.session
          lastError = null
          break
        }

        lastError = new Error(signInErr?.message ?? 'Login failed — no session returned.')

        // Only fall through to the legacy domain when the credentials were
        // rejected (400). Stop on rate limits, network faults, or unconfirmed
        // emails so those surface instead of burning a second auth attempt.
        if (signInErr && signInErr.status !== 400) break
      }

      if (!authedSession) throw lastError ?? new Error('Login failed — no session returned.')

      setSession(authedSession)
      const resolved = await resolveAndApply(authedSession)

      // Stamp profiles.last_login_at (fire-and-forget; must never block login).
      supabase.rpc('touch_last_login').then(
        ({ error: touchErr }) => { if (touchErr) dbg('touch_last_login failed', touchErr) },
        () => undefined
      )

      // Anything short of `ready` goes to the setup route, which is deliberately
      // outside the role guards. Never redirect into a guarded route the user
      // cannot enter — that is what produced the blank-screen redirect loop.
      return {
        redirect:
          resolved.status === 'ready'
            ? homeRouteForRole(resolved.role)
            : APP_CONFIG.routes.setup,
      }
    },
    [resolveAndApply]
  )

  // ─── Signup ─────────────────────────────────────────────────────────────────
  // Creates the account through Supabase Auth. The caller supplies the password;
  // there is no default. `full_name` / `agency_name` ride along in user_metadata
  // so the profiles trigger (or the bootstrap path) can pick them up.
  const signup = useCallback(
    async ({ email, password, fullName, agencyName }: SignupParams): Promise<SignupResult> => {
      setError(null)

      if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
        throw new Error(AUTH_UNAVAILABLE)
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || undefined,
            agency_name: agencyName?.trim() || undefined,
          },
        },
      })

      if (signUpErr) throw new Error(signUpErr.message)
      if (!data.user) throw new Error('Sign-up failed — no user returned.')

      // With "Confirm email" enabled, Supabase returns a user but no session.
      if (!data.session) {
        return { redirect: APP_CONFIG.routes.login, needsEmailConfirmation: true }
      }

      setSession(data.session)
      const resolved = await resolveAndApply(data.session)

      return {
        redirect:
          resolved.status === 'ready'
            ? homeRouteForRole(resolved.role)
            : APP_CONFIG.routes.setup,
        needsEmailConfirmation: false,
      }
    },
    [resolveAndApply]
  )

  // ─── Refresh ────────────────────────────────────────────────────────────────
  // Re-runs resolution against the current session. Used by the setup and error
  // screens' Retry buttons — e.g. after an admin fixes a role or runs the migration.
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
      setStatus('error')
      setError(AUTH_UNAVAILABLE)
      setIsLoading(false)
      return
    }

    try {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      await resolveAndApply(data.session)
    } catch (err) {
      applyResolved({
        status: 'error',
        user: null,
        profile: null,
        agency: null,
        role: null,
        error: err instanceof Error ? err.message : 'Could not refresh your session.',
      })
    }
  }, [resolveAndApply, applyResolved])

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (isSupabaseReady && supabase && APP_CONFIG.features.realAuth) {
      await supabase.auth.signOut()
    }
    setSession(null)
    applyResolved({ ...EMPTY })
  }, [applyResolved])

  const hasPermission = useCallback(
    (permission: Permission) => roleHasPermission(role, permission),
    [role]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        agency,
        role,
        permissions: permissionsForRole(role),

        status,
        isAuthenticated: status === 'ready',
        isLoading,
        loading: isLoading,
        error,
        authError: error,

        login,
        signup,
        logout,
        refresh,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
