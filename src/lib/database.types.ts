/**
 * CL — Database Type Stubs
 *
 * For full type safety, generate this file from Supabase CLI:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
 *
 * Until then, this stub keeps TypeScript happy.
 */

export type Database = {
  public: {
    Tables: {
      agencies: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      profiles: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      clients: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      projects: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      videos: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      video_versions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      review_comments: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      assets: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      content_calendar: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      packages: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      invoices: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      bookings: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      tasks: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      notifications: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      activity_logs: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      ai_generations: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      brand_voice_profiles: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
