/**
 * EZ Marketing Agency — Revenue / Expenses ledger
 *
 * One component serves both, parameterised by transaction type. Real Supabase
 * queries only; a failure surfaces an error state rather than fake rows.
 *
 * Deep links (query params):
 *   ?new=1            open the create form (with &client=<id> preselecting the client)
 *   ?client=<id>      only this client's rows
 *   ?uncategorised=1  only rows without a category (month-close review)
 *   ?outstanding=1    only rows that still have a balance to settle
 *   ?from=&to=        an explicit YYYY-MM-DD date range
 * Filter-only links show all dates unless from/to are given.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Download, Search, X, Paperclip, Banknote, Pencil, Archive } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { toastSuccess, toastError } from '../../lib/toast'
import PageErrorState from '../../components/system/PageErrorState'
import AttachmentField from '../../components/finance/AttachmentField'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  PeriodSelector, EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, toCsv, downloadCsv, SUPPORTED_CURRENCIES } from '../../lib/finance'
import { clientService } from '../../services/clientService'
import {
  financeService, resolvePeriod, isoDate,
  type PeriodKey, type FinanceTransaction, type FinanceCategory,
  type FinanceAccount, type AgencyService, type TransactionType, type TransactionStatus,
} from '../../services/financeService'
import type { Client } from '../../types'

interface Props {
  type: Extract<TransactionType, 'income' | 'expense'>
}

const COPY = {
  income: {
    title: 'Revenue',
    subtitle: 'Money coming in — one-time payments, retainers and project income.',
    addLabel: 'Add income',
    emptyTitle: 'No revenue recorded for this period.',
    emptyDesc: 'Record your first payment and it will appear here immediately.',
  },
  expense: {
    title: 'Expenses',
    subtitle: 'Money going out — production, software, freelancers and overhead.',
    addLabel: 'Add expense',
    emptyTitle: 'No expenses yet.',
    emptyDesc: 'Record a cost and it will appear here immediately.',
  },
} as const

/** A payment can be recorded once an item is live and not yet fully settled. */
const PAYABLE: TransactionStatus[] = ['expected', 'approved', 'partially_paid', 'overdue']
/** Cancelled / refunded rows are history — editing them would rewrite it. */
const LOCKED: TransactionStatus[] = ['cancelled', 'refunded']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Turns a date-only value into a timestamp at local noon (no off-by-one-day drift). */
const dateToTimestamp = (d: string) => new Date(`${d}T12:00:00`).toISOString()

