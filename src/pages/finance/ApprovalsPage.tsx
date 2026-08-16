/**
 * EZ Marketing Agency — Expense Approvals
 *
 * Queue of draft/pending expenses. Approve/Reject go through the
 * permission-checked database RPCs (approve_expense / reject_expense), which
 * record approved_by / approved_at / rejection_reason and refuse
 * self-approval. Every decision lands in the audit log via triggers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  DataTable, StatusBadge, Money, EmptyState,
} from '../../components/finance/FinanceKit'
import { formatDateShort, formatMoney } from '../../lib/finance'
import {
  financeService,
  type FinanceTransaction, type FinanceCategory,
} from '../../services/financeService'

export default function ApprovalsPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canApprove = hasPermission('finance.approve_expenses')
  const canManage = hasPermission('finance.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<FinanceTransaction[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<FinanceTransaction | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [pending, cats] = await Promise.all([
        financeService.listPendingApprovals(agencyId),
        financeService.listCategories(agencyId, 'expense'),
      ])
      setRows(pending)
      setCategories(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the approval queue.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '—'

  const totals = useMemo(() => {
    const by = new Map<string, number>()
    for (const r of rows) by.set(r.currency, (by.get(r.currency) ?? 0) + Number(r.amount))
    return Array.from(by.entries())
  }, [rows])

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setActionError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const openAttachment = async (ref: string) => {
    try {
      const url = await financeService.attachmentUrl(ref)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open the attachment.')
    }
  }

  if (error) {
    return <PageErrorState title="We couldn't load the approval queue" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Expense Approvals"
        subtitle="Approval decisions are recorded with the approver and timestamp and appear in the audit log."
      />

      {actionError && (
        <div className="mb-4 rounded-xl p-3 text-xs text-red-400 flex items-start justify-between gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span>{actionError}</span>
          <button className="text-slate-500 hover:text-white" onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={3} />
          <FinanceSkeleton rows={5} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Awaiting decision" value={String(rows.length)} color="#FBBF24" emphasis />
            {totals.map(([currency, total]) => (
              <KpiCard key={currency} label={`Pending amount (${currency})`}
                value={formatMoney(total, currency)} color="#F59E0B" />
            ))}
          </div>

          <Panel title="Queue">
            {rows.length === 0 ? (
              <EmptyState icon="✅" title="Nothing waiting for approval"
                description="Draft and pending expenses appear here for review before they can be paid." />
            ) : (
              <DataTable minWidth={860} columns={[
                { key: 'date', label: 'Date' },
                { key: 'title', label: 'Expense' },
                { key: 'category', label: 'Category' },
                { key: 'vendor', label: 'Vendor' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'status', label: 'Status' },
                { key: 'actions', label: '', align: 'right' },
              ]}>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateShort(r.transaction_date)}</td>
                    <td className="py-3 pr-3">
                      <div className="text-xs font-medium text-white flex items-center gap-1.5">
                        {r.title}
                        {r.attachment_url && (
                          <button title="View receipt" onClick={() => openAttachment(r.attachment_url!)}
                            className="text-slate-500 hover:text-blue-400 transition-colors">
                            <Paperclip className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {r.description && <div className="text-[10px] text-slate-600 truncate max-w-[220px]">{r.description}</div>}
                    </td>
                    <td className="py-3 text-xs text-slate-400">{categoryName(r.category_id)}</td>
                    <td className="py-3 text-xs text-slate-400">{r.vendor ?? '—'}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.amount)} currency={r.currency} /></td>
                    <td className="py-3"><StatusBadge status={r.status} /></td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        {r.status === 'draft' && canManage && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => run(r.id, () => financeService.submitForApproval(r.id))}
                            className="btn-secondary text-[11px] py-1 px-2.5">
                            Submit
                          </button>
                        )}
                        {canApprove && (
                          <>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => {
                                if (window.confirm(`Approve "${r.title}" for ${formatMoney(Number(r.amount), r.currency)}?`)) {
                                  run(r.id, () => financeService.approveExpense(r.id))
                                }
                              }}
                              className="text-[11px] font-semibold py-1 px-2.5 rounded-lg text-green-400 transition-colors hover:bg-green-500/10"
                              style={{ border: '1px solid rgba(52,211,153,0.3)' }}>
                              Approve
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => { setRejecting(r); setRejectReason('') }}
                              className="text-[11px] font-semibold py-1 px-2.5 rounded-lg text-red-400 transition-colors hover:bg-red-500/10"
                              style={{ border: '1px solid rgba(248,113,113,0.3)' }}>
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>

          {!canApprove && (
            <p className="text-[11px] text-slate-500">
              You can view this queue but approval requires the <span className="text-slate-300">finance.approve_expenses</span> permission.
            </p>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setRejecting(null)}>
          <div className="glass-blue rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-1">Reject expense</h3>
            <p className="text-xs text-slate-400 mb-4">
              {rejecting.title} — {formatMoney(Number(rejecting.amount), rejecting.currency)}
            </p>
            <label className="text-[11px] text-slate-400 block mb-1.5">Reason (required)</label>
            <textarea
              className="input w-full text-xs mb-4"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this expense being rejected?"
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setRejecting(null)}>Cancel</button>
              <button
                className="btn-primary text-xs py-2 px-4"
                disabled={!rejectReason.trim() || busyId === rejecting.id}
                onClick={async () => {
                  const target = rejecting
                  await run(target.id, () => financeService.rejectExpense(target.id, rejectReason.trim()))
                  setRejecting(null)
                }}>
                Reject expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
