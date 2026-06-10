/**
 * CL — Auth Context
 *
 * Supports two modes:
 *   1. Supabase Auth (production) — when VITE_ENABLE_REAL_AUTH=true and Supabase is configured
 *   2. Seed fallback (demo/presentation) — when Supabase is not configured
 *
 * The seed mode credentials are intentionally NOT shown on the login page.
 * See DEMO_REMOVAL_GUIDE.md for how to disable seed mode.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  login: (identifier: string, password: string) => Promise<{ redirect: string }>
  logout: () => Promise<void>
  role: UserRole | null
}

// ─── Seed Users (demo/presentation mode only) ─────────────────────────────────
// These are NOT shown on the login page. See DEMO_REMOVAL_GUIDE.md.

const SEED_USERS: Record<string, { user: User; redirect: string; password: string }> = {
  dactrah_admin: {
    user: { id: 'tm1', name: 'Agency Admin', email: 'admin@cl.agency', role: 'agency_admin', agencyId: 'a1', createdAt: '2023-01-01' },
    redirect: APP_CONFIG.routes.adminHome,
    password: 'dactrah123',
  },
  'admin@cl.agency': {
    user: { id: 'tm1', name: 'Agency Admin', email: 'admin@cl.agency', role: 'agency_admin', agencyId: 'a1', createdAt: '2023-01-01' },
    redirect: APP_CONFIG.routes.adminHome,
    password: 'dactrah123',
  },
  dactrah_team: {
    user: { id: 'tm3', name: 'Omar Tarek', email: 'team@cl.agency', role: 'editor', agencyId: 'a1', createdAt: '2023-02-10' },
    redirect: APP_CONFIG.routes.editorHome,
    password: 'dactrah123',
  },
  'team@cl.agency': {
    user: { id: 'tm3', name: 'Omar Tarek', email: 'team@cl.agency', role: 'editor', agencyId: 'a1', createdAt: '2023-02-10' },
    redirect: APP_CONFIG.routes.editorHome,
    password: 'dactrah123',
  },
  dactrah_client: {
    user: { id: 'client1', name: 'Client Portal', email: 'client@cl.agency', role: 'client', agencyId: 'a1', createdAt: '2024-01-15' },
    redirect: APP_CONFIG.routes.clientHome,
    password: 'dactrah123',
  },
  'client@cl.agency': {
    user: { id: 'client1', name: 'Client Portal', email: 'client@cl.agency', role: 'client', agencyId: 'a1', createdAt: '2024-01-15' },
    redirect: APP_CONFIG.routes.clientHome,
    password: 'dactrah123',
  },
  dactrah_accountant: {
    user: { id: 'tm6', name: 'Finance Manager', email: 'finance@cl.agency', role: 'accountant', agencyId: 'a1', createdAt: '2023-05-01' },
    redirect: APP_CONFIG.routes.accountantHome,
    password: 'dactrah123',
  },
  'finance@cl.agency': {
    user: { id: 'tm6', name: 'Finance Manager', email: 'finance@cl.agency', role: 'accountant', agencyId: 'a1', createdAt: '2023-05-01' },
    redirect: APP_CONFIG.routes.accountantHome,
    password: 'dactrah123',
  },
}

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

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Supabase Auth session listener ────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady || !supabase || !APP_CONFIG.features.realAuth) {
      // Seed mode: start unauthenticated (user must log in)
      setIsLoading(false)
      return
    }

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const appUser = await fetchProfile(session.user.id)
        setUser(appUser)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const appUser = await fetchProfile(session.user.id)
          setUser(appUser)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ─── Fetch profile from Supabase ───────────────────────────────────────────
  const fetchProfile = async (userId: string): Promise<User | null> => {
    if (!supabase) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return null

    const profile = data as {
      id: string
      full_name: string
      email: string
      role: UserRole
      agency_id: string
      avatar_url?: string
      created_at: string
    }

    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      role: profile.role,
      agencyId: profile.agency_id,
      avatar: profile.avatar_url,
      createdAt: profile.created_at,
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (identifier: string, password: string): Promise<{ redirect: string }> => {
      const key = identifier.toLowerCase().trim()

      // Mode 1: Real Supabase auth
      if (isSupabaseReady && supabase && APP_CONFIG.features.realAuth) {
        const email = key.includes('@') ? key : `${key}@cl.agency`

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw new Error(error.message)
        if (!data.user) throw new Error('Login failed')

        const appUser = await fetchProfile(data.user.id)
        if (!appUser) throw new Error('Profile not found — contact your administrator.')

        setUser(appUser)
        return { redirect: getRedirectForRole(appUser.role) }
      }

      // Mode 2: Seed/demo fallback (no Supabase configured)
      await new Promise((r) => setTimeout(r, 600))

      const match = SEED_USERS[key]
      if (!match) throw new Error('User not found')
      if (match.password !== password) throw new Error('Invalid credentials')

      setUser(match.user)
      return { redirect: match.redirect }
    },
    []
  )

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (isSupabaseReady && supabase && APP_CONFIG.features.realAuth) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
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
