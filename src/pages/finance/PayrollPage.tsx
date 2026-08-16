/**
 * EZ Marketing Agency — Payroll
 *
 * Three tabs: employee compensation, the current month's payroll run, and run
 * history. The route sits behind PermissionGuard('finance.view_payroll'); every
 * mutating control here is additionally gated on finance.manage_payroll.
 * Real Supabase data only — a failed load shows an honest error state.
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, X, RefreshCw, Send, Undo2, CheckCircle2, Banknote } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, STATUS_STYLES, SUPPORTED_CURRENCIES } from '../../lib/finance'
import {
  payrollService,
  type EmployeeCompensation, type PayrollRun, type PayrollItem,
} from '../../services/payrollService'
import { userService, type ManagedUser } from '../../services/userService'
import { financeService, type FinanceAccount } from '../../services/financeService'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'employees' | 'current' | 'history'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'employees', label: 'Employees' },
  { key: 'current', label: 'Current payroll' },
  { key: 'history', label: 'History' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EMPLOYMENT_TYPES: { value: EmployeeCompensation['employment_type']; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'intern', label: 'Intern' },
]

const employmentLabel = (v: string) =>
  EMPLOYMENT_TYPES.find((t) => t.value === v)?.label ?? v.replace('_', ' ')

const monthLabel = (year: number, month: number) => `${MONTHS[month - 1] ?? month} ${year}`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('finance.manage_payroll')

  const now = new Date()
  const [tab, setTab] = useState<TabKey>('current')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [comp, setComp] = useState<EmployeeCompensation[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [items, setItems] = useState<PayrollItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [itemsReloadKey, setItemsReloadKey] = useState(0)

  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [compModal, setCompModal] = useState<{ open: boolean; existing: EmployeeCompensation | null }>({
    open: false, existing: null,
  })
  const [payModal, setPayModal] = useState(false)

  // ── Initial load: compensation + runs ──
  useEffect(() => {
    if (!agencyId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [c, r] = await Promise.all([
          payrollService.listCompensation(agencyId),
          payrollService.listRuns(agencyId),
        ])
        if (cancelled) return
        setComp(c)
        setRuns(r)
      } catch (err) {
        if (cancelled) return
        console.error('[PayrollPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load payroll data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const run = useMemo(
    () => runs.find((r) => r.year === year && r.month === month),
    [runs, year, month]
  )
  const runId = run?.id ?? null

  // ── Items for the selected run ──
  useEffect(() => {
    if (!runId) { setItems([]); setItemsError(null); return }
    let cancelled = false
    setItemsLoading(true)
    setItemsError(null)
    payrollService.listItems(runId)
      .then((its) => { if (!cancelled) setItems(its) })
      .catch((err) => {
        if (cancelled) return
        console.error('[PayrollPage] items load failed', err)
        setItemsError(err instanceof Error ? err.message : 'Could not load payroll items.')
      })
      .finally(() => { if (!cancelled) setItemsLoading(false) })
    return () => { cancelled = true }
  }, [runId, itemsReloadKey])

  // ── Silent refreshers (no full-page skeleton) ──
  const refreshComp = async () => setComp(await payrollService.listCompensation(agencyId))

  const refreshRunAndItems = async () => {
    const rs = await payrollService.listRuns(agencyId)
    setRuns(rs)
    const r = rs.find((x) => x.year === year && x.month === month)
    setItems(r ? await payrollService.listItems(r.id) : [])
  }

  const runAction = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      console.error(`[PayrollPage] ${name} failed`, err)
      setActionError(err instanceof Error ? err.message : 'The action could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  const handleBuild = () =>
    runAction('build', async () => {
      await payrollService.buildRun(agencyId, year, month)
      await refreshRunAndItems()
    })

  const handleSetStatus = (name: string, status: PayrollRun['status']) =>
    runAction(name, async () => {
      if (!runId) return
      await payrollService.setRunStatus(runId, status, user?.id)
      await refreshRunAndItems()
    })

  const handleItemSave = async (
    itemId: string,
    field: 'bonus' | 'allowances' | 'deductions',
    value: number
  ) => {
    setActionError(null)
    try {
      await payrollService.updateItem(itemId, { [field]: value })
      await refreshRunAndItems()
    } catch (err) {
      console.error('[PayrollPage] item update failed', err)
      setActionError(err instanceof Error ? err.message : 'Could not save the change.')
    }
  }

  // ── Derived ──
  const activeComp = useMemo(() => comp.filter((c) => c.status === 'active'), [comp])

  const netByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.currency, (m.get(it.currency) ?? 0) + it.net_salary)
    return Array.from(m.entries())
  }, [items])

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const ys = new Set<number>([current - 1, current, current + 1])
    runs.forEach((r) => ys.add(r.year))
    return Array.from(ys).sort((a, b) => b - a)
  }, [runs])

  const editable = canManage && (run?.status === 'draft' || run?.status === 'pending_approval')

  if (error) {
    return (
      <PageErrorState
        title="We couldn't load payroll"
        message={error}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    )
  }

  return (
    <div>
      <FinancePageHeader
        title="Payroll"
        subtitle="Compensation, monthly payroll runs and salary payments."
      >
        <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={tab === t.key ? { background: 'rgba(59,130,246,0.20)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FinancePageHeader>

      {actionError && (
        <div
          className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400 flex items-start justify-between gap-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <span>{actionError}</span>
          <button className="text-red-400 hover:text-red-300 flex-shrink-0" onClick={() => setActionError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={4} />
          <Panel><FinanceSkeleton rows={6} /></Panel>
        </div>
      ) : tab === 'employees' ? (
        /* ── Tab 1: Employees / compensation ── */
        <Panel
          title={`Compensation records (${comp.length})`}
          action={canManage ? (
            <button className="btn-primary py-2 px-3 text-xs" onClick={() => setCompModal({ open: true, existing: null })}>
              <Plus className="w-3.5 h-3.5" /> Add compensation
            </button>
          ) : undefined}
        >
          {comp.length === 0 ? (
            <EmptyState
              icon="🧑‍💼"
              title="No compensation records yet"
              description="Add your team's salaries to run payroll."
              action={canManage ? (
                <button className="btn-primary py-2 px-4 text-xs" onClick={() => setCompModal({ open: true, existing: null })}>
                  <Plus className="w-3.5 h-3.5" /> Add compensation
                </button>
              ) : undefined}
            />
          ) : (
            <DataTable
              minWidth={860}
              columns={[
                { key: 'employee', label: 'Employee' },
                { key: 'base', label: 'Base salary', align: 'right' },
                { key: 'currency', label: 'Currency' },
                { key: 'day', label: 'Payment day' },
                { key: 'allow', label: 'Default allowance', align: 'right' },
                { key: 'deduct', label: 'Default deduction', align: 'right' },
                { key: 'type', label: 'Type' },
                { key: 'status', label: 'Status', align: 'right' },
                ...(canManage ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
              ]}
            >
              {comp.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3">
                    <p className="text-sm text-white font-medium">{c.employee_name || c.employee_email || '—'}</p>
                    <p className="text-[11px] text-slate-500">{c.employee_email}</p>
                  </td>
                  <td className="py-3 text-right"><Money amount={c.base_salary} currency={c.currency} /></td>
                  <td className="py-3 text-xs text-slate-400">{c.currency}</td>
                  <td className="py-3 text-xs text-slate-400">Day {c.payment_day}</td>
                  <td className="py-3 text-right text-xs text-slate-400">{formatMoney(c.allowances_default, c.currency)}</td>
                  <td className="py-3 text-right text-xs text-slate-400">{formatMoney(c.deductions_default, c.currency)}</td>
                  <td className="py-3 text-xs text-slate-400">{employmentLabel(c.employment_type)}</td>
                  <td className="py-3 text-right"><StatusBadge status={c.status === 'ended' ? 'closed' : c.status} /></td>
                  {canManage && (
                    <td className="py-3 text-right">
                      <button
                        className="text-slate-500 hover:text-white p-1"
                        title="Edit compensation"
                        onClick={() => setCompModal({ open: true, existing: c })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      ) : tab === 'current' ? (
        /* ── Tab 2: Current payroll run ── */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input py-2 text-sm max-w-[150px]"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="input py-2 text-sm max-w-[110px]"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            {run && canManage && (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                {run.status === 'draft' && (
                  <>
                    <button
                      className="btn-secondary py-2 px-3 text-xs"
                      disabled={busy !== null}
                      onClick={handleBuild}
                      title="Only adds employees missing from this run — existing rows and your edits are never overwritten."
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {busy === 'build' ? 'Refreshing…' : 'Refresh from compensation'}
                    </button>
                    <button
                      className="btn-primary py-2 px-3 text-xs"
                      disabled={busy !== null}
                      onClick={() => handleSetStatus('submit', 'pending_approval')}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {busy === 'submit' ? 'Submitting…' : 'Submit for review'}
                    </button>
                  </>
                )}
                {run.status === 'pending_approval' && (
                  <>
                    <button
                      className="btn-secondary py-2 px-3 text-xs"
                      disabled={busy !== null}
                      onClick={() => handleSetStatus('back', 'draft')}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      {busy === 'back' ? 'Reverting…' : 'Back to draft'}
                    </button>
                    <button
                      className="btn-primary py-2 px-3 text-xs"
                      disabled={busy !== null}
                      onClick={() => handleSetStatus('approve', 'approved')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {busy === 'approve' ? 'Approving…' : 'Approve payroll'}
                    </button>
                  </>
                )}
                {run.status === 'approved' && (
                  <button
                    className="btn-primary py-2 px-3 text-xs"
                    disabled={busy !== null}
                    onClick={() => setPayModal(true)}
                  >
                    <Banknote className="w-3.5 h-3.5" /> Mark as paid
                  </button>
                )}
              </div>
            )}
            {run?.status === 'paid' && (
              <span className="text-xs text-green-400 sm:ml-auto">
                Paid on {formatDateShort(run.paid_at)}
              </span>
            )}
          </div>

          {run?.status === 'draft' && canManage && (
            <p className="text-[11px] text-slate-500 -mt-3">
              "Refresh from compensation" only adds people missing from this run — it never overwrites your edits.
            </p>
          )}

          {!run ? (
            <Panel>
              <EmptyState
                icon="💸"
                title={`No payroll run for ${monthLabel(year, month)}`}
                description={
                  activeComp.length === 0
                    ? 'There are no active compensation records. Add your team’s salaries in the Employees tab first.'
                    : 'Build the run from active compensation records — you can review and adjust every line before anything is approved or paid.'
                }
                action={
                  canManage && activeComp.length > 0 ? (
                    <button className="btn-primary py-2 px-4 text-xs" disabled={busy !== null} onClick={handleBuild}>
                      <Plus className="w-3.5 h-3.5" />
                      {busy === 'build' ? 'Building…' : `Run payroll for ${monthLabel(year, month)}`}
                    </button>
                  ) : canManage ? (
                    <button className="btn-secondary py-2 px-4 text-xs" onClick={() => setTab('employees')}>
                      Go to Employees
                    </button>
                  ) : undefined
                }
              />
            </Panel>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {netByCurrency.length > 1 ? (
                  netByCurrency.map(([cur, total]) => (
                    <KpiCard key={cur} label={`Net pay (${cur})`} value={formatMoney(total, cur)} color="#10B981" emphasis />
                  ))
                ) : (
                  <KpiCard
                    label="Total net pay"
                    value={formatMoney(run.total_amount, run.currency)}
                    sub={monthLabel(run.year, run.month)}
                    color="#10B981"
                    emphasis
                  />
                )}
                <KpiCard
                  label="Headcount"
                  value={String(run.headcount || items.length)}
                  sub="Employees in this run"
                  color="#3B82F6"
                />
                <KpiCard
                  label="Status"
                  value={STATUS_STYLES[run.status]?.label ?? run.status}
                  sub={
                    run.status === 'approved' && run.approved_at
                      ? `Approved ${formatDateShort(run.approved_at)}`
                      : run.status === 'paid' && run.paid_at
                        ? `Paid ${formatDateShort(run.paid_at)}`
                        : undefined
                  }
                  color={STATUS_STYLES[run.status]?.color ?? '#94A3B8'}
                />
                <KpiCard
                  label="Paid / unpaid"
                  value={`${items.filter((i) => i.status === 'paid').length} / ${items.length}`}
                  sub={`${items.filter((i) => i.status !== 'paid').length} not yet paid`}
                  color="#F59E0B"
                />
              </div>

              {/* Items table */}
              <Panel title={`Salary lines — ${monthLabel(run.year, run.month)}`}>
                {itemsError ? (
                  <div
                    className="px-3 py-2.5 rounded-xl text-xs text-red-400 flex items-center justify-between gap-3"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <span>{itemsError}</span>
                    <button className="btn-secondary py-1 px-2.5 text-[11px]" onClick={() => setItemsReloadKey((k) => k + 1)}>
                      Retry
                    </button>
                  </div>
                ) : itemsLoading && items.length === 0 ? (
                  <FinanceSkeleton rows={5} />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon="🧾"
                    title="This run has no salary lines"
                    description="No active compensation records were found when the run was built. Add compensation, then refresh the run."
                  />
                ) : (
                  <>
                    {editable && (
                      <p className="text-[11px] text-slate-500 mb-3">
                        Bonus, allowance and deduction are editable while the run is in draft or review — changes save when you leave the field.
                      </p>
                    )}
                    <DataTable
                      minWidth={820}
                      columns={[
                        { key: 'employee', label: 'Employee' },
                        { key: 'base', label: 'Base', align: 'right' },
                        { key: 'bonus', label: 'Bonus', align: 'right' },
                        { key: 'allowance', label: 'Allowance', align: 'right' },
                        { key: 'deduction', label: 'Deduction', align: 'right' },
                        { key: 'net', label: 'Net', align: 'right' },
                        { key: 'status', label: 'Status', align: 'right' },
                      ]}
                    >
                      {items.map((it) => (
                        <tr key={it.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                          <td className="py-3">
                            <p className="text-sm text-white font-medium">{it.employee_name || it.employee_email || '—'}</p>
                            <p className="text-[11px] text-slate-500">{it.employee_email}</p>
                          </td>
                          <td className="py-3 text-right text-xs text-slate-300 whitespace-nowrap">
                            {formatMoney(it.base_salary, it.currency)}
                          </td>
                          <td className="py-3 text-right">
                            {editable ? (
                              <InlineNumber value={it.bonus} onCommit={(v) => handleItemSave(it.id, 'bonus', v)} />
                            ) : (
                              <span className="text-xs text-slate-300 whitespace-nowrap">{formatMoney(it.bonus, it.currency)}</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {editable ? (
                              <InlineNumber value={it.allowances} onCommit={(v) => handleItemSave(it.id, 'allowances', v)} />
                            ) : (
                              <span className="text-xs text-slate-300 whitespace-nowrap">{formatMoney(it.allowances, it.currency)}</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {editable ? (
                              <InlineNumber value={it.deductions} onCommit={(v) => handleItemSave(it.id, 'deductions', v)} />
                            ) : (
                              <span className="text-xs text-slate-300 whitespace-nowrap">{formatMoney(it.deductions, it.currency)}</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-black text-white whitespace-nowrap">
                              {formatMoney(it.net_salary, it.currency)}
                            </span>
                          </td>
                          <td className="py-3 text-right"><StatusBadge status={it.status} /></td>
                        </tr>
                      ))}
                    </DataTable>
                  </>
                )}
              </Panel>
            </>
          )}
        </div>
      ) : (
        /* ── Tab 3: History ── */
        <Panel title="Payroll history">
          {runs.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No payroll runs yet"
              description="Every run you build appears here with its approval and payment record."
            />
          ) : (
            <DataTable
              minWidth={720}
              columns={[
                { key: 'period', label: 'Period' },
                { key: 'headcount', label: 'Headcount' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'status', label: 'Status', align: 'right' },
                { key: 'approved', label: 'Approved at', align: 'right' },
                { key: 'paid', label: 'Paid at', align: 'right' },
              ]}
            >
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.04] cursor-pointer"
                  onClick={() => { setYear(r.year); setMonth(r.month); setTab('current') }}
                  title="Open this run"
                >
                  <td className="py-3 text-sm text-white font-medium">{monthLabel(r.year, r.month)}</td>
                  <td className="py-3 text-xs text-slate-400">{r.headcount}</td>
                  <td className="py-3 text-right"><Money amount={r.total_amount} currency={r.currency} /></td>
                  <td className="py-3 text-right"><StatusBadge status={r.status} /></td>
                  <td className="py-3 text-right text-xs text-slate-400 whitespace-nowrap">{formatDateShort(r.approved_at)}</td>
                  <td className="py-3 text-right text-xs text-slate-400 whitespace-nowrap">{formatDateShort(r.paid_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      {/* ── Modals ── */}
      {compModal.open && canManage && (
        <CompensationModal
          agencyId={agencyId}
          userId={user?.id ?? ''}
          existing={compModal.existing}
          takenUserIds={comp.map((c) => c.user_id)}
          onClose={() => setCompModal({ open: false, existing: null })}
          onSaved={async () => {
            setCompModal({ open: false, existing: null })
            try {
              await refreshComp()
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Saved, but the list could not be refreshed.')
            }
          }}
        />
      )}

      {payModal && run && canManage && (
        <MarkPaidModal
          agencyId={agencyId}
          run={run}
          onClose={() => setPayModal(false)}
          onPaid={async () => {
            setPayModal(false)
            try {
              await refreshRunAndItems()
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Paid, but the page could not be refreshed.')
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Inline-editable amount cell ──────────────────────────────────────────────

function InlineNumber({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const commit = () => {
    const n = Number(text)
    if (!Number.isFinite(n) || n < 0) { setText(String(value)); return }
    if (n === value) return
    onCommit(n)
  }

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className="input py-1 px-2 text-xs text-right w-24 inline-block"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') { setText(String(value)); (e.target as HTMLInputElement).blur() }
      }}
    />
  )
}

// ─── Compensation modal ───────────────────────────────────────────────────────

function CompensationModal({
  agencyId, userId, existing, takenUserIds, onClose, onSaved,
}: {
  agencyId: string
  userId: string
  existing: EmployeeCompensation | null
  takenUserIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(!existing)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [f, setF] = useState({
    user_id: existing?.user_id ?? '',
    base_salary: existing ? String(existing.base_salary) : '',
    currency: existing?.currency ?? 'EGP',
    employment_type: (existing?.employment_type ?? 'full_time') as EmployeeCompensation['employment_type'],
    payment_day: existing ? String(existing.payment_day) : '28',
    allowances_default: existing ? String(existing.allowances_default) : '0',
    deductions_default: existing ? String(existing.deductions_default) : '0',
    effective_from: existing?.effective_from?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: (existing?.status ?? 'active') as 'active' | 'ended',
    notes: existing?.notes ?? '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  // Employee picker — only needed when creating a new record.
  useEffect(() => {
    if (existing) return
    let cancelled = false
    setUsersLoading(true)
    userService.listUsers(agencyId)
      .then((us) => {
        if (cancelled) return
        setUsers(us.filter((u) => u.role !== 'client' && !takenUserIds.includes(u.id)))
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[PayrollPage] listUsers failed', e)
        setErr(e instanceof Error ? e.message : 'Could not load the employee list.')
      })
      .finally(() => { if (!cancelled) setUsersLoading(false) })
    return () => { cancelled = true }
    // takenUserIds is stable for the life of the modal — the parent list only
    // refreshes after this modal closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, existing])

  const submit = async () => {
    if (!f.user_id) return setErr('Please choose an employee.')
    const salary = Number(f.base_salary)
    if (!Number.isFinite(salary) || salary <= 0) return setErr('Enter a base salary greater than zero.')
    const day = Number(f.payment_day)
    if (!Number.isInteger(day) || day < 1 || day > 31) return setErr('Payment day must be between 1 and 31.')
    const allowances = Number(f.allowances_default || 0)
    const deductions = Number(f.deductions_default || 0)
    if (!Number.isFinite(allowances) || allowances < 0) return setErr('Default allowance cannot be negative.')
    if (!Number.isFinite(deductions) || deductions < 0) return setErr('Default deduction cannot be negative.')
    if (!f.effective_from) return setErr('Please set the effective-from date.')

    setSaving(true)
    setErr('')
    try {
      await payrollService.upsertCompensation({
        id: existing?.id,
        agency_id: agencyId,
        user_id: f.user_id,
        base_salary: salary,
        currency: f.currency,
        employment_type: f.employment_type,
        payment_day: day,
        allowances_default: allowances,
        deductions_default: deductions,
        effective_from: f.effective_from,
        status: f.status,
        notes: f.notes.trim() || null,
        created_by: userId || undefined,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="glass-blue rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">
            {existing ? 'Edit compensation' : 'Add compensation'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {err && (
          <div
            className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {err}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Employee *">
            {existing ? (
              <input
                className="input py-2 text-sm opacity-60"
                value={`${existing.employee_name || existing.employee_email}${existing.employee_role ? ` — ${existing.employee_role.replace('_', ' ')}` : ''}`}
                disabled
              />
            ) : (
              <select
                className="input py-2 text-sm"
                value={f.user_id}
                onChange={(e) => set('user_id', e.target.value)}
                disabled={usersLoading}
              >
                <option value="">{usersLoading ? 'Loading team…' : 'Choose an employee'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} — {u.role.replace('_', ' ')}
                  </option>
                ))}
              </select>
            )}
            {!existing && !usersLoading && users.length === 0 && !err && (
              <p className="text-[11px] text-slate-500 mt-1">
                Everyone on the team already has a compensation record.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Base salary *">
              <input
                className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.base_salary} onChange={(e) => set('base_salary', e.target.value)} placeholder="0.00"
              />
            </Field>
            <Field label="Currency">
              <select className="input py-2 text-sm" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Employment type">
              <select
                className="input py-2 text-sm"
                value={f.employment_type}
                onChange={(e) => setF((p) => ({ ...p, employment_type: e.target.value as EmployeeCompensation['employment_type'] }))}
              >
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Payment day (1–31)">
              <input
                className="input py-2 text-sm" type="number" min="1" max="31" step="1"
                value={f.payment_day} onChange={(e) => set('payment_day', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Default allowances">
              <input
                className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.allowances_default} onChange={(e) => set('allowances_default', e.target.value)}
              />
            </Field>
            <Field label="Default deductions">
              <input
                className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.deductions_default} onChange={(e) => set('deductions_default', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective from">
              <input
                className="input py-2 text-sm" type="date"
                value={f.effective_from} onChange={(e) => set('effective_from', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className="input py-2 text-sm"
                value={f.status}
                onChange={(e) => setF((p) => ({ ...p, status: e.target.value as 'active' | 'ended' }))}
              >
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="input py-2 text-sm resize-none h-16"
              value={f.notes} onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mark-as-paid modal ───────────────────────────────────────────────────────

function MarkPaidModal({
  agencyId, run, onClose, onPaid,
}: {
  agencyId: string
  run: PayrollRun
  onClose: () => void
  onPaid: () => void
}) {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsFailed, setAccountsFailed] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    financeService.listAccounts(agencyId)
      .then((accs) => { if (!cancelled) setAccounts(accs) })
      .catch((e) => {
        // The account is optional — a failed lookup must not block payment.
        if (cancelled) return
        console.error('[PayrollPage] listAccounts failed', e)
        setAccountsFailed(true)
      })
      .finally(() => { if (!cancelled) setAccountsLoading(false) })
    return () => { cancelled = true }
  }, [agencyId])

  const confirm = async () => {
    setSaving(true)
    setErr('')
    try {
      await payrollService.markRunPaid(run.id, accountId || undefined)
      onPaid()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not mark the payroll as paid.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="glass-blue rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Mark payroll as paid</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-400 mb-1">
          {monthLabel(run.year, run.month)} · {run.headcount} employee{run.headcount === 1 ? '' : 's'} ·{' '}
          <span className="text-white font-semibold">{formatMoney(run.total_amount, run.currency)}</span>
        </p>
        <p className="text-xs text-slate-500 mb-4">
          Posts one salary expense per employee to the ledger. Already-posted items are never duplicated.
        </p>

        {err && (
          <div
            className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {err}
          </div>
        )}

        <Field label="Payment account (optional)">
          <select
            className="input py-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={accountsLoading}
          >
            <option value="">{accountsLoading ? 'Loading accounts…' : 'No specific account'}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
          {accountsFailed && (
            <p className="text-[11px] text-amber-400 mt-1">
              Accounts could not be loaded — you can still pay without selecting one.
            </p>
          )}
        </Field>

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={confirm} disabled={saving}>
            {saving ? 'Paying…' : 'Confirm payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
