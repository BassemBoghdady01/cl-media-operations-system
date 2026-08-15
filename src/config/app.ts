/**
 * EZ Marketing Agency — Media Operations System
 * Global application configuration
 *
 * Change VITE_DEMO_MODE=false in your .env to switch to live Supabase data.
 */

export const APP_CONFIG = {
  /** Public brand name shown across the UI */
  name: 'EZ Marketing Agency',

  /** Compact wordmark for narrow lockups (sidebar, portal header) */
  shortName: 'EZ Marketing',

  /** Two-letter mark rendered inside the gradient logo tile */
  initials: 'EZ',

  /** Short tagline */
  tagline: 'Media Operations System',

  /** Full product description */
  description:
    'End-to-end media operations platform for content agencies — manage clients, videos, pipelines, AI generation, scheduling, and billing in one place.',

  /** Version */
  version: '1.0.0',

  /** Copyright holder */
  company: 'EZ Marketing Agency',

  /** Support email */
  supportEmail: 'support@ezmarketing.agency',

  /** Email-domain handling for the bare-username login shorthand */
  auth: {
    /** Bare usernames ("admin") are expanded to this domain */
    emailDomain: 'ezmarketing.agency',

    /**
     * DEPRECATED — pre-rebrand domain, kept only so accounts created before the
     * EZ Marketing Agency rename can still sign in with the bare-username
     * shorthand. Login tries `emailDomain` first and only falls back to this on
     * a rejected-credentials response.
     *
     * MIGRATION: once every Supabase Auth user has been moved to
     * `emailDomain`, set this to null and delete the fallback branch in
     * AuthContext `login()`. Users who type their full email address are
     * unaffected either way. See HANDOVER.md → "Email domain migration".
     */
    legacyEmailDomain: 'cl.agency' as string | null,
  },

  /**
   * Feature flags
   * Override individually in .env:
   *   VITE_ENABLE_AI=true
   *   VITE_ENABLE_REAL_AUTH=true
   *   VITE_DEMO_MODE=false
   */
  features: {
    /** When true, app uses seed data instead of Supabase */
    demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',

    /** When true, AI Studio calls the real /api/ai/generate endpoint */
    aiEnabled: import.meta.env.VITE_ENABLE_AI === 'true',

    /** When true, auth goes through Supabase Auth */
    realAuth: import.meta.env.VITE_ENABLE_REAL_AUTH === 'true',

    /** File upload through Supabase Storage */
    storageEnabled:
      !!import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_ENABLE_REAL_AUTH === 'true',
  },

  /** Supabase is considered configured when both env vars are present */
  get isSupabaseConfigured() {
    return (
      !!import.meta.env.VITE_SUPABASE_URL &&
      !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
      import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co'
    )
  },

  /** Routes */
  routes: {
    adminHome: '/app/dashboard',
    editorHome: '/app/pipeline',
    accountantHome: '/app/billing',
    clientHome: '/client',
    login: '/login',
    signup: '/signup',
    /** Shown when a workspace/role is not usable yet. Sits outside the role guards. */
    setup: '/app/setup',
  },

  /** Storage bucket names (must match supabase/storage.sql) */
  storage: {
    clientAssets: 'client-assets',
    rawFootage: 'raw-footage',
    videoVersions: 'video-versions',
    finalDeliveries: 'final-deliveries',
    thumbnails: 'thumbnails',
    invoices: 'invoices',
  },
} as const

export type AppConfig = typeof APP_CONFIG
