/**
 * EZ Marketing Agency — Auth Context
 *
 * Authentication is handled exclusively by Supabase Auth
 * (`signInWithPassword` / `signUp`). There is no demo or seed credential path —
 * if Supabase is not configured, login and signup fail with a clear message
 * rather than falling back to hardcoded accounts.
 *
 * Self-healing features:
 *   - If profile.agency_id is NULL (common on first login), auto-creates an agency
 *   - If profile row is missing entirely (trigger failure), auto-creates profile + agency
 *   - 8-second loading timeout prevents infinite blank spinner
 *   - Uses ONLY onAuthStateChange (not getSession+onAuthStateChange) to prevent double-fire
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
import type { User, UserRole } from '../types'
import { supabase, isSupabaseReady } from '../lib/supabase'
import { APP_CONFIG } from '../config/app'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Non-null when auth encountered a recoverable or display error */
  authError: string | null
  login: (identifier: string, password: string) => Promise<{ redirect: string }>
  signup: (params: SignupParams) => Promise<SignupResult>
  logout: () => Promise<void>
  role: UserRole | null
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

// ─── Supabase profile row shape ───────────────────────────────────────────────

interface ProfileRow {
  id: string
  agency_id: string | null
  full_name: string
  email: string
  role: string
  avatar_url?: string | null
  created_at: string
}

// ─── Auth availability ────────────────────────────────────────────────────────
// Shown when Supabase credentials or VITE_ENABLE_REAL_AUTH are missing. There is
// deliberately no credential fallback — an unconfigured deployment must fail
// loudly rather than admit anyone.

const AUTH_UNAVAILABLE =
  'Authentication is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ' +
  'and VITE_ENABLE_REAL_AUTH=true, then reload.'

// ─── Role → redirect map ──────────────────────────────────────────────────────

function getRedirectForRole(role: UserRole): string {
  switch (role) {
    case 'agency_admin':
    case 'super_admin':
    case 'project_manager':
      return APP_CONFIG.routes.adminHome
    case 'editor':
    case 'social_manager':
    case 'creator':
      return APP_CONFIG.routes.editorHome
    case 'accountant':
      return APP_CONFIG.routes.accountantHome
    case 'client':
      return APP_CONFIG.routes.clientHome
    default:
      return APP_CONFIG.routes.adminHome
  }
}

// ─── Debug logger (dev only) ─────────────────────────────────────────────────

