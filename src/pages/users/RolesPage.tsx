/**
 * EZ Marketing Agency — Roles & Permissions
 *
 * Left: the role catalogue. Right: the selected role's permission checklist,
 * grouped by module. Editing is reserved for Super Admins — and even then the
 * database re-checks via RLS, so the UI lock is a courtesy, not the fence.
 * The super_admin role itself is immutable: it always holds every permission.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { FinancePageHeader, Panel, FinanceSkeleton, EmptyState } from '../../components/finance/FinanceKit'
import { ROLE_LABELS, ROLES, normalizeRole } from '../../config/roles'
import {
  userService,
  type RoleRow, type PermissionRow, type RolePermissionRow,
} from '../../services/userService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleLabelOf(r: RoleRow): string {
  const n = normalizeRole(r.key)
  return n ? ROLE_LABELS[n] : r.label || r.key
}

/** Canonical module display order; unknown modules sort after, alphabetically. */
const MODULE_ORDER = [
  'dashboard', 'clients', 'projects', 'videos', 'calendar', 'assets', 'tasks',
  'bookings', 'packages', 'ai', 'analytics', 'finance', 'subscriptions',
  'invoices', 'users', 'settings', 'audit', 'portal',
]

function moduleRank(module: string): number {
  const i = MODULE_ORDER.indexOf(module.toLowerCase())
  return i === -1 ? MODULE_ORDER.length : i
}

function moduleTitle(module: string): string {
  if (module.toLowerCase() === 'ai') return 'AI'
  return module.charAt(0).toUpperCase() + module.slice(1)
}

const key2 = (roleKey: string, permKey: string) => `${roleKey}::${permKey}`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { role: authRole } = useAuth()
  const isSuperAdmin = authRole === ROLES.SUPER_ADMIN

  const [roles, setRoles] = useState<RoleRow[]>([])
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, p, rp] = await Promise.all([
        userService.listRoles(),
        userService.listPermissions(),
        userService.listRolePermissions(),
      ])
      setRoles(r)
      setPermissions(p)
      setGranted(new Set(rp.map((row: RolePermissionRow) => key2(row.role_key, row.permission_key))))
      setSelectedKey((prev) => prev ?? r[0]?.key ?? null)
    } catch (err) {
      console.error('[RolesPage] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load roles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selected = useMemo(
    () => roles.find((r) => r.key === selectedKey) ?? null,
    [roles, selectedKey]
  )
  const selectedIsSuperAdmin = !!selected && normalizeRole(selected.key) === ROLES.SUPER_ADMIN

  // Super Admins may edit any role except super_admin itself (always full access).
  const canEdit = isSuperAdmin && !selectedIsSuperAdmin

  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>()
    for (const p of permissions) {
      const list = map.get(p.module) ?? []
      list.push(p)
      map.set(p.module, list)
    }
    return Array.from(map.entries()).sort((a, b) => {
      const d = moduleRank(a[0]) - moduleRank(b[0])
      return d !== 0 ? d : a[0].localeCompare(b[0])
    })
  }, [permissions])

  const toggle = async (perm: PermissionRow) => {
    if (!selected || !canEdit || savingKey) return
    const k = key2(selected.key, perm.key)
    const nextGranted = !granted.has(k)

    // Optimistic update; revert on failure (RLS refuses non-super-admins anyway).
    setSaveError(null)
    setSavingKey(k)
    setGranted((prev) => {
      const next = new Set(prev)
      if (nextGranted) next.add(k)
      else next.delete(k)
      return next
    })
    try {
      await userService.setRolePermission(selected.key, perm.key, nextGranted)
    } catch (err) {
      setGranted((prev) => {
        const next = new Set(prev)
        if (nextGranted) next.delete(k)
        else next.add(k)
        return next
      })
      setSaveError(err instanceof Error ? err.message : 'The change was refused.')
    } finally {
      setSavingKey(null)
    }
  }

  if (error) {
    return <PageErrorState title="We couldn't load roles" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Roles & Permissions"
        subtitle="What each role can see and do. The database enforces these rules server-side."
      />

      {!isSuperAdmin && !loading && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-xs text-slate-300 flex items-center gap-2"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          Only a Super Admin can modify role permissions. You are viewing in read-only mode.
        </div>
      )}

      {saveError && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-xs text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {saveError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel><FinanceSkeleton rows={8} /></Panel>
          <Panel className="lg:col-span-2"><FinanceSkeleton rows={8} /></Panel>
        </div>
      ) : roles.length === 0 ? (
        <Panel>
          <EmptyState
            icon="🛡️"
            title="No roles found."
            description="The roles catalogue is empty — run the roles & permissions migration."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* ── Role list ── */}
          <Panel title="Roles">
            <div className="space-y-1 -mx-2">
              {roles.map((r) => {
                const active = r.key === selectedKey
                return (
                  <button
                    key={r.key}
                    onClick={() => { setSelectedKey(r.key); setSaveError(null) }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/[0.03]'
                    }`}
                    style={active ? { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.3)' } : { border: '1px solid transparent' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{roleLabelOf(r)}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">L{r.level}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.is_system && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-400" title="System role — part of the core setup">
                          <ShieldCheck className="w-3 h-3" /> System role
                        </span>
                      )}
                      {!r.is_internal && (
                        <span className="text-[10px] text-slate-500">External</span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* ── Permission checklist ── */}
          <Panel
            className="lg:col-span-2"
            title={selected ? `Permissions — ${roleLabelOf(selected)}` : 'Permissions'}
          >
            {!selected ? (
              <EmptyState icon="🛡️" title="Select a role" description="Pick a role on the left to see its permissions." />
            ) : permissions.length === 0 ? (
              <EmptyState
                icon="🔑"
                title="No permissions found."
                description="The permissions catalogue is empty — run the roles & permissions migration."
              />
            ) : (
              <>
                {selectedIsSuperAdmin && (
                  <div
                    className="mb-4 px-4 py-3 rounded-xl text-xs text-slate-300 flex items-center gap-2"
                    style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Super Admin always has every permission. This cannot be changed.
                  </div>
                )}

                <div className="space-y-5">
                  {groups.map(([module, perms]) => (
                    <div key={module}>
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                        {moduleTitle(module)}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((p) => {
                          const checked = selectedIsSuperAdmin || granted.has(key2(selected.key, p.key))
                          const disabled = !canEdit || savingKey !== null
                          return (
                            <label
                              key={p.key}
                              className={`flex items-start gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                                disabled ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-white/[0.03]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="accent-blue-500 mt-0.5"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggle(p)}
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-sm text-white truncate">{p.key}</span>
                                  {p.is_sensitive && (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                                      title="Sensitive permission"
                                    />
                                  )}
                                </span>
                                {p.description && (
                                  <span className="block text-[11px] text-slate-500 truncate">{p.description}</span>
                                )}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
