/**
 * EZ Marketing Agency — Roles & Permissions
 *
 * SINGLE SOURCE OF TRUTH for role values. Do not hardcode role strings anywhere
 * else in the app — import from here.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 * The database CHECK constraint and the frontend union type had drifted apart:
 *
 *   database:  owner | admin | project_manager | editor |
 *              social_media_manager | accountant | client | creator
 *   frontend:  super_admin | agency_admin | project_manager | editor |
 *              social_manager | accountant | client | creator
 *
 * Three values disagreed (owner/super_admin, admin/agency_admin,
 * social_media_manager/social_manager). A profile row carrying a database-only
 * value produced a role the route guards did not recognise, which sent the user
 * into an infinite redirect and blanked the app.
 *
 * `normalizeRole()` maps every known legacy spelling onto a canonical value, so
 * the app stays correct even against rows that have not been migrated yet.
 */

// ─── Canonical roles ──────────────────────────────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  AGENCY_ADMIN: 'agency_admin',
  PROJECT_MANAGER: 'project_manager',
  EDITOR: 'editor',
  SOCIAL_MANAGER: 'social_manager',
  CREATOR: 'creator',
  ACCOUNTANT: 'accountant',
  CLIENT: 'client',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export const ALL_ROLES: readonly UserRole[] = Object.values(ROLES)

/**
 * Legacy / alternate spellings → canonical role.
 * Keys MUST be lowercase; `normalizeRole` lowercases before lookup.
 *
 * Everything the database CHECK constraint has ever permitted is listed here,
 * so an un-migrated production row still resolves to a usable role.
 */
const ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  // Database vocabulary (supabase/schema.sql, pre-migration)
  owner: ROLES.SUPER_ADMIN,
  admin: ROLES.AGENCY_ADMIN,
  social_media_manager: ROLES.SOCIAL_MANAGER,

  // Other spellings seen in fixtures, invites and hand-edited rows
  superadmin: ROLES.SUPER_ADMIN,
  'super-admin': ROLES.SUPER_ADMIN,
  agency_owner: ROLES.SUPER_ADMIN,
  agencyadmin: ROLES.AGENCY_ADMIN,
  'agency-admin': ROLES.AGENCY_ADMIN,
  administrator: ROLES.AGENCY_ADMIN,
  manager: ROLES.PROJECT_MANAGER,
  projectmanager: ROLES.PROJECT_MANAGER,
  pm: ROLES.PROJECT_MANAGER,
  marketing_manager: ROLES.SOCIAL_MANAGER,
  socialmanager: ROLES.SOCIAL_MANAGER,
  social: ROLES.SOCIAL_MANAGER,
  video_editor: ROLES.EDITOR,
  finance: ROLES.ACCOUNTANT,
  finance_manager: ROLES.ACCOUNTANT,
  customer: ROLES.CLIENT,
}

/**
 * Maps any raw role string (from the database, a JWT claim, or user metadata)
 * onto a canonical role. Returns null when the value is unknown — callers must
 * treat null as "access not configured", never as a silent default.
 */
export function normalizeRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null
  const key = String(raw).trim().toLowerCase()
  if (!key) return null
  if ((ALL_ROLES as readonly string[]).includes(key)) return key as UserRole
  return ROLE_ALIASES[key] ?? null
}

/** The canonical value to persist for a given raw role, or null if unknown. */
export function toDatabaseRole(raw: string | null | undefined): UserRole | null {
  return normalizeRole(raw)
}

// ─── Role groups ──────────────────────────────────────────────────────────────

/** Roles with access to the internal `/app/*` workspace. */
export const INTERNAL_ROLES: readonly UserRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.AGENCY_ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.EDITOR,
  ROLES.SOCIAL_MANAGER,
  ROLES.CREATOR,
  ROLES.ACCOUNTANT,
]

/** Roles allowed to administer the agency. */
export const ADMIN_ROLES: readonly UserRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.AGENCY_ADMIN,
  ROLES.PROJECT_MANAGER,
]

/** Roles that belong in the client portal. */
export const CLIENT_ROLES: readonly UserRole[] = [ROLES.CLIENT]

export const isInternalRole = (r: UserRole | null): boolean =>
  !!r && INTERNAL_ROLES.includes(r)