function dbg(msg: string, data?: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`%c[Auth] ${msg}`, 'color:#60A5FA;font-weight:bold', data ?? '')
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  // Safety: prevent duplicate subscription in React StrictMode double-invoke
  const subscribedRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Map Supabase profile row → app User ────────────────────────────────────
  const mapProfile = (p: ProfileRow): User => ({
    id: p.id,
    name: p.full_name || p.email.split('@')[0],
    email: p.email,
    role: (p.role as UserRole) || 'agency_admin',
    agencyId: p.agency_id || '',
    avatar: p.avatar_url ?? undefined,
    createdAt: p.created_at,
  })

  // ─── Auto-create agency for first-time users ────────────────────────────────
  // Called when profile.agency_id is NULL — creates a default agency
  // then updates the profile row to link to it.
  const autoCreateAgency = async (userId: string, profile: ProfileRow): Promise<ProfileRow | null> => {
    if (!supabase) return null
    dbg('auto-creating agency', { userId })

    // Re-read the profile first — another concurrent call may have just finished
    const { data: fresh } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fresh && (fresh as ProfileRow).agency_id) {
      dbg('agency already created by concurrent call — using it')
      return fresh as ProfileRow
    }

    // Insert a new agency
    const agencyName = profile.full_name
      ? `${profile.full_name}'s Agency`
      : profile.email.split('@')[0] + "'s Agency"

    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .insert({ name: agencyName, plan: 'starter' })
      .select()
      .single()

    if (agencyErr || !agency) {
      dbg('agency insert failed', agencyErr)
      return null
    }
    dbg('agency created', { id: agency.id })

    // Update profile to link agency and promote to admin
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({ agency_id: agency.id, role: 'agency_admin' })
      .eq('id', userId)
      .select()
      .single()

    if (updateErr || !updated) {
      dbg('profile update failed', updateErr)
      return null
    }
    dbg('profile linked to agency', updated)
    return updated as ProfileRow
  }

  // ─── Fetch (and optionally auto-heal) the user's profile ────────────────────
  const fetchProfile = async (userId: string, sessionEmail?: string): Promise<User | null> => {
    if (!supabase) return null
    dbg('fetchProfile', { userId })

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "no rows" — expected when profile doesn't exist yet
      dbg('fetchProfile query error', { code: error.code, message: error.message })
    }

    let profile = data as ProfileRow | null

    // ── Recovery A: profile exists but has no agency ─────────────────────────
    if (profile && !profile.agency_id) {
      dbg('profile.agency_id is NULL — running auto-recovery')
      profile = await autoCreateAgency(userId, profile)
    }

    // ── Recovery B: profile row missing entirely (trigger may have failed) ────
    if (!profile && sessionEmail) {
      dbg('profile not found — inserting default')
      const name = sessionEmail.split('@')[0]
      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: userId, email: sessionEmail, full_name: name, role: 'agency_admin' })
        .select()
        .single()

      if (insertErr) {
        dbg('profile insert failed', insertErr)
        setAuthError('Could not create your profile. Please contact your administrator.')
        return null
      }

      profile = inserted as ProfileRow

      // Also create agency for the newly inserted profile
      if (profile && !profile.agency_id) {
        profile = await autoCreateAgency(userId, profile)
      }
    }

    if (!profile) {
      dbg('fetchProfile: no profile after recovery')
      return null
    }

    return mapProfile(profile)
  }

  // ─── Supabase Auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
      dbg('Supabase auth not configured — no session listener')
      setIsLoading(false)
      return
    }

    // Prevent double-subscription (React 18 StrictMode mounts effects twice in dev)
    if (subscribedRef.current) return
    subscribedRef.current = true

    dbg('starting auth listener')

    // Never hang on isLoading forever — 8-second hard timeout
    timeoutRef.current = setTimeout(() => {
      dbg('auth timeout — forcing isLoading=false')
      setIsLoading(false)
    }, 8000)

    // onAuthStateChange fires INITIAL_SESSION for existing sessions on page load.
    // This replaces the old pattern of calling getSession() + onAuthStateChange separately,
    // which caused fetchProfile to run twice on every page load.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      dbg('onAuthStateChange', { event, userId: session?.user?.id })

      if (session?.user) {
        const appUser = await fetchProfile(session.user.id, session.user.email)
        if (appUser) {
          setUser(appUser)
          setAuthError(null)
          dbg('user set', { id: appUser.id, role: appUser.role, agencyId: appUser.agencyId })
        } else {
          dbg('fetchProfile returned null — cannot authenticate user')
          setUser(null)
          if (!authError) {
            setAuthError(
              'Could not load your profile. Visit /debug/auth for diagnostics, or contact support.'
            )
          }
        }
      } else {
        setUser(null)
        setAuthError(null)
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setIsLoading(false)
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
      setAuthError(null)

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

      let authedUser: { id: string; email?: string } | null = null
      let lastError: Error | null = null

      for (const email of candidates) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (!error && data.user) {
          authedUser = data.user
          lastError = null
          break
        }

        lastError = new Error(error?.message ?? 'Login failed — no user returned.')

        // Only fall through to the legacy domain when the credentials were
        // rejected (400). Stop on rate limits, network faults, or unconfirmed
        // emails so those surface instead of burning a second auth attempt.
        if (error && error.status !== 400) break
      }

      if (!authedUser) throw lastError ?? new Error('Login failed — no user returned.')

      // Fetch profile directly (onAuthStateChange will also fire, but this gives us
      // the redirect URL immediately and triggers auto-recovery if needed)
      const appUser = await fetchProfile(authedUser.id, authedUser.email)
      if (!appUser) {
        await supabase.auth.signOut()
        throw new Error(
          'Your profile could not be loaded. ' +
            'Visit /debug/auth to diagnose, or contact your administrator.'
        )
      }

      setUser(appUser)
      return { redirect: getRedirectForRole(appUser.role) }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ─── Signup ─────────────────────────────────────────────────────────────────
  // Creates the account through Supabase Auth. The caller supplies the password;
  // there is no default. `full_name` / `agency_name` ride along in user_metadata
  // so the profiles trigger (or the fetchProfile recovery path) can pick them up.
  const signup = useCallback(
    async ({ email, password, fullName, agencyName }: SignupParams): Promise<SignupResult> => {
      setAuthError(null)

      if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
        throw new Error(AUTH_UNAVAILABLE)
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || undefined,
            agency_name: agencyName?.trim() || undefined,
          },
        },
      })

      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('Sign-up failed — no user returned.')

      // With "Confirm email" enabled, Supabase returns a user but no session.
      // The account exists; the user must confirm before they can sign in.
      if (!data.session) {
        return { redirect: APP_CONFIG.routes.login, needsEmailConfirmation: true }
      }

      const appUser = await fetchProfile(data.user.id, data.user.email)
      if (!appUser) {
        await supabase.auth.signOut()
        throw new Error(
          'Your account was created, but the profile could not be loaded. ' +
            'Sign in again, or visit /debug/auth to diagnose.'
        )
      }

      setUser(appUser)
      return { redirect: getRedirectForRole(appUser.role), needsEmailConfirmation: false }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (isSupabaseReady && supabase && APP_CONFIG.features.realAuth) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setAuthError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        login,
        signup,
        logout,
        role: user?.role ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
