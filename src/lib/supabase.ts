/**
 * CL — Supabase Client
 *
 * This module exports a singleton Supabase client.
 * It is only active when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.
 *
 * If they are not set (seed/demo mode), services will fall back to local seed data.
 *
 * NOTE: We use an untyped client here (`createClient` without Database generic)
 * to avoid TypeScript errors from the stub database.types.ts.
 * Once you run `npx supabase gen types typescript --project-id YOUR_ID` and get
 * real types, you can re-add the Database generic.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co'

/**
 * The Supabase client instance.
 * Check `isSupabaseReady` before using in services.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * True when Supabase environment variables are properly configured.
 * Services check this to decide whether to use Supabase or seed data.
 */
export const isSupabaseReady = isConfigured

/**
 * Helper to assert Supabase is configured before a live query.
 */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    )
  }
  return supabase
}
