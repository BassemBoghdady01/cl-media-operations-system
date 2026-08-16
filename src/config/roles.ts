/**
 * EZ Marketing Agency — Roles & Permissions
 *
 * SINGLE SOURCE OF TRUTH for role and permission values in the frontend.
 * Do not hardcode role or permission strings anywhere else — import from here.
 *
 * ── Relationship to the database ─────────────────────────────────────────────
 * This file MIRRORS supabase/migrations/002_roles_permissions.sql. The database
 * is authoritative: RLS policies call has_permission() server-side, so a user
 * who tampers with the frontend still receives zero rows.
 *
 * What lives here is the UI's copy — used to decide which menu items and
 * buttons to render. If you add a permission, add it in BOTH places.
 *
 * ── History ─────────────────────────────────────────────────────────────────
 * The database CHECK and this union once disagreed (owner/super_admin,
 * admin/agency_admin, social_media_manager/social_manager), which produced an
 * unrecognised role, an infinite guard redirect, and a blank screen.
 * `normalizeRole()` now maps every known spelling onto a canonical value.
 */

// ─── Canonical roles ──────────────────────────────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  AGENCY_ADMIN: 'agency_admin',
  FINANCE_MANAGER: 'finance_manager',
  HR_MANAGER: 'hr_manager',
  OPERATIONS: 'operations',
  ACCOUNTANT: 'accountant',
  MARKETING_MANAGER: 'marketing_manager',
  SALES_MANAGER: 'sales_manager',
  PROJECT_MANAGER: 'project_manager',
  ACCOUNT_MANAGER: 'account_manager',
  CLIENT_SUCCESS: 'client_success',
  CONTENT_STRATEGIST: 'content_strategist',
  SOCIAL_MEDIA_MANAGER: 'social_media_manager',
  MEDIA_BUYER: 'media_buyer',
  SALES: 'sales',
  VIDEOGRAPHER: 'videographer',
  VIDEO_EDITOR: 'video_editor',
  GRAPHIC_DESIGNER: 'graphic_designer',
  CONTENT_CREATOR: 'content_creator',
  VIEWER: 'viewer',
  CLIENT: 'client',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export const ALL_ROLES: readonly UserRole[] = Object.values(ROLES)

/** Lower = higher authority. Used for "who may modify whom". */
export const ROLE_LEVEL: Readonly<Record<UserRole, number>> = {
  super_admin: 0,
  agency_admin: 10,
  finance_manager: 20,
  hr_manager: 20,
  operations: 25,
  accountant: 30,
  marketing_manager: 30,
  sales_manager: 30,
  project_manager: 35,
  account_manager: 35,
  client_success: 40,
  content_strategist: 40,
  social_media_manager: 45,
  media_buyer: 45,
  sales: 50,
  videographer: 55,
  video_editor: 55,
  graphic_designer: 55,
  content_creator: 60,
  viewer: 90,
  client: 100,
}

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  super_admin: 'Super Admin',
  agency_admin: 'Agency Admin',
  finance_manager: 'Finance Manager',
  hr_manager: 'HR Manager',
  operations: 'Operations Manager',
  accountant: 'Accountant',
  marketing_manager: 'Marketing Manager',
  sales_manager: 'Sales Manager',
  project_manager: 'Project Manager',
  account_manager: 'Account Manager',
  client_success: 'Client Success',
  content_strategist: 'Content Strategist',
  social_media_manager: 'Social Media Manager',
  media_buyer: 'Media Buyer',
  sales: 'Sales Representative',
  videographer: 'Videographer',
  video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  content_creator: 'Content Creator',
  viewer: 'Viewer (Read Only)',
  client: 'Client',
}

/**
 * Legacy / alternate spellings → canonical. Keys MUST be lowercase.
 * Everything the database CHECK has ever allowed is listed, so an un-migrated
 * production row still resolves to a usable role.
 */
const ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  // Original schema vocabulary
  owner: ROLES.SUPER_ADMIN,
  admin: ROLES.AGENCY_ADMIN,
  // Vocabulary from the first rebrand pass
  social_manager: ROLES.SOCIAL_MEDIA_MANAGER,
  editor: ROLES.VIDEO_EDITOR,
  creator: ROLES.CONTENT_CREATOR,
  // Defensive spellings
  superadmin: ROLES.SUPER_ADMIN,
  'super-admin': ROLES.SUPER_ADMIN,
  agency_owner: ROLES.SUPER_ADMIN,
  administrator: ROLES.AGENCY_ADMIN,
  finance: ROLES.FINANCE_MANAGER,
  hr: ROLES.HR_MANAGER,
  pm: ROLES.PROJECT_MANAGER,
  manager: ROLES.PROJECT_MANAGER,
  designer: ROLES.GRAPHIC_DESIGNER,
  talent: ROLES.CONTENT_CREATOR,
  read_only: ROLES.VIEWER,
  customer: ROLES.CLIENT,
}

