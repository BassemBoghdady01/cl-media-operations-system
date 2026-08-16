/**
 * EZ Marketing Agency — User Management
 *
 * Lists every profile in the agency with filtering, invitation, profile edits,
 * role changes, activation state, client/project assignment and per-user
 * permission overrides. Every action is gated by the signed-in user's
 * permissions in the UI — and enforced again server-side (RLS / admin API),
 * so the UI gates are convenience, not security.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, X, MoreHorizontal, Pencil, UserCog, UserX, UserCheck,
  Briefcase, FolderKanban, SlidersHorizontal, Activity, Copy, Check, ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, FinanceSkeleton, EmptyState, DataTable,
} from '../../components/finance/FinanceKit'
import { formatDateShort } from '../../lib/finance'
import { ROLE_LABELS, ROLE_LEVEL, ROLES, normalizeRole, type Permission } from '../../config/roles'
import {
  userService,
  type ManagedUser, type RoleRow, type PermissionRow,
} from '../../services/userService'
import { clientService } from '../../services/clientService'
import { projectService } from '../../services/projectService'
import type { Client, Project } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleLabel(raw: string): string {
  const n = normalizeRole(raw)
  return n ? ROLE_LABELS[n] : raw
}

/** Level used for "who may modify whom" — frontend map first, DB level fallback. */
function roleLevelOf(r: RoleRow): number {
  const n = normalizeRole(r.key)
  return n ? ROLE_LEVEL[n] : r.level
}

const STATUS_META: Record<ManagedUser['status'], { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#34D399', bg: 'rgba(16,185,129,0.12)' },
  inactive: { label: 'Inactive', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  invited: { label: 'Invited', color: '#60A5FA', bg: 'rgba(59,130,246,0.12)' },
}

function UserStatusBadge({ status }: { status: ManagedUser['status'] }) {
  const s = STATUS_META[status] ?? STATUS_META.active
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}
    >
      {s.label}
    </span>
  )
}

function RoleChip({ role }: { role: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ color: '#93C5FD', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}
    >
      {roleLabel(role)}
    </span>
  )
}

function Avatar({ name, email, color }: { name: string; email: string; color: string }) {
  const initials =
    (name || email || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => (w.charAt(0) || '').toUpperCase())
      .join('') || '?'
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {initials}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      {message}
    </div>
  )
}

