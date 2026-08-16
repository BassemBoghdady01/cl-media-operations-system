/**
 * EZ Marketing Agency — Subscription detail
 *
 * One subscription: its billing cycles, lifecycle actions and an activity
 * timeline. Every timeline entry is derived from stored rows — events whose
 * exact timestamp is not recorded say so instead of inventing one.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Pause, Pencil, Play, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  Panel, FinanceSkeleton, EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort } from '../../lib/finance'
import { clientService } from '../../services/clientService'
import { financeService, isoDate, type FinanceAccount, type AgencyService } from '../../services/financeService'
import {
  subscriptionService,
  type ClientSubscription, type SubscriptionCycle, type PaymentReminder,
  type SubscriptionStatus,
} from '../../services/subscriptionService'
import { SubscriptionFormModal, frequencyLabel, REMINDER_TYPE_LABELS } from './SubscriptionsPage'
import type { Client } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "August 2026" from an ISO period_start — parsed locally to avoid TZ shifts. */
function periodLabel(iso: string): string {
  if (!iso) return '—'
  const [y, m] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m) return '—'
  return new Date(y, m - 1, 1).toLocaleDateString('en-EG', { month: 'long', year: 'numeric' })
}

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'wallet', 'online', 'other'] as const

const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  wallet: 'Wallet',
  online: 'Online',
  other: 'Other',
}

