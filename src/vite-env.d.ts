/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_ENABLE_REAL_AUTH: string
  readonly VITE_ENABLE_AI: string
  readonly VITE_DEMO_MODE: string
  readonly VITE_STORAGE_BUCKET: string
  readonly VITE_STORAGE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