/**
 * Maps a raw role string onto a canonical role. Returns null when unknown —
 * callers must treat null as "access not configured", never as a default.
 */
export function normalizeRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null
  const key = String(raw).trim().toLowerCase()
  if (!key) return null
  if ((ALL_ROLES as readonly string[]).includes(key)) return key as UserRole
  return ROLE_ALIASES[key] ?? null
}

// ─── Role groups ──────────────────────────────────────────────────────────────

export const CLIENT_ROLES: readonly UserRole[] = [ROLES.CLIENT]

/** Everyone who belongs in /app/* (i.e. not a portal client). */
export const INTERNAL_ROLES: readonly UserRole[] = ALL_ROLES.filter(
  (r) => !CLIENT_ROLES.includes(r)
)

export const ADMIN_ROLES: readonly UserRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.AGENCY_ADMIN,
  ROLES.OPERATIONS,
  ROLES.PROJECT_MANAGER,
]

export const FINANCE_ROLES: readonly UserRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.FINANCE_MANAGER,
  ROLES.ACCOUNTANT,
]

export const isInternalRole = (r: UserRole | null): boolean => !!r && INTERNAL_ROLES.includes(r)
export const isAdminRole = (r: UserRole | null): boolean => !!r && ADMIN_ROLES.includes(r)
export const isClientRole = (r: UserRole | null): boolean => !!r && CLIENT_ROLES.includes(r)
export const isSuperAdmin = (r: UserRole | null): boolean => r === ROLES.SUPER_ADMIN

// ─── Permissions ──────────────────────────────────────────────────────────────