export const isAdminRole = (r: UserRole | null): boolean => !!r && ADMIN_ROLES.includes(r)

export const isClientRole = (r: UserRole | null): boolean => !!r && CLIENT_ROLES.includes(r)

/** Human-readable labels for UI display. */
export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.AGENCY_ADMIN]: 'Agency Admin',
  [ROLES.PROJECT_MANAGER]: 'Project Manager',
  [ROLES.EDITOR]: 'Video Editor',
  [ROLES.SOCIAL_MANAGER]: 'Social Media Manager',
  [ROLES.CREATOR]: 'Creator',
  [ROLES.ACCOUNTANT]: 'Accountant',
  [ROLES.CLIENT]: 'Client',
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  | 'dashboard.view'
  | 'clients.view'
  | 'clients.manage'
  | 'videos.view'
  | 'videos.manage'
  | 'calendar.view'
  | 'calendar.manage'
  | 'assets.view'
  | 'assets.manage'
  | 'packages.view'
  | 'packages.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'team.view'
  | 'team.manage'
  | 'tasks.view'
  | 'tasks.manage'
  | 'analytics.view'
  | 'ai.use'
  | 'settings.manage'
  | 'portal.access'

const ALL_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'clients.view',
  'clients.manage',
  'videos.view',
  'videos.manage',
  'calendar.view',
  'calendar.manage',
  'assets.view',
  'assets.manage',
  'packages.view',
  'packages.manage',
  'billing.view',
  'billing.manage',
  'team.view',
  'team.manage',
  'tasks.view',
  'tasks.manage',
  'analytics.view',
  'ai.use',
  'settings.manage',
  'portal.access',
]

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.AGENCY_ADMIN]: ALL_PERMISSIONS,

  [ROLES.PROJECT_MANAGER]: [
    'dashboard.view',
    'clients.view',
    'clients.manage',
    'videos.view',
    'videos.manage',
    'calendar.view',
    'calendar.manage',
    'assets.view',
    'assets.manage',
    'packages.view',
    'billing.view',
    'team.view',
    'tasks.view',
    'tasks.manage',
    'analytics.view',
    'ai.use',
  ],

  [ROLES.EDITOR]: [
    'dashboard.view',
    'clients.view',
    'videos.view',
    'videos.manage',
    'calendar.view',
    'assets.view',
    'assets.manage',
    'tasks.view',
    'tasks.manage',
    'ai.use',
  ],

  [ROLES.SOCIAL_MANAGER]: [
    'dashboard.view',
    'clients.view',
    'videos.view',
    'videos.manage',
    'calendar.view',
    'calendar.manage',
    'assets.view',
    'tasks.view',
    'tasks.manage',
    'analytics.view',
    'ai.use',
  ],

  [ROLES.CREATOR]: [
    'dashboard.view',
    'videos.view',
    'calendar.view',
    'assets.view',
    'tasks.view',
    'ai.use',
  ],

  [ROLES.ACCOUNTANT]: [
    'dashboard.view',
    'clients.view',
    'packages.view',
    'packages.manage',
    'billing.view',
    'billing.manage',
    'analytics.view',
  ],

  [ROLES.CLIENT]: ['portal.access'],
}

export function permissionsForRole(role: UserRole | null): Permission[] {
  if (!role) return []
  return [...(ROLE_PERMISSIONS[role] ?? [])]
}

export function roleHasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/** Route shown when a role cannot be resolved or the workspace is incomplete. */
export const SETUP_ROUTE = '/app/setup'

/**
 * The landing route for a role.
 *
 * CRITICAL: every value returned here must be reachable by that role. Returning
 * a guarded route the role cannot enter is exactly what caused the redirect loop
 * that blanked the app — an unknown role now lands on SETUP_ROUTE, which sits
 * outside the role guards.
 */
export function homeRouteForRole(role: UserRole | null): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.AGENCY_ADMIN:
    case ROLES.PROJECT_MANAGER:
      return '/app/dashboard'
    case ROLES.EDITOR:
    case ROLES.SOCIAL_MANAGER:
    case ROLES.CREATOR:
      return '/app/pipeline'
    case ROLES.ACCOUNTANT:
      return '/app/billing'
    case ROLES.CLIENT:
      return '/client'
    default:
      return SETUP_ROUTE
  }
}