export default function TransactionsPage({ type }: Props) {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const copy = COPY[type]
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-driven filters (the URL is the source of truth so links are shareable).
  const clientFilter = searchParams.get('new') === '1' ? '' : (searchParams.get('client') ?? '')
  const uncategorised = searchParams.get('uncategorised') === '1'
  const outstandingOnly = searchParams.get('outstanding') === '1'
  const urlFrom = searchParams.get('from') ?? ''
  const urlTo = searchParams.get('to') ?? ''
  const urlRange = ISO_DATE.test(urlFrom) && ISO_DATE.test(urlTo) ? { from: urlFrom, to: urlTo } : null
  const hasDeepFilter = !!clientFilter || uncategorised || outstandingOnly

  const [period, setPeriod] = useState<PeriodKey>('this_month')
  // Deep links ignore the period selector until the user picks a period.
  const [usePeriod, setUsePeriod] = useState(() => !urlRange && !hasDeepFilter)
  const [rows, setRows] = useState<FinanceTransaction[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [services, setServices] = useState<AgencyService[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [prefillClientId, setPrefillClientId] = useState('')
  const [editing, setEditing] = useState<FinanceTransaction | null>(null)
  const [paying, setPaying] = useState<FinanceTransaction | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  /** null = all dates. */
  const range = useMemo(() => {
    if (usePeriod) return resolvePeriod(period)
    return ISO_DATE.test(urlFrom) && ISO_DATE.test(urlTo) ? { from: urlFrom, to: urlTo } : null
  }, [usePeriod, period, urlFrom, urlTo])
  const canManage = hasPermission('finance.manage')

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [tx, cats, accs, svcs, cls] = await Promise.all([
        financeService.listTransactions(agencyId, {
          type,
          from: range?.from, to: range?.to,
          status: (statusFilter || undefined) as never,
          clientId: clientFilter || undefined,
          uncategorised: uncategorised || undefined,
          outstandingOnly: outstandingOnly || undefined,
          search: search || undefined, limit: 200,
        }),
        financeService.listCategories(agencyId, type),
        financeService.listAccounts(agencyId),
        financeService.listServices(agencyId),
        clientService.getAll(agencyId),
      ])
      setRows(tx.rows); setCategories(cats); setAccounts(accs)
      setServices(svcs); setClients(cls)
    } catch (err) {
      console.error(`[${copy.title}] load failed`, err)
      setError(err instanceof Error ? err.message : 'Could not load data.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, type, range?.from, range?.to, statusFilter, search, copy.title,
    clientFilter, uncategorised, outstandingOnly])

  useEffect(() => { load() }, [load])

  // ?new=1 opens the create form once the dropdown data has loaded, then the
  // params are stripped so closing the form doesn't reopen it.
  useEffect(() => {
    if (loading || searchParams.get('new') !== '1') return
    if (canManage) {
      setPrefillClientId(searchParams.get('client') ?? '')
      setShowForm(true)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('new'); next.delete('client')
    setSearchParams(next, { replace: true })
  }, [loading, searchParams, setSearchParams, canManage])

  const dropParams = (...keys: string[]) => {
    const next = new URLSearchParams(searchParams)
    keys.forEach((k) => next.delete(k))
    setSearchParams(next, { replace: true })
  }

  const choosePeriod = (p: PeriodKey) => {
    setPeriod(p)
    setUsePeriod(true)
    if (urlRange) dropParams('from', 'to')
  }

  const archive = async (r: FinanceTransaction) => {
    if (!window.confirm(
      `Archive "${r.title}"? It will be cancelled and removed from this list and from all totals. The audit trail keeps a record.`
    )) return
    setArchivingId(r.id)
    try {
      await financeService.archiveTransaction(r.id)
      toastSuccess(`"${r.title}" archived`)
      load()
    } catch (err) {
      console.error(`[${copy.title}] archive failed`, err)
      toastError(err instanceof Error ? err.message : 'Could not archive this item.')
    } finally {
      setArchivingId(null)
    }
  }

  // Totals grouped by currency — never summed across currencies.
  const totals = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; outstanding: number }>()
    for (const r of rows) {
      const e = map.get(r.currency) ?? { total: 0, paid: 0, outstanding: 0 }
      e.total += Number(r.amount)
      e.paid += Number(r.amount_paid)
      e.outstanding += Number(r.amount) - Number(r.amount_paid)
      map.set(r.currency, e)
    }
    return Array.from(map.entries())
  }, [rows])

  const handleExport = () => {
    downloadCsv(
      `ez-${type}-${range ? `${range.from}-to-${range.to}` : 'all-dates'}`,
      toCsv(rows.map((r) => ({
        date: r.transaction_date, title: r.title, amount: r.amount,
        paid: r.amount_paid, currency: r.currency, status: r.status,
        due_date: r.due_date ?? '', vendor: r.vendor ?? '', reference: r.reference ?? '',
      })))
    )
  }

  if (error) {
    return <PageErrorState title={`We couldn't load ${copy.title.toLowerCase()}`} message={error} onRetry={load} />
  }

  const filterClient = clients.find((c) => c.id === clientFilter)
  const chips: { key: string; label: string; onClear: () => void }[] = []
  if (clientFilter) chips.push({
    key: 'client', label: `Client: ${filterClient?.name ?? 'selected client'}`,
    onClear: () => dropParams('client'),
  })
  if (uncategorised) chips.push({ key: 'uncat', label: 'Uncategorised only', onClear: () => dropParams('uncategorised') })
  if (outstandingOnly) chips.push({ key: 'out', label: 'Outstanding only', onClear: () => dropParams('outstanding') })
  if (!usePeriod) chips.push({
    key: 'dates',
    label: range ? `${formatDateShort(range.from)} – ${formatDateShort(range.to)}` : 'All dates',
    onClear: () => choosePeriod(period),
  })

  const filtered = chips.length > 0
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'title', label: 'Title' },
    { key: 'party', label: type === 'income' ? 'Client' : 'Vendor' },
    { key: 'due', label: 'Due' },
    { key: 'amount', label: 'Amount', align: 'right' as const },
    { key: 'paid', label: 'Settled', align: 'right' as const },
    { key: 'status', label: 'Status', align: 'right' as const },
    ...(canManage ? [{ key: 'actions', label: 'Actions', align: 'right' as const }] : []),
  ]

  return (
    <div>
      <FinancePageHeader title={copy.title} subtitle={copy.subtitle}>
        <PeriodSelector value={usePeriod ? period : 'custom'} onChange={choosePeriod} />
        {hasPermission('finance.export') && rows.length > 0 && (
          <button className="btn-secondary py-2 px-3 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
        {canManage && (
          <button className="btn-primary py-2 px-3 text-xs"
            onClick={() => { setPrefillClientId(clientFilter); setShowForm(true) }}>
            <Plus className="w-3.5 h-3.5" /> {copy.addLabel}
          </button>
        )}
      </FinancePageHeader>

      {loading ? (
        <div className="space-y-4"><KpiSkeleton count={3} /><Panel><FinanceSkeleton rows={6} /></Panel></div>
      ) : (
        <div className="space-y-5">
          {totals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {totals.map(([cur, t]) => (
                <div key={cur} className="contents">
                  <KpiCard label={`Total (${cur})`} value={formatMoney(t.total, cur)}
                    color={type === 'income' ? '#10B981' : '#EF4444'} />
                  <KpiCard label={`Settled (${cur})`} value={formatMoney(t.paid, cur)} color="#3B82F6" />
                  <KpiCard label={`Outstanding (${cur})`} value={formatMoney(t.outstanding, cur)} color="#F59E0B" />
                </div>
              ))}
            </div>
          )}

          <Panel>
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input className="input pl-9 py-2 text-sm" placeholder="Search by title…"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="input py-2 text-sm max-w-[160px]" value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {['expected', 'pending', 'approved', 'paid', 'partially_paid', 'overdue', 'cancelled'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {chips.map((c) => (
                  <span key={c.key}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg text-[11px] font-semibold text-blue-300"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    {c.label}
                    <button onClick={c.onClear} aria-label={`Clear filter: ${c.label}`}
                      className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/10">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <EmptyState icon={type === 'income' ? '💰' : '🧾'}
                title={filtered ? 'Nothing matches these filters.' : copy.emptyTitle}
                description={filtered ? 'Clear a filter above to see more.' : copy.emptyDesc}
                action={canManage && !filtered ? (
                  <button className="btn-primary py-2 px-4 text-xs" onClick={() => setShowForm(true)}>
                    <Plus className="w-3.5 h-3.5" /> {copy.addLabel}
                  </button>
                ) : undefined}
              />
            ) : (
              <DataTable minWidth={canManage ? 900 : 720} columns={columns}>
                {rows.map((r) => {
                  const client = clients.find((c) => c.id === r.client_id)
                  const payable = PAYABLE.includes(r.status) && Number(r.amount_paid) < Number(r.amount)
                  const locked = LOCKED.includes(r.status)
                  return (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(r.transaction_date)}</td>
                      <td className="py-3 text-white text-sm">
                        {r.title}
                        {r.attachment_url && <AttachmentLinkButton refValue={r.attachment_url} />}
                        {!uncategorised && !r.category_id && (
                          <span className="block text-[10px] text-amber-400/80">Uncategorised</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-400 text-xs">{client?.name ?? r.vendor ?? '—'}</td>
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(r.due_date)}</td>
                      <td className="py-3 text-right"><Money amount={Number(r.amount)} currency={r.currency} /></td>
                      <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.amount_paid), r.currency)}</td>
                      <td className="py-3 text-right"><StatusBadge status={r.status} /></td>
                      {canManage && (
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {payable && (
                              <RowButton label="Record payment" tone="green" onClick={() => setPaying(r)}>
                                <Banknote className="w-3.5 h-3.5" />
                              </RowButton>
                            )}
                            <RowButton
                              label={locked ? `Can't edit a ${r.status} item` : 'Edit'}
                              disabled={locked} onClick={() => setEditing(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </RowButton>
                            <RowButton label="Archive" tone="red"
                              disabled={archivingId === r.id} onClick={() => archive(r)}>
                              <Archive className="w-3.5 h-3.5" />
                            </RowButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </DataTable>
            )}
          </Panel>
        </div>
      )}

      {showForm && (
        <TransactionForm
          type={type} agencyId={agencyId} userId={user?.id ?? ''}
          categories={categories} accounts={accounts} services={services} clients={clients}
          defaultClientId={prefillClientId}
          onClose={() => { setShowForm(false); setPrefillClientId('') }}
          onSaved={() => {
            setShowForm(false)
            setPrefillClientId('')
            toastSuccess(type === 'income' ? 'Income recorded' : 'Expense recorded')
            load()
          }}
        />
      )}

      {editing && (
        <TransactionForm
          type={type} agencyId={agencyId} userId={user?.id ?? ''}
          categories={categories} accounts={accounts} services={services} clients={clients}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toastSuccess('Changes saved')
            load()
          }}
        />
      )}

      {paying && (
        <RecordPaymentModal
          tx={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null)
            toastSuccess('Payment recorded')
            load()
          }}
        />
      )}
    </div>
  )
}

/** Compact, always-visible row action (works on touch — no hover-only reveal). */
function RowButton({
  label, onClick, disabled, tone = 'blue', children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'blue' | 'green' | 'red'
  children: React.ReactNode
}) {
  const toneCls =
    tone === 'green' ? 'text-green-400 hover:bg-green-500/10'
      : tone === 'red' ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
      : 'text-slate-400 hover:text-blue-300 hover:bg-blue-500/10'
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
      style={{ background: 'rgba(255,255,255,0.03)' }}>
      {children}
    </button>
  )
}

// ─── Record payment ───────────────────────────────────────────────────────────

function RecordPaymentModal({
  tx, onClose, onSaved,
}: {
  tx: FinanceTransaction
  onClose: () => void
  onSaved: () => void
}) {
  const total = Number(tx.amount)
  const settled = Number(tx.amount_paid)
  const remaining = Math.max(0, Math.round((total - settled) * 100) / 100)

  const [payment, setPayment] = useState(String(remaining))
  const [date, setDate] = useState(isoDate(new Date()))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const paymentNum = Number(payment)
  const newTotal = Math.round((settled + (Number.isFinite(paymentNum) ? paymentNum : 0)) * 100) / 100

  const submit = async () => {
    if (!Number.isFinite(paymentNum) || paymentNum <= 0) return setErr('Enter a payment greater than zero.')
    if (newTotal > total) return setErr(`That's more than the ${formatMoney(remaining, tx.currency)} still outstanding.`)
    if (!ISO_DATE.test(date)) return setErr('Choose the payment date.')
    setSaving(true); setErr('')
    try {
      // amount_paid is the cumulative settled total; the DB trigger derives status.
      await financeService.recordPayment(tx.id, newTotal, dateToTimestamp(date))
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not record the payment.'
      setErr(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-white">Record payment</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4 truncate">{tx.title}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total', value: formatMoney(total, tx.currency) },
            { label: 'Settled so far', value: formatMoney(settled, tx.currency) },
            { label: 'Outstanding', value: formatMoney(remaining, tx.currency) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[10px] text-slate-500 block">{k.label}</span>
              <span className="text-xs font-semibold text-white break-words">{k.value}</span>
            </div>
          ))}
        </div>

        {err && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {err}
          </div>
        )}

        <div className="space-y-3">
          <Field label={`Payment received now (${tx.currency})`}>
            <div className="flex gap-2">
              <input className="input py-2 text-sm flex-1" type="number" min="0" step="0.01" inputMode="decimal"
                value={payment} onChange={(e) => setPayment(e.target.value)} />
              <button type="button" className="btn-secondary py-2 px-3 text-xs whitespace-nowrap"
                onClick={() => setPayment(String(remaining))}>
                Full balance
              </button>
            </div>
          </Field>
          <Field label="Payment date">
            <input className="input py-2 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <p className="text-[11px] text-slate-500">
            New settled total: <span className="text-slate-300 font-semibold">{formatMoney(newTotal, tx.currency)}</span>
            {' '}of {formatMoney(total, tx.currency)}. Status updates automatically.
          </p>
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add / edit form ──────────────────────────────────────────────────────────

function TransactionForm({
  type, agencyId, userId, categories, accounts, services, clients, initial, defaultClientId,
  onClose, onSaved,
}: {
  type: 'income' | 'expense'
  agencyId: string
  userId: string
  categories: FinanceCategory[]
  accounts: FinanceAccount[]
  services: AgencyService[]
  clients: Client[]
  /** When provided the form edits this transaction instead of creating one. */
  initial?: FinanceTransaction
  /** Create mode only: preselect this client. */
  defaultClientId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const alreadySettled = initial ? Number(initial.amount_paid) : 0
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [attachment, setAttachment] = useState<string | null>(initial?.attachment_url ?? null)
  const [f, setF] = useState({
    title: initial?.title ?? '',
    amount: initial ? String(initial.amount) : '',
    currency: initial?.currency ?? 'EGP',
    transaction_date: initial?.transaction_date?.slice(0, 10) ?? isoDate(new Date()),
    due_date: initial?.due_date?.slice(0, 10) ?? '',
    client_id: initial
      ? (initial.client_id ?? '')
      : (defaultClientId && clients.some((c) => c.id === defaultClientId) ? defaultClientId : ''),
    service_id: initial?.service_id ?? '',
    category_id: initial?.category_id ?? '',
    account_id: initial?.account_id ?? '',
    vendor: initial?.vendor ?? '',
    payment_method: initial?.payment_method ?? '',
    status: 'expected', amount_paid: '',
    description: initial?.description ?? '',
  })

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!f.title.trim()) return setErr('Please enter a title.')
    const amount = Number(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter an amount greater than zero.')

    if (initial) {
      if (amount < alreadySettled) {
        return setErr(`The amount can't be less than what is already settled (${formatMoney(alreadySettled, initial.currency)}).`)
      }
      setSaving(true); setErr('')
      try {
        await financeService.updateTransaction(initial.id, {
          title: f.title.trim(),
          description: f.description || null,
          amount, currency: f.currency,
          transaction_date: f.transaction_date,
          due_date: f.due_date || null,
          client_id: type === 'income' ? (f.client_id || null) : initial.client_id,
          service_id: type === 'income' ? (f.service_id || null) : initial.service_id,
          vendor: type === 'expense' ? (f.vendor || null) : initial.vendor,
          category_id: f.category_id || null,
          account_id: f.account_id || null,
          attachment_url: attachment,
        })
        onSaved()
      } catch (e) {
        // Closed periods are enforced by a DB trigger — its message explains why.
        const msg = e instanceof Error ? e.message : 'Could not save.'
        setErr(msg)
        toastError(msg)
      } finally {
        setSaving(false)
      }
      return
    }

    const paid = f.amount_paid ? Number(f.amount_paid) : 0
    if (paid > amount) return setErr('Settled amount cannot exceed the total.')

    setSaving(true); setErr('')
    try {
      await financeService.createTransaction({
        agency_id: agencyId, type, title: f.title.trim(),
        description: f.description || null,
        amount, amount_paid: paid, currency: f.currency,
        transaction_date: f.transaction_date,
        due_date: f.due_date || null,
        client_id: f.client_id || null,
        service_id: f.service_id || null,
        category_id: f.category_id || null,
        account_id: f.account_id || null,
        vendor: f.vendor || null,
        payment_method: (f.payment_method || null) as never,
        status: f.status as never,
        attachment_url: attachment,
        created_by: userId || null,
      })
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save.'
      setErr(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">
            {isEdit
              ? (type === 'income' ? 'Edit income' : 'Edit expense')
              : (type === 'income' ? 'Add income' : 'Add expense')}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {err && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {err}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Title *">
            <input className="input py-2 text-sm" value={f.title} onChange={(e) => set('title', e.target.value)}
              placeholder={type === 'income' ? 'e.g. Social media retainer — March' : 'e.g. Software subscription'} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Amount *">
              <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Currency">
              <select className="input py-2 text-sm" value={f.currency}
                disabled={isEdit && alreadySettled > 0}
                title={isEdit && alreadySettled > 0 ? 'Currency is locked once a payment has been recorded.' : undefined}
                onChange={(e) => set('currency', e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date"><input className="input py-2 text-sm" type="date"
              value={f.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} /></Field>
            <Field label="Due date"><input className="input py-2 text-sm" type="date"
              value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
          </div>

          {isEdit ? (
            <p className="text-[11px] text-slate-500">
              Settled so far: <span className="text-slate-300 font-semibold">
                {formatMoney(alreadySettled, f.currency)}</span>. Use “Record payment” to add a payment —
              the status updates automatically.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Already settled">
                <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                  value={f.amount_paid} onChange={(e) => set('amount_paid', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Status">
                <select className="input py-2 text-sm" value={f.status} onChange={(e) => set('status', e.target.value)}>
                  {['expected', 'pending', 'approved', 'paid'].map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {type === 'income' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Client">
                <select className="input py-2 text-sm" value={f.client_id} onChange={(e) => set('client_id', e.target.value)}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Service">
                <select className="input py-2 text-sm" value={f.service_id} onChange={(e) => set('service_id', e.target.value)}>
                  <option value="">—</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <Field label="Vendor">
              <input className="input py-2 text-sm" value={f.vendor}
                onChange={(e) => set('vendor', e.target.value)} placeholder="Supplier name" />
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category">
              <select className="input py-2 text-sm" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Account">
              <select className="input py-2 text-sm" value={f.account_id} onChange={(e) => set('account_id', e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea className="input py-2 text-sm resize-none h-16" value={f.description}
              onChange={(e) => set('description', e.target.value)} />
          </Field>

          <Field label="Receipt / document">
            <AttachmentField agencyId={agencyId} entity="transactions"
              value={attachment} onChange={setAttachment} disabled={saving} />
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Row-level paperclip: resolves the signed URL on click, never eagerly. */
function AttachmentLinkButton({ refValue }: { refValue: string }) {
  const [opening, setOpening] = useState(false)

  const open = async () => {
    if (opening) return
    setOpening(true)
    try {
      const url = await financeService.attachmentUrl(refValue)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[Transactions] could not open attachment', err)
      toastError('Could not open the attachment — it may have been removed.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <button
      onClick={open}
      title="View receipt / document"
      className={`inline-flex align-middle ml-2 transition-colors ${
        opening ? 'text-blue-400 animate-pulse' : 'text-slate-500 hover:text-blue-400'
      }`}
    >
      <Paperclip className="w-3.5 h-3.5" />
    </button>
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
