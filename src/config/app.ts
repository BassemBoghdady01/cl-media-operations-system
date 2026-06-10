/**
 * CL — Media Operations System
 * Global application configuration
 *
 * Change VITE_DEMO_MODE=false in your .env to switch to live Supabase data.
 */

export const APP_CONFIG = {
  /** Public brand name shown across the UI */
  name: 'CL',

  /** Short tagline */
  tagline: 'Media Operations System',

  /** Full product description */
  description:
    'End-to-end media operations platform for content agencies — manage clients, videos, pipelines, AI generation, scheduling, and billing in one place.',

  /** Version */
  version: '1.0.0',

  /** Copyright holder */
  company: 'CL Agency',

  /** Support email */
  supportEmail: 'support@cl.agency',

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
