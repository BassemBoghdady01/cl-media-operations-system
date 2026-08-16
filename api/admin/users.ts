/**
 * EZ Marketing Agency — Secure user administration endpoint
 *
 * POST /api/admin/users   { action, ...payload }
 *   action: 'create' | 'change_role' | 'deactivate' | 'reactivate'
 *
 * SECURITY MODEL
 *   • Runs ONLY on the server (Vercel function). Uses SUPABASE_SERVICE_ROLE_KEY,
 *     which must never be exposed to the browser (no VITE_ prefix).
 *   • The caller must present their own Supabase access token
 *     (`Authorization: Bearer <jwt>`); the token is verified server-side and
 *     the caller's profile + permissions are loaded before anything happens.
 *   • Permission checks replicate has_permission(): super_admin passes,
 *     otherwise user_permissions override → role_permissions grant.
 *   • Super Admin protection is enforced HERE as well as by the database
 *     trigger: only a super_admin can create/modify/deactivate a super_admin,
 *     and the last super_admin can never be demoted or deactivated.
 *   • Authority ordering: a caller may only manage roles BELOW their own level
 *     (roles.level — lower number = higher authority), super_admin excepted.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

interface ActorContext {
  id: string
  email: string
  role: string
  level: number
  agencyId: string
  isSuperAdmin: boolean
}

function fail(res: VercelResponse, code: number, error: string) {
  return res.status(code).json({ error })
}

async function hasPermission(svc: SupabaseClient, actor: ActorContext, key: string): Promise<boolean> {
  if (actor.isSuperAdmin) return true
  const { data: override } = await svc
    .from('user_permissions').select('granted')
    .eq('user_id', actor.id).eq('permission_key', key).maybeSingle()
  if (override) return !!override.granted
  const { data: grant } = await svc
    .from('role_permissions').select('permission_key')
    .eq('role_key', actor.role).eq('permission_key', key).maybeSingle()
  return !!grant
}

async function audit(
  svc: SupabaseClient, actor: ActorContext, action: string,
  entityId: string | null, newValue: Record<string, unknown>
) {
  await svc.from('audit_logs').insert({
    agency_id: actor.agencyId,
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity_type: 'profiles',
    entity_id: entityId,
    new_value: newValue,
    metadata: { via: 'api/admin/users' },
  })
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let out = ''
  const buf = new Uint32Array(16)
  crypto.getRandomValues(buf)
  for (const n of buf) out += chars[n % chars.length]
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[admin/users] missing Supabase server credentials')
    return fail(res, 500, 'Server not configured')
  }

  // Service-role client: server-side only, bypasses RLS deliberately.
  const svc = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── 1. Verify the caller's session ──
  const authHeader = String(req.headers.authorization ?? '')
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return fail(res, 401, 'Missing access token')

  const { data: userData, error: userErr } = await svc.auth.getUser(token)
  if (userErr || !userData.user) return fail(res, 401, 'Invalid or expired session')

  const { data: actorProfile } = await svc
    .from('profiles').select('id, email, role, agency_id, status')
    .eq('id', userData.user.id).maybeSingle()

  if (!actorProfile || actorProfile.status !== 'active' || !actorProfile.agency_id) {
    return fail(res, 403, 'Your account is not active in a workspace.')
  }

  const { data: actorRole } = await svc
    .from('roles').select('level').eq('key', actorProfile.role).maybeSingle()

  const actor: ActorContext = {
    id: actorProfile.id,
    email: actorProfile.email,
    role: actorProfile.role,
    level: actorRole?.level ?? 100,
    agencyId: actorProfile.agency_id,
    isSuperAdmin: actorProfile.role === 'super_admin',
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const action = String(body.action ?? '')

  try {
    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      if (!(await hasPermission(svc, actor, 'users.create'))) {
        return fail(res, 403, 'You do not have permission to create users.')
      }

      const email = String(body.email ?? '').trim().toLowerCase()
      const fullName = String(body.full_name ?? '').trim()
      const role = String(body.role ?? '').trim()
      const department = body.department ? String(body.department) : null
      const clientId = body.client_id ? String(body.client_id) : null

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'A valid email is required.')
      if (!fullName) return fail(res, 400, 'Full name is required.')

      const { data: roleRow } = await svc.from('roles').select('key, level').eq('key', role).maybeSingle()
      if (!roleRow) return fail(res, 400, `Unknown role "${role}".`)
      if (role === 'super_admin' && !actor.isSuperAdmin) {
        return fail(res, 403, 'Only a Super Admin can create another Super Admin.')
      }
      if (!actor.isSuperAdmin && roleRow.level <= actor.level) {
        return fail(res, 403, 'You can only create users below your own authority level.')
      }
      if (role === 'client' && !clientId) {
        return fail(res, 400, 'Client users must be linked to a client record.')
      }

      const password = typeof body.password === 'string' && body.password.length >= 8
        ? body.password
        : generatePassword()
      const generated = body.password !== password

      const { data: created, error: createErr } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createErr || !created.user) {
        return fail(res, 400, createErr?.message ?? 'Could not create the auth user.')
      }

      // The signup trigger may have created a bare profile — upsert the real one.
      const { error: profileErr } = await svc.from('profiles').upsert({
        id: created.user.id,
        agency_id: actor.agencyId,
        email,
        full_name: fullName,
        role,
        department,
        client_id: clientId,
        status: 'active',
      })
      if (profileErr) {
        await svc.auth.admin.deleteUser(created.user.id)
        return fail(res, 500, `Auth user rolled back — profile failed: ${profileErr.message}`)
      }

      await audit(svc, actor, 'admin.user_created', created.user.id, { email, role, department })
      return res.status(200).json({ userId: created.user.id, tempPassword: generated ? password : undefined })
    }

    // ── Shared target loading for the remaining actions ─────────────────────
    const userId = String(body.userId ?? '')
    if (!userId) return fail(res, 400, 'userId is required.')

    const { data: target } = await svc
      .from('profiles').select('id, email, role, agency_id, status')
      .eq('id', userId).maybeSingle()
    if (!target || target.agency_id !== actor.agencyId) {
      return fail(res, 404, 'User not found in your workspace.')
    }

    const { data: targetRole } = await svc
      .from('roles').select('level').eq('key', target.role).maybeSingle()
    const targetLevel = targetRole?.level ?? 100

    const superCount = async () => {
      const { count } = await svc
        .from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin').eq('status', 'active')
      return count ?? 0
    }

    // ── CHANGE ROLE ─────────────────────────────────────────────────────────
    if (action === 'change_role') {
      if (!(await hasPermission(svc, actor, 'users.manage_roles'))) {
        return fail(res, 403, 'You do not have permission to change roles.')
      }
      const newRole = String(body.role ?? '').trim()
      const { data: newRoleRow } = await svc.from('roles').select('key, level').eq('key', newRole).maybeSingle()
      if (!newRoleRow) return fail(res, 400, `Unknown role "${newRole}".`)

      if ((target.role === 'super_admin' || newRole === 'super_admin') && !actor.isSuperAdmin) {
        return fail(res, 403, 'Only a Super Admin can change Super Admin roles.')
      }
      if (target.role === 'super_admin' && newRole !== 'super_admin' && (await superCount()) <= 1) {
        return fail(res, 400, 'Cannot demote the last remaining Super Admin.')
      }
      if (!actor.isSuperAdmin && (targetLevel <= actor.level || newRoleRow.level <= actor.level)) {
        return fail(res, 403, 'You can only manage roles below your own authority level.')
      }

      const { error } = await svc.from('profiles').update({ role: newRole }).eq('id', userId)
      if (error) return fail(res, 500, error.message)
      await audit(svc, actor, 'admin.role_changed', userId, { from: target.role, to: newRole })
      return res.status(200).json({ ok: true })
    }

    // ── DEACTIVATE / REACTIVATE ─────────────────────────────────────────────
    if (action === 'deactivate' || action === 'reactivate') {
      if (!(await hasPermission(svc, actor, 'users.deactivate'))) {
        return fail(res, 403, 'You do not have permission to deactivate users.')
      }
      if (userId === actor.id) return fail(res, 400, 'You cannot deactivate your own account.')

      if (action === 'deactivate') {
        if (target.role === 'super_admin') {
          if (!actor.isSuperAdmin) return fail(res, 403, 'Only a Super Admin can deactivate a Super Admin.')
          if ((await superCount()) <= 1) return fail(res, 400, 'Cannot deactivate the last remaining Super Admin.')
        }
        if (!actor.isSuperAdmin && targetLevel <= actor.level) {
          return fail(res, 403, 'You can only deactivate users below your own authority level.')
        }

        const { error } = await svc.from('profiles')
          .update({ status: 'inactive', deactivated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return fail(res, 500, error.message)
        // Block sign-in at the auth layer too.
        await svc.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
        await audit(svc, actor, 'admin.user_deactivated', userId, { email: target.email })
      } else {
        const { error } = await svc.from('profiles')
          .update({ status: 'active', deactivated_at: null })
          .eq('id', userId)
        if (error) return fail(res, 500, error.message)
        await svc.auth.admin.updateUserById(userId, { ban_duration: 'none' })
        await audit(svc, actor, 'admin.user_reactivated', userId, { email: target.email })
      }
      return res.status(200).json({ ok: true })
    }

    return fail(res, 400, `Unknown action "${action}".`)
  } catch (err) {
    console.error('[admin/users] unhandled error:', err)
    return fail(res, 500, 'Internal error')
  }
}