interface TimelineEvent {
  key: string
  /** Sort anchor — always present. */
  sortTs: string
  /** Displayed timestamp — null when the exact moment is not stored. */
  when: string | null
  title: string
  detail?: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const subscriptionId = id ?? ''
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('subscriptions.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [sub, setSub] = useState<ClientSubscription | null>(null)
  const [cycles, setCycles] = useState<SubscriptionCycle[]>([])
  const [reminders, setReminders] = useState<PaymentReminder[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<AgencyService[]>([])

  const [showEdit, setShowEdit] = useState(false)
  const [payCycle, setPayCycle] = useState<SubscriptionCycle | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [cycleErr, setCycleErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agencyId || !subscriptionId) return
    setLoading(true)
    setError(null)
    try {
      const [s, cy, rem, accs, cls, svcs] = await Promise.all([
        subscriptionService.getById(subscriptionId),
        subscriptionService.listCycles(subscriptionId),
        subscriptionService.listReminders(agencyId, { subscriptionId }),
        financeService.listAccounts(agencyId),
        clientService.getAll(agencyId),
        financeService.listServices(agencyId),
      ])
      setSub(s ?? null)
      setNotFound(!s)
      setCycles(cy); setReminders(rem); setAccounts(accs); setClients(cls); setServices(svcs)
    } catch (err) {
      console.error('[SubscriptionDetail] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load this subscription.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, subscriptionId])

  useEffect(() => { load() }, [load])

  const changeStatus = async (status: SubscriptionStatus, confirmMsg?: string) => {
    if (!sub) return
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(`status-${status}`)
    setActionErr(null)
    try {
      await subscriptionService.setStatus(sub.id, status)
      await load()
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Could not update the subscription status.')
    } finally {
      setBusy(null)
    }
  }

  const runCycleAction = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setCycleErr(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setCycleErr(err instanceof Error ? err.message : 'The action failed.')
    } finally {
      setBusy(null)
    }
  }

  // Timeline derived strictly from stored rows.
  const events = useMemo<TimelineEvent[]>(() => {
    if (!sub) return []
    const ev: TimelineEvent[] = [{
      key: 'created', sortTs: sub.created_at, when: sub.created_at, title: 'Subscription created',
    }]
    for (const c of cycles) {
      const label = periodLabel(c.period_start)
      if (c.amount_paid > 0) {
        ev.push({
          key: `pay-${c.id}`, sortTs: c.created_at, when: null,
          title: 'Payment received',
          detail: `${formatMoney(c.amount_paid, c.currency)} of ${formatMoney(c.amount, c.currency)} — ${label}`,
        })
      }
      if (c.invoice_id) {
        ev.push({
          key: `inv-${c.id}`, sortTs: c.created_at, when: null,
          title: 'Invoice created',
          detail: `${label} — ${formatMoney(c.amount, c.currency)}`,
        })
      }
      ev.push({
        key: `cycle-${c.id}`, sortTs: c.created_at, when: c.created_at,
        title: 'Billing cycle generated',
        detail: `${label} — due ${formatDateShort(c.due_date)}`,
      })
    }
    for (const r of reminders) {
      if (r.status !== 'sent') continue
      ev.push({
        key: `rem-${r.id}`, sortTs: r.sent_at ?? r.scheduled_for, when: r.sent_at,
        title: 'Reminder sent',
        detail: `${REMINDER_TYPE_LABELS[r.type]} — ${r.channel === 'in_app' ? 'in-app notification' : r.channel}`,
      })
    }
    ev.sort((a, b) => (a.sortTs < b.sortTs ? 1 : a.sortTs > b.sortTs ? -1 : 0))
    return ev
  }, [sub, cycles, reminders])

  if (error) {
    return <PageErrorState title="We couldn't load this subscription" message={error} onRetry={load} />
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        <Panel><FinanceSkeleton rows={4} /></Panel>
        <Panel><FinanceSkeleton rows={5} /></Panel>
      </div>
    )
  }

  if (notFound || !sub) {
    return (
      <div>
        <BackLink />
        <Panel>
          <EmptyState
            icon="🔎"
            title="Subscription not found"
            description="It may have been removed, or your account may not have access to it."
          />
        </Panel>
      </div>
    )
  }

  const todayIso = isoDate(new Date())

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <BackLink />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white">{sub.name}</h1>
              <StatusBadge status={sub.status} />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {sub.client_name || 'Unknown client'}
              {' · '}{formatMoney(sub.amount, sub.currency)} / {frequencyLabel(sub).toLowerCase()}
              {' · '}Next billing {formatDateShort(sub.next_billing_date)}
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary py-2 px-3 text-xs" onClick={() => setShowEdit(true)} disabled={busy !== null}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {sub.status === 'active' && (
                <button className="btn-secondary py-2 px-3 text-xs" disabled={busy !== null}
                  onClick={() => changeStatus('paused')}>
                  <Pause className="w-3.5 h-3.5" /> {busy === 'status-paused' ? 'Pausing…' : 'Pause'}
                </button>
              )}
              {sub.status === 'paused' && (
                <button className="btn-secondary py-2 px-3 text-xs" disabled={busy !== null}
                  onClick={() => changeStatus('active')}>
                  <Play className="w-3.5 h-3.5" /> {busy === 'status-active' ? 'Resuming…' : 'Resume'}
                </button>
              )}
              {sub.status !== 'cancelled' && sub.status !== 'expired' && (
                <button
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium text-red-400 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                  disabled={busy !== null}
                  onClick={() => changeStatus('cancelled', 'Cancel this subscription? Future billing cycles will no longer be generated.')}
                >
                  <Ban className="w-3.5 h-3.5" /> {busy === 'status-cancelled' ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
          )}
        </div>

        {actionErr && (
          <div className="mt-3 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {actionErr}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Details ── */}
        <Panel title="Details">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-5">
            <InfoItem label="Amount" value={`${formatMoney(sub.amount, sub.currency)} / ${frequencyLabel(sub).toLowerCase()}`} />
            <InfoItem label="Next billing" value={formatDateShort(sub.next_billing_date)} />
            <InfoItem label="Start date" value={formatDateShort(sub.start_date)} />
            <InfoItem label="End date" value={sub.end_date ? formatDateShort(sub.end_date) : '—'} />
            <InfoItem label="Service" value={sub.service_name ?? '—'} />
            <InfoItem label="Billing day" value={sub.billing_day ? `Day ${sub.billing_day}` : '—'} />
            <InfoItem label="Grace period" value={`${sub.grace_period_days} day${sub.grace_period_days === 1 ? '' : 's'}`} />
            <InfoItem label="Auto-renew" value={sub.auto_renew ? 'Yes' : 'No'} />
            <InfoItem label="Reminders" value={
              sub.reminder_days_before.length
                ? `${sub.reminder_days_before.join(', ')} days before`
                : '—'
            } />
            {sub.description && (
              <div className="col-span-2 md:col-span-3 lg:col-span-4">
                <InfoItem label="Notes" value={sub.description} />
              </div>
            )}
          </div>
        </Panel>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Billing cycles ── */}
          <Panel
            className="lg:col-span-2"
            title="Billing cycles"
            action={canManage ? (
              <button className="btn-secondary py-1.5 px-3 text-xs" disabled={busy !== null}
                onClick={() => runCycleAction('generate', () => subscriptionService.generateNextCycle(sub.id))}>
                <RefreshCw className="w-3.5 h-3.5" /> {busy === 'generate' ? 'Generating…' : 'Generate next cycle'}
              </button>
            ) : undefined}
          >
            {cycleErr && (
              <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {cycleErr}
              </div>
            )}

            {cycles.length === 0 ? (
              <EmptyState
                icon="📆"
                title="No billing cycles yet"
                description={canManage
                  ? 'Generate the first cycle to start billing this subscription.'
                  : 'Billing cycles will appear here once they are generated.'}
              />
            ) : (
              <DataTable minWidth={640} columns={[
                { key: 'period', label: 'Period' },
                { key: 'due', label: 'Due date' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'paid', label: 'Paid', align: 'right' },
                { key: 'status', label: 'Status', align: 'right' },
                { key: 'actions', label: '', align: 'right' },
              ]}>
                {cycles.map((c) => {
                  const remaining = Number(c.amount) - Number(c.amount_paid)
                  const canPay = canManage && remaining > 0 &&
                    c.status !== 'cancelled' && c.status !== 'written_off' && c.status !== 'paid'
                  const canOverdue = canManage && remaining > 0 && c.due_date < todayIso &&
                    (c.status === 'expected' || c.status === 'invoiced' || c.status === 'partially_paid')
                  return (
                    <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="py-3 text-white text-sm whitespace-nowrap">{periodLabel(c.period_start)}</td>
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(c.due_date)}</td>
                      <td className="py-3 text-right whitespace-nowrap"><Money amount={Number(c.amount)} currency={c.currency} /></td>
                      <td className="py-3 text-right text-xs text-slate-400 whitespace-nowrap">
                        {formatMoney(Number(c.amount_paid), c.currency)}
                      </td>
                      <td className="py-3 text-right"><StatusBadge status={c.status} /></td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canPay && (
                            <button className="btn-secondary py-1 px-2 text-[11px]" disabled={busy !== null}
                              onClick={() => setPayCycle(c)}>
                              Mark paid
                            </button>
                          )}
                          {canOverdue && (
                            <button className="btn-secondary py-1 px-2 text-[11px]" disabled={busy !== null}
                              onClick={() => runCycleAction(`overdue-${c.id}`, () => subscriptionService.markCycleOverdue(c.id))}>
                              {busy === `overdue-${c.id}` ? '…' : 'Mark overdue'}
                            </button>
                          )}
                          {c.invoice_id ? (
                            <span className="text-[11px] text-slate-500">Invoiced</span>
                          ) : canManage ? (
                            <button className="btn-secondary py-1 px-2 text-[11px]" disabled={busy !== null}
                              onClick={() => runCycleAction(`invoice-${c.id}`, () => subscriptionService.createInvoiceForCycle(c, sub.name))}>
                              {busy === `invoice-${c.id}` ? '…' : 'Create invoice'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </DataTable>
            )}
          </Panel>

          {/* ── Timeline ── */}
          <Panel title="Activity timeline">
            {events.length <= 1 ? (
              <EmptyState
                icon="🕘"
                title="No activity yet"
                description={`Created ${formatDateShort(sub.created_at)}. Cycle generation, invoices, payments and sent reminders will appear here as they happen.`}
              />
            ) : (
              <ol className="relative ml-1.5 border-l border-white/10 space-y-5 py-1 max-h-[480px] overflow-y-auto no-scrollbar">
                {events.map((e) => (
                  <li key={e.key} className="relative pl-5">
                    <span
                      className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full"
                      style={{ background: '#3B82F6', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' }}
                    />
                    <p className="text-xs font-semibold text-white">{e.title}</p>
                    {e.detail && <p className="text-[11px] text-slate-400 mt-0.5">{e.detail}</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {e.when ? formatDateShort(e.when) : 'Exact date not tracked'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      {showEdit && (
        <SubscriptionFormModal
          agencyId={agencyId}
          userId={user?.id ?? ''}
          clients={clients}
          services={services}
          initial={sub}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}

      {payCycle && (
        <MarkPaidModal
          cycle={payCycle}
          accounts={accounts}
          onClose={() => setPayCycle(null)}
          onSaved={() => { setPayCycle(null); load() }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/app/finance/subscriptions"
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-3"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> Subscriptions
    </Link>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-white break-words">{value}</p>
    </div>
  )
}

function MarkPaidModal({
  cycle, accounts, onClose, onSaved,
}: {
  cycle: SubscriptionCycle
  accounts: FinanceAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const remaining = Number(cycle.amount) - Number(cycle.amount_paid)
  const [amount, setAmount] = useState(String(remaining))
  const [accountId, setAccountId] = useState('')
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('bank_transfer')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter a payment amount greater than zero.')
    if (amt > remaining) {
      return setErr(`Amount cannot exceed the remaining balance of ${formatMoney(remaining, cycle.currency)}.`)
    }
    setSaving(true); setErr('')
    try {
      await subscriptionService.markCyclePaid(cycle.id, amt, accountId || undefined, method)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not record the payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-white">Record payment</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {periodLabel(cycle.period_start)} · {formatMoney(remaining, cycle.currency)} remaining
          of {formatMoney(Number(cycle.amount), cycle.currency)}
        </p>

        {err && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {err}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Amount ({cycle.currency}) *</label>
            <input className="input py-2 text-sm" type="number" min="0" step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Account</label>
            <select className="input py-2 text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Payment method</label>
            <select className="input py-2 text-sm" value={method}
              onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
            </select>
          </div>
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