export const PERMISSIONS = [
  'dashboard.view',
  'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
  'projects.view', 'projects.create', 'projects.edit',
  'videos.view', 'videos.manage', 'videos.review',
  'calendar.view', 'calendar.manage',
  'assets.view', 'assets.manage',
  'tasks.view', 'tasks.manage',
  'bookings.view', 'bookings.manage',
  'packages.view', 'packages.manage',
  'ai.use', 'ai.manage',
  'analytics.view',
  'finance.view', 'finance.manage',
  'finance.view_revenue', 'finance.view_expenses', 'finance.view_profit',
  'finance.view_cashflow', 'finance.view_payroll', 'finance.manage_payroll',
  'finance.approve_expenses', 'finance.close_period', 'finance.export',
  'subscriptions.view', 'subscriptions.manage',
  'invoices.view', 'invoices.manage',
  'users.view', 'users.create', 'users.edit', 'users.manage_roles', 'users.deactivate',
  'settings.view', 'settings.manage',
  'audit.view',
  'portal.access',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL: readonly Permission[] = PERMISSIONS

/** Everything except payroll — deliberate separation of duties. */
const ADMIN_NO_PAYROLL: readonly Permission[] = ALL.filter(
  (p) => p !== 'finance.view_payroll' && p !== 'finance.manage_payroll'
)

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: ALL,
  agency_admin: ADMIN_NO_PAYROLL,

  finance_manager: [
    'dashboard.view', 'clients.view', 'projects.view',
    'packages.view', 'packages.manage', 'analytics.view',
    'finance.view', 'finance.manage', 'finance.view_revenue', 'finance.view_expenses',
    'finance.view_profit', 'finance.view_cashflow', 'finance.view_payroll',
    'finance.manage_payroll', 'finance.approve_expenses', 'finance.close_period',
    'finance.export',
    'subscriptions.view', 'subscriptions.manage',
    'invoices.view', 'invoices.manage',
    'users.view', 'audit.view', 'settings.view',
  ],

  accountant: [
    'dashboard.view', 'clients.view', 'packages.view',
    'finance.view', 'finance.manage', 'finance.view_revenue',
    'finance.view_expenses', 'finance.view_cashflow', 'finance.export',
    'subscriptions.view', 'invoices.view', 'invoices.manage', 'settings.view',
  ],

  hr_manager: [
    'dashboard.view', 'users.view', 'users.create', 'users.edit',
    'finance.view', 'finance.view_payroll', 'finance.manage_payroll', 'settings.view',
  ],

  operations: [
    'dashboard.view', 'clients.view', 'clients.edit',
    'projects.view', 'projects.create', 'projects.edit',
    'videos.view', 'videos.manage', 'calendar.view', 'calendar.manage',
    'assets.view', 'assets.manage', 'tasks.view', 'tasks.manage',
    'bookings.view', 'bookings.manage', 'packages.view',
    'analytics.view', 'users.view', 'settings.view',
  ],

  project_manager: [
    'dashboard.view', 'clients.view', 'clients.create', 'clients.edit',
    'projects.view', 'projects.create', 'projects.edit',
    'videos.view', 'videos.manage', 'videos.review',
    'calendar.view', 'calendar.manage', 'assets.view', 'assets.manage',
    'tasks.view', 'tasks.manage', 'bookings.view', 'bookings.manage',
    'packages.view', 'invoices.view', 'analytics.view', 'ai.use',
    'users.view', 'settings.view',
  ],

  account_manager: [
    'dashboard.view', 'clients.view', 'clients.edit', 'projects.view',
    'videos.view', 'calendar.view', 'packages.view', 'invoices.view',
    'tasks.view', 'analytics.view',
  ],

  client_success: [
    'dashboard.view', 'clients.view', 'clients.edit', 'projects.view',
    'videos.view', 'calendar.view', 'packages.view', 'tasks.view',
  ],

  marketing_manager: [
    'dashboard.view', 'clients.view', 'projects.view',
    'videos.view', 'videos.manage', 'calendar.view', 'calendar.manage',
    'assets.view', 'tasks.view', 'tasks.manage',
    'analytics.view', 'ai.use', 'ai.manage',
  ],

  content_strategist: [
    'dashboard.view', 'clients.view', 'projects.view', 'videos.view',
    'calendar.view', 'calendar.manage', 'assets.view', 'tasks.view',
    'analytics.view', 'ai.use',
  ],

  social_media_manager: [
    'dashboard.view', 'clients.view', 'videos.view', 'videos.manage',
    'calendar.view', 'calendar.manage', 'assets.view',
    'tasks.view', 'tasks.manage', 'analytics.view', 'ai.use',
  ],

  media_buyer: [
    'dashboard.view', 'clients.view', 'projects.view',
    'analytics.view', 'calendar.view', 'tasks.view',
  ],

  sales_manager: [
    'dashboard.view', 'clients.view', 'clients.create', 'clients.edit',
    'packages.view', 'packages.manage', 'invoices.view',
    'analytics.view', 'subscriptions.view',
  ],

  sales: ['dashboard.view', 'clients.view', 'clients.create', 'packages.view', 'tasks.view'],

  videographer: [
    'dashboard.view', 'videos.view', 'bookings.view', 'calendar.view',
    'assets.view', 'assets.manage', 'tasks.view', 'tasks.manage',
  ],

  video_editor: [
    'dashboard.view', 'clients.view', 'videos.view', 'videos.manage',
    'calendar.view', 'assets.view', 'assets.manage',
    'tasks.view', 'tasks.manage', 'ai.use',
  ],

  graphic_designer: [
    'dashboard.view', 'videos.view', 'assets.view', 'assets.manage',
    'calendar.view', 'tasks.view', 'tasks.manage',
  ],

  content_creator: [
    'dashboard.view', 'videos.view', 'calendar.view',
    'assets.view', 'tasks.view', 'ai.use',
  ],

  viewer: ['dashboard.view', 'clients.view', 'projects.view', 'videos.view', 'calendar.view', 'tasks.view'],

  client: ['portal.access'],
}

export function permissionsForRole(role: UserRole | null): Permission[] {
  if (!role) return []
  return [...(ROLE_PERMISSIONS[role] ?? [])]
}

export function roleHasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false
  if (role === ROLES.SUPER_ADMIN) return true
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/** Route shown when a role cannot be resolved or the workspace is incomplete. */
export const SETUP_ROUTE = '/app/setup'

/**
 * The landing route for a role.
 *
 * CRITICAL: every value returned here must be reachable by that role. Returning
 * a guarded route the role cannot enter is what caused the redirect loop that
 * blanked the app — an unknown role lands on SETUP_ROUTE, outside all guards.
 */
export function homeRouteForRole(role: UserRole | null): string {
  switch (role) {
    case ROLES.CLIENT:
      return '/client'
    case ROLES.FINANCE_MANAGER:
    case ROLES.ACCOUNTANT:
      return '/app/finance'
    case ROLES.HR_MANAGER:
      return '/app/users'
    case ROLES.VIDEO_EDITOR:
    case ROLES.VIDEOGRAPHER:
    case ROLES.GRAPHIC_DESIGNER:
    case ROLES.CONTENT_CREATOR:
      return '/app/pipeline'
    case ROLES.SOCIAL_MEDIA_MANAGER:
    case ROLES.CONTENT_STRATEGIST:
      return '/app/calendar'
    case null:
    case undefined:
      return SETUP_ROUTE
    default:
      // Everyone else lands on the dashboard, which requires only dashboard.view
      // — a permission every internal role holds.
      return '/app/dashboard'
  }
}
