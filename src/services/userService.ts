/**
 * EZ Marketing Agency — Users, Roles & Permissions administration
 *
 * Reads go straight to Supabase under RLS. PRIVILEGED writes (create user,
 * change role, deactivate) go through /api/admin/users, which validates the
 * caller's session + users.* permission server-side and uses the service-role
 * key THERE ONLY. The browser never holds the service-role key.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import { supabase } from '../lib/supabase'
import type { Permission } from '../config/roles'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManagedUser {
  id: string
  agency_id: string | null
  full_name: string
  email: string
  role: string
  department: string | null
  job_title: string | null
  status: 'active' | 'inactive' | 'invited'
  client_id: string | null
  avatar_url: string | null
  color: string
  last_login_at: string | null
  deactivated_at: string | null
  created_at: string
}

export interface RoleRow {
  key: string
  label: string
  description: string | null
  level: number
  is_internal: boolean
  is_system: boolean
}

export interface PermissionRow {
  key: string
  module: string
  action: string
  description: string | null
  is_sensitive: boolean
}

export interface RolePermissionRow {
  role_key: string
  permission_key: string
}

export interface UserPermissionOverride {
  user_id: string
  permission_key: string
  granted: boolean
}

export interface CreateUserInput {
  email: string
  full_name: string
  role: string
  department?: string | null
  password?: string
  client_id?: string | null
}

function mapUser(r: Row): ManagedUser {
  return {
    id: r.id,
    agency_id: r.agency_id ?? null,
    full_name: r.full_name ?? '',
    email: r.email ?? '',
    role: r.role ?? '',
    department: r.department ?? null,
    job_title: r.job_title ?? null,
    status: r.status ?? 'active',
    client_id: r.client_id ?? null,
    avatar_url: r.avatar_url ?? null,
    color: r.color ?? '#3B82F6',
    last_login_at: r.last_login_at ?? null,
    deactivated_at: r.deactivated_at ?? null,
    created_at: dstr(r.created_at),
  }
}

// ─── Admin API bridge (server-side service role) ─────────────────────────────

async function adminApi<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('You must be signed in.')

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Admin request failed (${res.status}).`)
  }
  return body as T
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const userService = {
  listUsers: async (
    agencyId: string,
    filters: { role?: string; department?: string; status?: string; search?: string } = {}
  ): Promise<ManagedUser[]> => {
    let q = db().from('profiles').select('*').eq('agency_id', agencyId).order('full_name')
    if (filters.role) q = q.eq('role', filters.role)
    if (filters.department) q = q.eq('department', filters.department)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.search) q = q.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    const { data, error } = await q
    orThrow('userService.listUsers', error)
    return (data ?? []).map(mapUser)
  },

  getUser: async (id: string): Promise<ManagedUser | undefined> => {
    const { data, error } = await db().from('profiles').select('*').eq('id', id).maybeSingle()
    orThrow('userService.getUser', error)
    return data ? mapUser(data) : undefined
  },

  /** Non-privileged profile fields (name, department, job title, colour). */
  updateProfile: async (
    id: string,
    updates: { full_name?: string; department?: string | null; job_title?: string | null; color?: string }
  ): Promise<void> => {
    const { error } = await db().from('profiles').update(updates).eq('id', id)
    orThrow('userService.updateProfile', error)
  },

  // ── Privileged operations → server-side admin API ──
  createUser: (input: CreateUserInput) =>
    adminApi<{ userId: string; tempPassword?: string }>('create', { ...input }),

  changeRole: (userId: string, role: string) =>
    adminApi<{ ok: true }>('change_role', { userId, role }),

  deactivateUser: (userId: string) => adminApi<{ ok: true }>('deactivate', { userId }),

  reactivateUser: (userId: string) => adminApi<{ ok: true }>('reactivate', { userId }),

  // ── Roles & permissions catalogue ──
  listRoles: async (): Promise<RoleRow[]> => {
    const { data, error } = await db().from('roles').select('*').order('level')
    orThrow('userService.listRoles', error)
    return (data ?? []) as RoleRow[]
  },

  listPermissions: async (): Promise<PermissionRow[]> => {
    const { data, error } = await db().from('permissions').select('*').order('module').order('action')
    orThrow('userService.listPermissions', error)
    return (data ?? []) as PermissionRow[]
  },

  listRolePermissions: async (): Promise<RolePermissionRow[]> => {
    const { data, error } = await db().from('role_permissions').select('role_key, permission_key')
    orThrow('userService.listRolePermissions', error)
    return (data ?? []) as RolePermissionRow[]
  },

  /** Grant/revoke a role permission (super admin only — RLS enforces). */
  setRolePermission: async (roleKey: string, permissionKey: string, granted: boolean): Promise<void> => {
    if (granted) {
      const { error } = await db()
        .from('role_permissions')
        .upsert({ role_key: roleKey, permission_key: permissionKey })
      orThrow('userService.grantRolePermission', error)
    } else {
      const { error } = await db()
        .from('role_permissions').delete()
        .eq('role_key', roleKey).eq('permission_key', permissionKey)
      orThrow('userService.revokeRolePermission', error)
    }
  },

  // ── Per-user overrides ──
  listUserOverrides: async (userId: string): Promise<UserPermissionOverride[]> => {
    const { data, error } = await db()
      .from('user_permissions').select('user_id, permission_key, granted')
      .eq('user_id', userId)
    orThrow('userService.listUserOverrides', error)
    return (data ?? []) as UserPermissionOverride[]
  },

  setUserOverride: async (
    userId: string, permission: Permission | string, granted: boolean, grantedBy: string
  ): Promise<void> => {
    const { error } = await db()
      .from('user_permissions')
      .upsert({ user_id: userId, permission_key: permission, granted, granted_by: grantedBy })
    orThrow('userService.setUserOverride', error)
  },

  clearUserOverride: async (userId: string, permission: string): Promise<void> => {
    const { error } = await db()
      .from('user_permissions').delete()
      .eq('user_id', userId).eq('permission_key', permission)
    orThrow('userService.clearUserOverride', error)
  },

  // ── Client / project assignment ──
  /** Clients whose account manager is this user. */
  listAssignedClients: async (userId: string): Promise<{ id: string; name: string }[]> => {
    const { data, error } = await db()
      .from('clients').select('id, name').eq('assigned_manager_id', userId).order('name')
    orThrow('userService.listAssignedClients', error)
    return (data ?? []) as { id: string; name: string }[]
  },

  assignClient: async (clientId: string, userId: string | null): Promise<void> => {
    const { error } = await db()
      .from('clients').update({ assigned_manager_id: userId }).eq('id', clientId)
    orThrow('userService.assignClient', error)
  },

  /** Add/remove the user from a project's team_ids array. */
  assignProject: async (projectId: string, userId: string, add: boolean): Promise<void> => {
    const { data, error } = await db().from('projects').select('team_ids').eq('id', projectId).single()
    orThrow('userService.assignProject(read)', error)
    const team: string[] = (data as Row)?.team_ids ?? []
    const next = add ? Array.from(new Set([...team, userId])) : team.filter((t) => t !== userId)
    const { error: upErr } = await db().from('projects').update({ team_ids: next }).eq('id', projectId)
    orThrow('userService.assignProject(write)', upErr)
  },

  /** Stamp profiles.last_login_at for the signed-in user. */
  touchLastLogin: async (): Promise<void> => {
    const { error } = await db().rpc('touch_last_login')
    if (error) console.warn('[userService.touchLastLogin]', error.message)
  },
}
