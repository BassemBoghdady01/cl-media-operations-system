/**
 * EZ Marketing Agency — Service core
 *
 * PRODUCTION CONTRACT for every data service:
 *   • Real Supabase data only. There is NO seed/demo fallback anywhere.
 *   • A failed query THROWS a ServiceError so pages can show an honest error
 *     state. Empty results return empty arrays — never fabricated rows.
 *   • Supabase returns snake_case rows; services map them to the camelCase
 *     app types in src/types. Pages never see raw rows.
 */

import { supabase, isSupabaseReady } from '../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export class ServiceError extends Error {
  constructor(operation: string, cause: unknown) {
    const detail =
      typeof cause === 'object' && cause && 'message' in cause
        ? String((cause as { message: unknown }).message)
        : String(cause)
    super(`${operation} failed: ${detail}`)
    this.name = 'ServiceError'
  }
}

/** Returns the Supabase client or throws — no silent degradation. */
export function db(): SupabaseClient {
  if (!isSupabaseReady || !supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ' +
        'and VITE_ENABLE_REAL_AUTH=true.'
    )
  }
  return supabase
}

/** Throws a ServiceError when a Supabase call reports an error. */
export function orThrow(operation: string, error: unknown): void {
  if (error) throw new ServiceError(operation, error)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>

/** date-only string (YYYY-MM-DD) or '' from a nullable value. */
export const dstr = (v: unknown): string => (v ? String(v).slice(0, 10) : '')
