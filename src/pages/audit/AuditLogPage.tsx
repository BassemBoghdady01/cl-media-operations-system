/**
 * EZ Marketing Agency — Audit Log viewer
 *
 * Read-only view over audit_logs (written by database triggers and the admin
 * API). RLS restricts it to holders of audit.view; nobody can edit entries.
 */
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, FinanceSkeleton, EmptyState, DataTable,
} from '../../components/finance/FinanceKit'
import { auditService, type AuditLogRow, type AuditFilters } from '../../services/auditService'

const PAGE_SIZE = 50

const ACTION_STYLES: Record<string, { color: string; bg: string }> = {
  INSERT: { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  UPDATE: { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  DELETE: { color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
}

function actionStyle(action: string) {
  return ACTION_STYLES[action] ?? { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' }
}

const short = (v: unknown, max = 120): string => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  if (s === undefined || s === null) return 'null'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** Compact change view: only the keys that actually differ. */
function Diff({ row }: { row: AuditLogRow }) {
  const oldV = row.old_value ?? {}
  const newV = row.new_value ?? {}

  if (row.action === 'UPDATE') {
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]))
      .filter((k) => JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]))
      .filter((k) => !['updated_at', 'created_at'].includes(k))
    if (!keys.length) return <p className="text-[11px] text-slate-500">No field-level changes recorded.</p>
    return (
      <div className="space-y-1">
        {keys.map((k) => (
          <div key={k} className="text-[11px] font-mono flex flex-wrap gap-1.5">
            <span className="text-slate-400">{k}:</span>
            <span className="text-red-400/80 line-through">{short(oldV[k])}</span>
            <span className="text-slate-600">→</span>
            <span className="text-green-400">{short(newV[k])}</span>
          </div>
        ))}
      </div>
    )
  }

  const payload = row.action === 'DELETE' ? oldV : newV
  return (
    <pre className="text-[11px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-56 overflow-y-auto rounded-lg p-3"
      style={{ background: 'rgba(255,255,255,0.03)' }}>
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

export default function AuditLogPage() {
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const [actorEmail, setActorEmail] = useState('')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async (pageIndex: number) => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const filters: AuditFilters = {
        actorEmail: actorEmail || undefined,
        entityType: entityType || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      }
      const [res, types] = await Promise.all([
        auditService.list(agencyId, filters),
        entityTypes.length ? Promise.resolve(entityTypes) : auditService.listEntityTypes(agencyId),
      ])
      setRows(res.rows)
      setTotal(res.total)
      setEntityTypes(types)
      setPage(pageIndex)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, actorEmail, entityType, action, from, to])

  useEffect(() => { load(0) }, [agencyId]) // initial load only; filters apply on demand
  // eslint-disable-next-line react-hooks/exhaustive-deps

  if (error) {
    return <PageErrorState title="We couldn't load the audit log" message={error} onRetry={() => load(page)} />
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <FinancePageHeader
        title="Audit Log"
        subtitle="Every sensitive change — financial records, payroll, periods, users — recorded by the database itself."
      />

      <Panel className="mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <input className="input text-xs py-2" placeholder="User email…"
            value={actorEmail} onChange={(e) => setActorEmail(e.target.value)} />
          <select className="input text-xs py-2" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All modules</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input text-xs py-2" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            <option value="INSERT">Created</option>
            <option value="UPDATE">Updated</option>
            <option value="DELETE">Deleted</option>
            <option value="admin.user_created">Admin: user created</option>
            <option value="admin.role_changed">Admin: role changed</option>
            <option value="admin.user_deactivated">Admin: user deactivated</option>
            <option value="admin.user_reactivated">Admin: user reactivated</option>
          </select>
          <input className="input text-xs py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input text-xs py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-primary text-xs py-2 justify-center" onClick={() => load(0)}>Apply filters</button>
        </div>
      </Panel>

      {loading ? (
        <FinanceSkeleton rows={8} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState icon="📜" title="No audit entries match these filters"
            description="Entries are written automatically when financial or user records change." />
        </Panel>
      ) : (
        <Panel title={`${total.toLocaleString()} entries`}>
          <DataTable minWidth={880} columns={[
            { key: 'x', label: '' },
            { key: 'time', label: 'Time' },
            { key: 'user', label: 'User' },
            { key: 'action', label: 'Action' },
            { key: 'module', label: 'Module' },
            { key: 'entity', label: 'Entity' },
          ]}>
            {rows.map((r) => {
              const st = actionStyle(r.action)
              const isOpen = expanded === r.id
              return (
                <>
                  <tr key={r.id}
                    className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <td className="py-2.5 w-6 text-slate-500">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </td>
                    <td className="py-2.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-xs text-white">{r.actor_email ?? 'system'}</td>
                    <td className="py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}33` }}>
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">{r.entity_type.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 text-[11px] text-slate-600 font-mono">
                      {r.entity_id ? `${r.entity_id.slice(0, 8)}…` : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.id}-detail`} className="border-b border-white/5">
                      <td colSpan={6} className="py-3 px-2">
                        <Diff row={r} />
                        {r.ip_address && (
                          <p className="text-[10px] text-slate-600 mt-2">IP: {r.ip_address}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </DataTable>

          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[11px] text-slate-500">Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs py-1.5 px-3" disabled={page === 0}
                onClick={() => load(page - 1)}>← Prev</button>
              <button className="btn-secondary text-xs py-1.5 px-3" disabled={page + 1 >= pages}
                onClick={() => load(page + 1)}>Next →</button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}
