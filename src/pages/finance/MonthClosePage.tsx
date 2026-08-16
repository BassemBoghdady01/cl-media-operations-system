/**
 * EZ Marketing Agency — Monthly Close
 *
 * Closing a month makes its ledger immutable for everyone without
 * finance.close_period (enforced by the finance_transaction_guard trigger).
 * Reopening requires a reason; both operations are audit-logged by database
 * triggers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Lock, Unlock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, FinanceSkeleton, StatusBadge, EmptyState,
} from '../../components/finance/FinanceKit'
import { isoDate, financeService, type FinancialPeriod } from '../../services/financeService'
import { payrollService, type PayrollRun } from '../../services/payrollService'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface Checklist {
  payroll: { ok: boolean; label: string; link: string } | null
  drafts: { count: number; link: string }
  approvals: { count: number; link: string }
  unclassified: { count: number; link: string }
}

export default function MonthClosePage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canClose = hasPermission('finance.close_period')
  const canPayroll = hasPermission('finance.view_payroll')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periods, setPeriods] = useState<FinancialPeriod[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reopening, setReopening] = useState<FinancialPeriod | null>(null)
  const [reopenReason, setReopenReason] = useState('')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [p, r] = await Promise.all([
        financeService.listPeriods(agencyId),
        canPayroll ? payrollService.listRuns(agencyId) : Promise.resolve([] as PayrollRun[]),
      ])
      setPeriods(p)
      setRuns(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load accounting periods.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, canPayroll])

  useEffect(() => { load() }, [load])

  // Display list = stored periods + the current month if it has no row yet.
  const displayPeriods: FinancialPeriod[] = useMemo(() => {
    const list = [...periods]
    if (!list.some((p) => p.year === currentYear && p.month === currentMonth)) {
      list.unshift({
        id: 'virtual-current',
        agency_id: agencyId,
        year: currentYear,
        month: currentMonth,
        status: 'open',
        closed_by: null, closed_at: null, reopened_by: null, reopened_at: null, notes: null,
      })
    }
    return list.sort((a, b) => b.year - a.year || b.month - a.month)
  }, [periods, agencyId, currentYear, currentMonth])

  const runChecklist = useCallback(async (year: number, month: number) => {
    setSelected({ year, month })
    setChecklist(null)
    setChecking(true)
    setActionError(null)
    const from = isoDate(new Date(year, month - 1, 1))
    const to = isoDate(new Date(year, month, 0))
    try {
      const [drafts, approvals, all] = await Promise.all([
        financeService.listTransactions(agencyId, { status: 'draft', from, to, limit: 200 }),
        financeService.listPendingApprovals(agencyId),
        financeService.listTransactions(agencyId, { from, to, limit: 500 }),
      ])
      const monthApprovals = approvals.filter((a) => a.transaction_date >= from && a.transaction_date <= to)
      const unclassified = all.rows.filter((t) => !t.category_id && t.type !== 'transfer')
      const run = runs.find((r) => r.year === year && r.month === month)
      setChecklist({
        payroll: canPayroll
          ? {
              ok: !!run && (run.status === 'paid' || run.status === 'approved'),
              label: run
                ? `Payroll run is ${run.status.replace('_', ' ')}`
                : 'No payroll run exists for this month',
              link: '/app/finance/payroll',
            }
          : null,
        drafts: { count: drafts.total, link: '/app/finance/expenses' },
        approvals: { count: monthApprovals.length, link: '/app/finance/approvals' },
        unclassified: { count: unclassified.length, link: '/app/finance/expenses' },
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not run the pre-close checks.')
    } finally {
      setChecking(false)
    }
  }, [agencyId, runs, canPayroll])

  const closeMonth = async (year: number, month: number) => {
    if (!user) return
    if (!window.confirm(
      `Close ${MONTHS[month - 1]} ${year}? Creating and editing transactions in this month will be blocked for everyone without the close-period permission.`
    )) return
    setBusy(true)
    setActionError(null)
    try {
      await financeService.setPeriodStatus(agencyId, year, month, 'closed', user.id)
      setSelected(null)
      setChecklist(null)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not close the month.')
    } finally {
      setBusy(false)
    }
  }

  const reopenMonth = async () => {
    if (!user || !reopening || !reopenReason.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      await financeService.setPeriodStatus(
        agencyId, reopening.year, reopening.month, 'open', user.id, reopenReason.trim()
      )
      setReopening(null)
      setReopenReason('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reopen the month.')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <PageErrorState title="We couldn't load accounting periods" message={error} onRetry={load} />
  }

  const CheckLine = ({ ok, text, count, link }: { ok: boolean; text: string; count?: number; link: string }) => (
    <div className="flex items-center gap-3 py-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      )}
      <span className={`text-xs flex-1 ${ok ? 'text-slate-400' : 'text-white'}`}>
        {text}{count !== undefined && count > 0 ? ` (${count})` : ''}
      </span>
      {!ok && <Link to={link} className="text-[11px] text-blue-400 hover:text-blue-300">Review →</Link>}
    </div>
  )

  return (
    <div>
      <FinancePageHeader
        title="Monthly Close"
        subtitle="Lock finished months so their numbers can never drift. Every close and reopen is audit-logged."
      >
        <Link to="/app/finance/reports" className="btn-secondary text-xs py-2 px-4">← Reports</Link>
      </FinancePageHeader>

      {actionError && (
        <div className="mb-4 rounded-xl p-3 text-xs text-red-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <FinanceSkeleton rows={6} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <Panel title="Accounting periods">
            {displayPeriods.length === 0 ? (
              <EmptyState icon="🗓️" title="No periods yet"
                description="Periods appear as soon as financial activity is recorded." />
            ) : (
              <div className="space-y-2">
                {displayPeriods.map((p) => (
                  <div key={`${p.year}-${p.month}`}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      selected?.year === p.year && selected?.month === p.month ? 'bg-blue-500/[0.08]' : 'bg-white/[0.02]'
                    }`}>
                    {p.status === 'closed'
                      ? <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      : <Unlock className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white">{MONTHS[p.month - 1]} {p.year}</span>
                      {p.status === 'closed' && p.closed_at && (
                        <span className="text-[10px] text-slate-600 block">
                          Closed {new Date(p.closed_at).toLocaleDateString()}
                        </span>
                      )}
                      {p.notes && (
                        <span className="text-[10px] text-amber-400/80 block truncate">Reopen note: {p.notes}</span>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                    {canClose && p.status === 'open' && (
                      <button className="btn-secondary text-[11px] py-1 px-2.5"
                        onClick={() => runChecklist(p.year, p.month)}>
                        Pre-close checks
                      </button>
                    )}
                    {canClose && p.status === 'closed' && (
                      <button
                        className="text-[11px] font-semibold py-1 px-2.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
                        style={{ border: '1px solid rgba(251,191,36,0.3)' }}
                        onClick={() => { setReopening(p); setReopenReason('') }}>
                        Reopen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!canClose && (
              <p className="text-[11px] text-slate-500 mt-4">
                Closing months requires the <span className="text-slate-300">finance.close_period</span> permission.
              </p>
            )}
          </Panel>

          <Panel title={selected ? `Close ${MONTHS[selected.month - 1]} ${selected.year}` : 'Pre-close checklist'}>
            {!selected ? (
              <EmptyState icon="🔍" title="Pick a month"
                description="Run the pre-close checks on an open month to see what still needs attention." />
            ) : checking ? (
              <FinanceSkeleton rows={4} />
            ) : checklist ? (
              <div>
                <div className="divide-y divide-white/5">
                  {checklist.payroll ? (
                    <CheckLine ok={checklist.payroll.ok} text={checklist.payroll.label} link={checklist.payroll.link} />
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <Lock className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <span className="text-xs text-slate-500">Payroll status is not visible to your role</span>
                    </div>
                  )}
                  <CheckLine ok={checklist.drafts.count === 0}
                    text={checklist.drafts.count === 0 ? 'No outstanding draft transactions' : 'Draft transactions still open'}
                    count={checklist.drafts.count} link={checklist.drafts.link} />
                  <CheckLine ok={checklist.approvals.count === 0}
                    text={checklist.approvals.count === 0 ? 'No pending expense approvals' : 'Expense approvals pending'}
                    count={checklist.approvals.count} link={checklist.approvals.link} />
                  <CheckLine ok={checklist.unclassified.count === 0}
                    text={checklist.unclassified.count === 0 ? 'All transactions are categorised' : 'Uncategorised transactions'}
                    count={checklist.unclassified.count} link={checklist.unclassified.link} />
                </div>

                <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn-primary text-xs py-2.5 px-5 w-full justify-center"
                    disabled={busy}
                    onClick={() => closeMonth(selected.year, selected.month)}>
                    <Lock className="w-3.5 h-3.5" />
                    Close {MONTHS[selected.month - 1]} {selected.year}
                  </button>
                  <p className="text-[10px] text-slate-600 mt-2 text-center">
                    Warnings don't block closing — but a clean checklist means cleaner books.
                  </p>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      )}

      {/* Reopen modal */}
      {reopening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setReopening(null)}>
          <div className="glass-blue rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-1">
              Reopen {MONTHS[reopening.month - 1]} {reopening.year}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Reopening makes this month editable again. The action and your reason are recorded in the audit log.
            </p>
            <label className="text-[11px] text-slate-400 block mb-1.5">Reason (required)</label>
            <textarea
              className="input w-full text-xs mb-4"
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Why does this month need to be reopened?"
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setReopening(null)}>Cancel</button>
              <button className="btn-primary text-xs py-2 px-4"
                disabled={!reopenReason.trim() || busy}
                onClick={reopenMonth}>
                Reopen month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