function Modal({
  title, onClose, children, maxWidth = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`glass-blue rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalKind =
  | { kind: 'invite' }
  | { kind: 'edit'; user: ManagedUser }
  | { kind: 'role'; user: ManagedUser }
  | { kind: 'active'; user: ManagedUser }
  | { kind: 'clients'; user: ManagedUser }
  | { kind: 'projects'; user: ManagedUser }
  | { kind: 'overrides'; user: ManagedUser }

interface MenuState {
  user: ManagedUser
  top: number
  right: number
}

export default function UsersPage() {
  const { user: authUser, agency, role: authRole, hasPermission } = useAuth()
  const agencyId = authUser?.agencyId || agency?.id || ''

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [modal, setModal] = useState<ModalKind | null>(null)

  const actorIsSuper = authRole === ROLES.SUPER_ADMIN
  const actorLevel = authRole ? ROLE_LEVEL[authRole] : Number.MAX_SAFE_INTEGER

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [u, r, c, p] = await Promise.all([
        userService.listUsers(agencyId),
        userService.listRoles(),
        clientService.getAll(agencyId),
        projectService.getAll(agencyId),
      ])
      setUsers(u); setRoles(r); setClients(c); setProjects(p)
    } catch (err) {
      console.error('[UsersPage] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  // Distinct departments actually present in the data.
  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const u of users) if (u.department) set.add(u.department)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [users])

  // Clients per account manager — one clients query, counted locally.
  const clientCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of clients) {
      if (c.accountManagerId) map.set(c.accountManagerId, (map.get(c.accountManagerId) ?? 0) + 1)
    }
    return map
  }, [clients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      if (roleFilter && normalizeRole(u.role) !== normalizeRole(roleFilter) && u.role !== roleFilter) return false
      if (departmentFilter && u.department !== departmentFilter) return false
      if (statusFilter && u.status !== statusFilter) return false
      return true
    })
  }, [users, search, roleFilter, departmentFilter, statusFilter])

  /** Roles the current actor may hand out: super admin gets all, everyone else
   *  only roles strictly below their own authority. */
  const assignableRoles = useMemo(
    () => (actorIsSuper ? roles : roles.filter((r) => roleLevelOf(r) > actorLevel)),
    [roles, actorIsSuper, actorLevel]
  )

  const openMenu = (u: ManagedUser, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({
      user: u,
      top: Math.min(rect.bottom + 6, Math.max(80, window.innerHeight - 320)),
      right: Math.max(12, window.innerWidth - rect.right),
    })
  }

  const openModal = (m: ModalKind) => { setMenu(null); setModal(m) }

  if (error) {
    return <PageErrorState title="We couldn't load users" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="User Management"
        subtitle="Everyone with access to this workspace — roles, departments and assignments."
      >
        {hasPermission('users.create') && (
          <button className="btn-primary py-2 px-3 text-xs" onClick={() => setModal({ kind: 'invite' })}>
            <Plus className="w-3.5 h-3.5" /> Invite user
          </button>
        )}
      </FinancePageHeader>

      {loading ? (
        <Panel><FinanceSkeleton rows={7} /></Panel>
      ) : (
        <Panel>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                className="input pl-9 py-2 text-sm"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="input py-2 text-sm max-w-[180px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>{roleLabel(r.key) || r.label}</option>
              ))}
            </select>
            <select className="input py-2 text-sm max-w-[180px]" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="input py-2 text-sm max-w-[150px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="invited">Invited</option>
            </select>
          </div>

          {users.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No team members yet."
              description="Invite your first teammate and they will appear here."
              action={hasPermission('users.create') ? (
                <button className="btn-primary py-2 px-4 text-xs" onClick={() => setModal({ kind: 'invite' })}>
                  <Plus className="w-3.5 h-3.5" /> Invite user
                </button>
              ) : undefined}
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon="🔍" title="No users match your filters." description="Try clearing the search or filters." />
          ) : (
            <DataTable
              minWidth={1080}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'department', label: 'Department' },
                { key: 'status', label: 'Status' },
                { key: 'last_login', label: 'Last login' },
                { key: 'clients', label: 'Clients', align: 'center' },
                { key: 'created', label: 'Created' },
                { key: 'actions', label: '', align: 'right' },
              ]}
            >
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.full_name} email={u.email} color={u.color} />
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium truncate">{u.full_name || '—'}</div>
                        {u.job_title && <div className="text-[11px] text-slate-500 truncate">{u.job_title}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-400">{u.email}</td>
                  <td className="py-3 pr-3"><RoleChip role={u.role} /></td>
                  <td className="py-3 pr-3 text-xs text-slate-400">{u.department ?? '—'}</td>
                  <td className="py-3 pr-3"><UserStatusBadge status={u.status} /></td>
                  <td className="py-3 pr-3 text-xs text-slate-400 whitespace-nowrap">
                    {u.last_login_at ? formatDateShort(u.last_login_at) : 'Never'}
                  </td>
                  <td className="py-3 pr-3 text-center text-xs text-slate-300 font-semibold">
                    {clientCounts.get(u.id) ?? 0}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-400 whitespace-nowrap">{formatDateShort(u.created_at)}</td>
                  <td className="py-3 text-right">
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                      onClick={(e) => openMenu(u, e)}
                      aria-label={`Actions for ${u.full_name || u.email}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      {/* Row actions menu — fixed position so the table's overflow never clips it. */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-56 rounded-xl py-1.5 glass-blue shadow-2xl"
            style={{ top: menu.top, right: menu.right, background: 'rgba(10,16,38,0.97)' }}
          >
            <RowMenu
              user={menu.user}
              actorIsSuper={actorIsSuper}
              hasPermission={hasPermission}
              onAction={openModal}
              onClose={() => setMenu(null)}
            />
          </div>
        </>
      )}

      {/* Modals */}
      {modal?.kind === 'invite' && (
        <InviteModal
          roles={assignableRoles}
          clients={clients}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'edit' && (
        <EditProfileModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'role' && (
        <ChangeRoleModal
          user={modal.user}
          roles={assignableRoles}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'active' && (
        <ActiveToggleModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'clients' && (
        <AssignClientsModal
          user={modal.user}
          clients={clients}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'projects' && (
        <AssignProjectsModal
          user={modal.user}
          projects={projects}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {modal?.kind === 'overrides' && (
        <OverridesModal
          user={modal.user}
          grantedBy={authUser?.id ?? ''}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── Row actions menu ─────────────────────────────────────────────────────────

function RowMenu({
  user, actorIsSuper, hasPermission, onAction, onClose,
}: {
  user: ManagedUser
  actorIsSuper: boolean
  hasPermission: (p: Permission) => boolean
  onAction: (m: ModalKind) => void
  onClose: () => void
}) {
  const can = hasPermission
  const targetIsSuper = normalizeRole(user.role) === ROLES.SUPER_ADMIN
  const roleChangeBlocked = !actorIsSuper && targetIsSuper

  const Item = ({
    icon, label, onClick, disabled, danger, title,
  }: {
    icon: React.ReactNode
    label: string
    onClick?: () => void
    disabled?: boolean
    danger?: boolean
    title?: string
  }) => (
    <button
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors ${
        disabled
          ? 'text-slate-600 cursor-not-allowed'
          : danger
            ? 'text-red-400 hover:bg-red-500/10'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
      }`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {icon}{label}
    </button>
  )

  return (
    <>
      {can('users.edit') && (
        <Item icon={<Pencil className="w-3.5 h-3.5" />} label="Edit profile"
          onClick={() => onAction({ kind: 'edit', user })} />
      )}
      {can('users.manage_roles') && (
        <Item icon={<UserCog className="w-3.5 h-3.5" />} label="Change role"
          disabled={roleChangeBlocked}
          title={roleChangeBlocked ? 'Only a Super Admin can change a Super Admin\'s role.' : undefined}
          onClick={() => onAction({ kind: 'role', user })} />
      )}
      {can('users.edit') && (
        <Item icon={<Briefcase className="w-3.5 h-3.5" />} label="Assign clients"
          onClick={() => onAction({ kind: 'clients', user })} />
      )}
      {can('users.edit') && (
        <Item icon={<FolderKanban className="w-3.5 h-3.5" />} label="Assign projects"
          onClick={() => onAction({ kind: 'projects', user })} />
      )}
      {can('users.manage_roles') && (
        <Item icon={<SlidersHorizontal className="w-3.5 h-3.5" />} label="Permission overrides"
          onClick={() => onAction({ kind: 'overrides', user })} />
      )}
      {can('audit.view') && (
        <Link
          to="/app/audit"
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          onClick={onClose}
        >
          <Activity className="w-3.5 h-3.5" /> View activity
        </Link>
      )}
      {can('users.deactivate') && (
        user.status === 'inactive' ? (
          <Item icon={<UserCheck className="w-3.5 h-3.5" />} label="Reactivate"
            onClick={() => onAction({ kind: 'active', user })} />
        ) : (
          <Item icon={<UserX className="w-3.5 h-3.5" />} label="Deactivate" danger
            onClick={() => onAction({ kind: 'active', user })} />
        )
      )}
    </>
  )
}

// ─── Edit profile ─────────────────────────────────────────────────────────────

function EditProfileModal({
  user, onClose, onSaved,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [fullName, setFullName] = useState(user.full_name)
  const [department, setDepartment] = useState(user.department ?? '')
  const [jobTitle, setJobTitle] = useState(user.job_title ?? '')

  const submit = async () => {
    if (!fullName.trim()) { setErr('Please enter a name.'); return }
    setSaving(true); setErr('')
    try {
      await userService.updateProfile(user.id, {
        full_name: fullName.trim(),
        department: department.trim() || null,
        job_title: jobTitle.trim() || null,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <FormError message={err} />
      <div className="space-y-3">
        <Field label="Full name *">
          <input className="input py-2 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Department">
          <input className="input py-2 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Production" />
        </Field>
        <Field label="Job title">
          <input className="input py-2 text-sm" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Video Editor" />
        </Field>
      </div>
      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Change role ──────────────────────────────────────────────────────────────

function ChangeRoleModal({
  user, roles, onClose, onSaved,
}: {
  user: ManagedUser
  roles: RoleRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const current = normalizeRole(user.role) ?? user.role
  const [nextRole, setNextRole] = useState(
    roles.some((r) => r.key === current) ? current : ''
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!nextRole) { setErr('Please choose a role.'); return }
    setSaving(true); setErr('')
    try {
      await userService.changeRole(user.id, nextRole)
      onSaved()
    } catch (e) {
      // Server messages are precise (level checks, last-super-admin, etc.).
      setErr(e instanceof Error ? e.message : 'Could not change the role.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Change role" onClose={onClose}>
      <FormError message={err} />
      <p className="text-xs text-slate-400 mb-4">
        {user.full_name || user.email} is currently <span className="text-white font-semibold">{roleLabel(user.role)}</span>.
      </p>
      <Field label="New role *">
        <select className="input py-2 text-sm" value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
          <option value="">Select a role…</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{roleLabel(r.key) || r.label}</option>
          ))}
        </select>
      </Field>
      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit}
          disabled={saving || !nextRole || nextRole === current}>
          {saving ? 'Saving…' : 'Change role'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Deactivate / reactivate ──────────────────────────────────────────────────

function ActiveToggleModal({
  user, onClose, onSaved,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: () => void
}) {
  const reactivating = user.status === 'inactive'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirm = async () => {
    setBusy(true); setErr('')
    try {
      if (reactivating) await userService.reactivateUser(user.id)
      else await userService.deactivateUser(user.id)
      onSaved()
    } catch (e) {
      // e.g. last-super-admin protection — surface the server's message.
      setErr(e instanceof Error ? e.message : 'The request failed.')
      setBusy(false)
    }
  }

  return (
    <Modal title={reactivating ? 'Reactivate user' : 'Deactivate user'} onClose={onClose} maxWidth="max-w-md">
      <FormError message={err} />
      <p className="text-sm text-slate-300 mb-5">
        {reactivating ? (
          <>Restore access for <span className="font-semibold text-white">{user.full_name || user.email}</span>?
            They will be able to sign in again immediately.</>
        ) : (
          <>Deactivate <span className="font-semibold text-white">{user.full_name || user.email}</span>?
            They will lose access immediately. Their history and assignments are kept.</>
        )}
      </p>
      <div className="flex gap-3">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button
          className={`flex-1 justify-center py-2.5 text-sm rounded-xl font-semibold flex items-center gap-2 transition-colors ${
            reactivating ? 'btn-primary' : 'text-red-400 hover:text-red-300'
          }`}
          style={reactivating ? undefined : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
          onClick={confirm}
          disabled={busy}
        >
          {busy ? 'Working…' : reactivating ? 'Reactivate' : 'Deactivate'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Assign clients ───────────────────────────────────────────────────────────

function AssignClientsModal({
  user, clients, onClose, onSaved,
}: {
  user: ManagedUser
  clients: Client[]
  onClose: () => void
  onSaved: () => void
}) {
  const initial = useMemo(
    () => new Set(clients.filter((c) => c.accountManagerId === user.id).map((c) => c.id)),
    [clients, user.id]
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      const ops: Promise<void>[] = []
      for (const c of clients) {
        const was = initial.has(c.id)
        const now = selected.has(c.id)
        if (was === now) continue
        ops.push(userService.assignClient(c.id, now ? user.id : null))
      }
      await Promise.all(ops)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save assignments.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Assign clients" onClose={onClose}>
      <FormError message={err} />
      <p className="text-xs text-slate-400 mb-4">
        Clients managed by <span className="text-white font-semibold">{user.full_name || user.email}</span> as account manager.
      </p>
      {clients.length === 0 ? (
        <EmptyState icon="🏢" title="No clients yet." description="Create a client first, then assign a manager." />
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {clients.map((c) => {
            const managedByOther = !!c.accountManagerId && c.accountManagerId !== user.id
            return (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className="text-sm text-white flex-1 truncate">{c.name}</span>
                {managedByOther && !selected.has(c.id) && (
                  <span className="text-[10px] text-amber-400/80">has another manager</span>
                )}
              </label>
            )
          })}
        </div>
      )}
      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit}
          disabled={saving || clients.length === 0}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Assign projects ──────────────────────────────────────────────────────────

function AssignProjectsModal({
  user, projects, onClose, onSaved,
}: {
  user: ManagedUser
  projects: Project[]
  onClose: () => void
  onSaved: () => void
}) {
  const initial = useMemo(
    () => new Set(projects.filter((p) => p.teamIds.includes(user.id)).map((p) => p.id)),
    [projects, user.id]
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      const ops: Promise<void>[] = []
      for (const p of projects) {
        const was = initial.has(p.id)
        const now = selected.has(p.id)
        if (was === now) continue
        ops.push(userService.assignProject(p.id, user.id, now))
      }
      await Promise.all(ops)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save assignments.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Assign projects" onClose={onClose}>
      <FormError message={err} />
      <p className="text-xs text-slate-400 mb-4">
        Projects where <span className="text-white font-semibold">{user.full_name || user.email}</span> is on the team.
      </p>
      {projects.length === 0 ? (
        <EmptyState icon="📁" title="No projects yet." description="Create a project first, then build its team." />
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {projects.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="text-sm text-white flex-1 truncate">{p.name}</span>
              {p.clientName && <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{p.clientName}</span>}
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit}
          disabled={saving || projects.length === 0}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Permission overrides ─────────────────────────────────────────────────────

type OverrideState = 'inherit' | 'grant' | 'revoke'

/** 'AI' stays uppercase; everything else gets a leading capital. */
function moduleTitle(module: string): string {
  if (module.toLowerCase() === 'ai') return 'AI'
  return module.charAt(0).toUpperCase() + module.slice(1)
}

function OverridesModal({
  user, grantedBy, onClose,
}: {
  user: ManagedUser
  grantedBy: string
  onClose: () => void
}) {
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [original, setOriginal] = useState<Map<string, OverrideState>>(new Map())
  const [draft, setDraft] = useState<Record<string, OverrideState>>({})
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null)
    try {
      const [perms, overrides] = await Promise.all([
        userService.listPermissions(),
        userService.listUserOverrides(user.id),
      ])
      const orig = new Map<string, OverrideState>()
      const d: Record<string, OverrideState> = {}
      for (const o of overrides) {
        const state: OverrideState = o.granted ? 'grant' : 'revoke'
        orig.set(o.permission_key, state)
        d[o.permission_key] = state
      }
      setPermissions(perms)
      setOriginal(orig)
      setDraft(d)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load permissions.')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>()
    for (const p of permissions) {
      const list = map.get(p.module) ?? []
      list.push(p)
      map.set(p.module, list)
    }
    return Array.from(map.entries())
  }, [permissions])

  const stateOf = (key: string): OverrideState => draft[key] ?? 'inherit'
  const dirty = useMemo(
    () => permissions.some((p) => stateOf(p.key) !== (original.get(p.key) ?? 'inherit')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, draft, original]
  )

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      const ops: Promise<void>[] = []
      for (const p of permissions) {
        const before = original.get(p.key) ?? 'inherit'
        const after = stateOf(p.key)
        if (before === after) continue
        if (after === 'inherit') ops.push(userService.clearUserOverride(user.id, p.key))
        else ops.push(userService.setUserOverride(user.id, p.key, after === 'grant', grantedBy))
      }
      await Promise.all(ops)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save overrides.')
      setSaving(false)
    }
  }

  const SEGMENTS: { value: OverrideState; label: string; activeColor: string }[] = [
    { value: 'inherit', label: 'Inherit', activeColor: 'rgba(148,163,184,0.25)' },
    { value: 'grant', label: 'Granted', activeColor: 'rgba(16,185,129,0.25)' },
    { value: 'revoke', label: 'Revoked', activeColor: 'rgba(239,68,68,0.25)' },
  ]

  return (
    <Modal title="Permission overrides" onClose={onClose} maxWidth="max-w-2xl">
      <FormError message={err} />
      <p className="text-xs text-slate-400 mb-4">
        Per-user exceptions for <span className="text-white font-semibold">{user.full_name || user.email}</span>{' '}
        (role: {roleLabel(user.role)}). Overrides sit on top of the role. The database enforces them server-side.
      </p>

      {loading ? (
        <FinanceSkeleton rows={6} />
      ) : loadErr ? (
        <PageErrorState title="Couldn't load permissions" message={loadErr} onRetry={load} />
      ) : (
        <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {groups.map(([module, perms]) => (
            <div key={module}>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                {moduleTitle(module)}
              </h3>
              <div className="space-y-1">
                {perms.map((p) => {
                  const state = stateOf(p.key)
                  return (
                    <div key={p.key}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{p.key}</span>
                          {p.is_sensitive && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-400"
                              style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}
                            >
                              <ShieldAlert className="w-2.5 h-2.5" /> sensitive
                            </span>
                          )}
                        </div>
                        {p.description && <div className="text-[11px] text-slate-500 truncate">{p.description}</div>}
                      </div>
                      <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {SEGMENTS.map((s) => (
                          <button
                            key={s.value}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                              state === s.value ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            style={state === s.value ? { background: s.activeColor } : undefined}
                            onClick={() => setDraft((prev) => ({ ...prev, [p.key]: s.value }))}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit}
          disabled={saving || loading || !!loadErr || !dirty}>
          {saving ? 'Saving…' : 'Save overrides'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Invite user ──────────────────────────────────────────────────────────────

function InviteModal({
  roles, clients, onClose, onDone,
}: {
  roles: RoleRow[]
  clients: Client[]
  onClose: () => void
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [clientId, setClientId] = useState('')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [copied, setCopied] = useState(false)

  const isClientRole = normalizeRole(role) === ROLES.CLIENT

  const submit = async () => {
    const mail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setErr('Please enter a valid email address.'); return }
    if (!fullName.trim()) { setErr('Please enter a full name.'); return }
    if (!role) { setErr('Please choose a role.'); return }
    if (isClientRole && !clientId) { setErr('The Client role must be linked to a client record.'); return }
    if (password && password.length < 8) { setErr('The initial password must be at least 8 characters (or leave it blank to auto-generate).'); return }

    setSaving(true); setErr('')
    try {
      const result = await userService.createUser({
        email: mail,
        full_name: fullName.trim(),
        role,
        department: department.trim() || null,
        password: password || undefined,
        client_id: isClientRole ? clientId : null,
      })
      setTempPassword(result.tempPassword ?? null)
      setCreated(true)
    } catch (e) {
      // Admin API errors are readable — surface them verbatim.
      setErr(e instanceof Error ? e.message : 'Could not create the user.')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the password is still visible to copy manually */
    }
  }

  // ── Success view ──
  if (created) {
    return (
      <Modal title="User created" onClose={onDone} maxWidth="max-w-md">
        <p className="text-sm text-slate-300 mb-4">
          <span className="font-semibold text-white">{fullName.trim()}</span> ({email.trim().toLowerCase()}) has been created.
        </p>
        {tempPassword ? (
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-2">Temporary password</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-white px-3 py-2 rounded-lg break-all"
                style={{ background: 'rgba(0,0,0,0.35)' }}>
                {tempPassword}
              </code>
              <button className="btn-secondary py-2 px-3 text-xs shrink-0" onClick={copy}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-amber-400/90 mt-2 font-medium">
              Store this now — it cannot be shown again.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-5">
            They can sign in with the password you set.
          </p>
        )}
        <button className="btn-primary w-full justify-center py-2.5 text-sm" onClick={onDone}>Done</button>
      </Modal>
    )
  }

  // ── Form view ──
  return (
    <Modal title="Invite user" onClose={onClose}>
      <FormError message={err} />
      <div className="space-y-3">
        <Field label="Email *">
          <input className="input py-2 text-sm" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Field>
        <Field label="Full name *">
          <input className="input py-2 text-sm" value={fullName}
            onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role *">
            <select className="input py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>{roleLabel(r.key) || r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <input className="input py-2 text-sm" value={department}
              onChange={(e) => setDepartment(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        {isClientRole && (
          <Field label="Client record *">
            <select className="input py-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select the client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Initial password">
          <input className="input py-2 text-sm" type="text" value={password} autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to auto-generate (min 8 characters)" />
        </Field>
      </div>
      <div className="flex gap-3 mt-5">
        <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
          {saving ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </Modal>
  )
}
