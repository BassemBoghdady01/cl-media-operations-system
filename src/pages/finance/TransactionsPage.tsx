/**
 * EZ Marketing Agency — Revenue / Expenses ledger
 *
 * One component serves both, parameterised by transaction type. Real Supabase
 * queries only; a failure surfaces an error state rather than fake rows.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Download, Search, X, Paperclip } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import AttachmentField from '../../components/finance/AttachmentField'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  PeriodSelector, EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, toCsv, downloadCsv, SUPPORTED_CURRENCIES } from '../../lib/finance'
import { clientService } from '../../services/clientService'
import {
  financeService, resolvePeriod,
  type PeriodKey, type FinanceTransaction, type FinanceCategory,
  type FinanceAccount, type AgencyService, type TransactionType,
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

export default function TransactionsPage({ type }: Props) {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const copy = COPY[type]

  const [period, setPeriod] = useState<PeriodKey>('this_month')
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

  const range = useMemo(() => resolvePeriod(period), [period])
  const canManage = hasPermission('finance.manage')

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [tx, cats, accs, svcs, cls] = await Promise.all([
        financeService.listTransactions(agencyId, {
          type, from: range.from, to: range.to,
          status: (statusFilter || undefined) as never,
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
  }, [agencyId, type, range.from, range.to, statusFilter, search, copy.title])

  useEffect(() => { load() }, [load])

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
      `ez-${type}-${range.from}-to-${range.to}`,
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

  return (
    <div>
      <FinancePageHeader title={copy.title} subtitle={copy.subtitle}>
        <PeriodSelector value={period} onChange={setPeriod} />
        {hasPermission('finance.export') && rows.length > 0 && (
          <button className="btn-secondary py-2 px-3 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
        {canManage && (
          <button className="btn-primary py-2 px-3 text-xs" onClick={() => setShowForm(true)}>
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

            {rows.length === 0 ? (
              <EmptyState icon={type === 'income' ? '💰' : '🧾'}
                title={copy.emptyTitle} description={copy.emptyDesc}
                action={canManage ? (
                  <button className="btn-primary py-2 px-4 text-xs" onClick={() => setShowForm(true)}>
                    <Plus className="w-3.5 h-3.5" /> {copy.addLabel}
                  </button>
                ) : undefined}
              />
            ) : (
              <DataTable columns={[
                { key: 'date', label: 'Date' },
                { key: 'title', label: 'Title' },
                { key: 'party', label: type === 'income' ? 'Client' : 'Vendor' },
                { key: 'due', label: 'Due' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'paid', label: 'Settled', align: 'right' },
                { key: 'status', label: 'Status', align: 'right' },
              ]}>
                {rows.map((r) => {
                  const client = clients.find((c) => c.id === r.client_id)
                  return (
                    <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(r.transaction_date)}</td>
                      <td className="py-3 text-white text-sm">
                        {r.title}
                        {r.attachment_url && <AttachmentLinkButton refValue={r.attachment_url} />}
                      </td>
                      <td className="py-3 text-slate-400 text-xs">{client?.name ?? r.vendor ?? '—'}</td>
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(r.due_date)}</td>
                      <td className="py-3 text-right"><Money amount={Number(r.amount)} currency={r.currency} /></td>
                      <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.amount_paid), r.currency)}</td>
                      <td className="py-3 text-right"><StatusBadge status={r.status} /></td>
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
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function TransactionForm({
  type, agencyId, userId, categories, accounts, services, clients, onClose, onSaved,
}: {
  type: 'income' | 'expense'
  agencyId: string
  userId: string
  categories: FinanceCategory[]
  accounts: FinanceAccount[]
  services: AgencyService[]
  clients: Client[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [f, setF] = useState({
    title: '', amount: '', currency: 'EGP', transaction_date: new Date().toISOString().slice(0, 10),
    due_date: '', client_id: '', service_id: '', category_id: '', account_id: '',
    vendor: '', payment_method: '', status: 'expected', amount_paid: '', description: '',
  })

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!f.title.trim()) return setErr('Please enter a title.')
    const amount = Number(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter an amount greater than zero.')
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
      setErr(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">
            {type === 'income' ? 'Add income' : 'Add expense'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount *">
              <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Currency">
              <select className="input py-2 text-sm" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input className="input py-2 text-sm" type="date"
              value={f.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} /></Field>
            <Field label="Due date"><input className="input py-2 text-sm" type="date"
              value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {type === 'income' ? (
            <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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
            {saving ? 'Saving…' : 'Save'}
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
