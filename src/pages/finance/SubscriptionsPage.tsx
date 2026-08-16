/**
 * EZ Marketing Agency — Client Subscriptions
 *
 * Recurring billing overview: per-currency KPIs, the subscription list and the
 * payment-reminder queue. Real Supabase rows only — a failed query surfaces an
 * error state, and reminder channels are reported exactly as configured (we
 * never imply an email/WhatsApp was sent when only in-app delivery exists).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, CalendarClock, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  CurrencyTabs, EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, SUPPORTED_CURRENCIES } from '../../lib/finance'
import { clientService } from '../../services/clientService'
import { financeService, isoDate, type MrrRow, type AgencyService } from '../../services/financeService'
import {
  subscriptionService,
  type ClientSubscription, type SubscriptionInput, type SubscriptionStats,
  type SubscriptionStatus, type BillingFrequency, type PaymentReminder,
} from '../../services/subscriptionService'
import type { Client } from '../../types'

// ─── Shared labels (also used by SubscriptionDetail) ─────────────────────────

export const FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
  custom: 'Custom',
}

/** "Monthly", or "Every 15 days" for custom intervals. */
export function frequencyLabel(
  sub: Pick<ClientSubscription, 'billing_frequency' | 'custom_interval_days'>
): string {
  if (sub.billing_frequency === 'custom') {
    return sub.custom_interval_days ? `Every ${sub.custom_interval_days} days` : 'Custom'
  }
  return FREQUENCY_LABELS[sub.billing_frequency]
}

export const REMINDER_TYPE_LABELS: Record<PaymentReminder['type'], string> = {
  upcoming: 'Upcoming',
  due_today: 'Due today',
  overdue: 'Overdue',
  final_notice: 'Final notice',
}

const STATUS_FILTERS: { value: SubscriptionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: 'draft', label: 'Draft' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const navigate = useNavigate()
  const canManage = hasPermission('subscriptions.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [subs, setSubs] = useState<ClientSubscription[]>([])
  const [stats, setStats] = useState<SubscriptionStats[]>([])
  const [mrr, setMrr] = useState<MrrRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<AgencyService[]>([])

  const [currency, setCurrency] = useState('EGP')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all')
  const [upcomingOnly, setUpcomingOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [list, st, m, cls, svcs] = await Promise.all([
        subscriptionService.list(agencyId),
        subscriptionService.getStats(agencyId),
        financeService.getMrr(agencyId),
        clientService.getAll(agencyId),
        financeService.listServices(agencyId),
      ])
      setSubs(list); setStats(st); setMrr(m); setClients(cls); setServices(svcs)
    } catch (err) {
      console.error('[Subscriptions] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load subscriptions.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  // Currencies actually present in the data — never a hardcoded list.
  const currencies = useMemo(() => {
    const set = new Set<string>([
      ...stats.map((s) => s.currency),
      ...mrr.map((m) => m.currency),
      ...subs.map((s) => s.currency),
    ])
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [stats, mrr, subs])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  const st = stats.find((s) => s.currency === currency)
  const m = mrr.find((r) => r.currency === currency)

  const filtered = useMemo(() => {
    const today = new Date()
    const todayIso = isoDate(today)
    const in7 = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7))
    const q = search.trim().toLowerCase()

    return subs.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (upcomingOnly && !(s.next_billing_date >= todayIso && s.next_billing_date <= in7)) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.client_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [subs, statusFilter, upcomingOnly, search])

  if (error) {
    return <PageErrorState title="We couldn't load your subscriptions" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Subscriptions"
        subtitle="Recurring client billing — plans, renewal cycles and payment reminders."
      >
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        {canManage && (
          <button className="btn-primary py-2 px-3 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New subscription
          </button>
        )}
      </FinancePageHeader>

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={4} />
          <Panel><FinanceSkeleton rows={6} /></Panel>
          <Panel><FinanceSkeleton rows={3} /></Panel>
        </div>
      ) : subs.length === 0 ? (
        <div className="space-y-5">
          <Panel>
            <EmptyState
              icon="🔁"
              title="No subscriptions yet"
              description="Create a subscription for a client and its billing cycles, renewals and reminders will be tracked here."
              action={canManage ? (
                <button className="btn-primary py-2 px-4 text-xs" onClick={() => setShowForm(true)}>
                  <Plus className="w-3.5 h-3.5" /> New subscription
                </button>
              ) : undefined}
            />
          </Panel>
          <RemindersPanel agencyId={agencyId} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── KPIs (per currency) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Active subscriptions" color="#10B981" emphasis
              value={String(st?.active_count ?? 0)}
              sub={`${currency} plans`}
            />
            <KpiCard
              label="Monthly recurring revenue" color="#8B5CF6"
              value={formatMoney(m?.mrr ?? 0, currency)}
              sub={m ? `${m.active_subscriptions} contributing` : 'No recurring revenue yet'}
            />
            <KpiCard
              label="Due this month" color="#38BDF8"
              value={formatMoney(st?.due_this_month ?? 0, currency)}
              sub="Open cycle amounts"
            />
            <KpiCard
              label="Overdue amount" color="#EF4444"
              value={formatMoney(st?.overdue_amount ?? 0, currency)}
              sub="Past due date"
            />
            <KpiCard
              label="Renewals next 7 days" color="#F59E0B"
              value={String(st?.renewals_next_7_days ?? 0)}
              sub="Active plans billing soon"
            />
          </div>

          {/* ── List ── */}
          <Panel>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input className="input pl-9 py-2 text-sm" placeholder="Search by name or client…"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  upcomingOnly ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  background: upcomingOnly ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                  border: upcomingOnly ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                }}
                onClick={() => setUpcomingOnly((v) => !v)}
              >
                <CalendarClock className="w-3.5 h-3.5" /> Upcoming renewals
              </button>
            </div>

            <div className="flex flex-wrap gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.value ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  style={statusFilter === f.value ? { background: 'rgba(59,130,246,0.20)' } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No subscriptions match your filters"
                description="Try a different search term, status, or clear the upcoming-renewals filter."
              />
            ) : (
              <DataTable columns={[
                { key: 'name', label: 'Name' },
                { key: 'client', label: 'Client' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'next', label: 'Next billing' },
                { key: 'status', label: 'Status', align: 'right' },
                { key: 'actions', label: '', align: 'right' },
              ]}>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => navigate(`/app/finance/subscriptions/${s.id}`)}
                  >
                    <td className="py-3 text-white text-sm font-medium">{s.name}</td>
                    <td className="py-3 text-slate-400 text-xs">{s.client_name || '—'}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <Money amount={s.amount} currency={s.currency} />
                      <span className="text-[11px] text-slate-500"> / {frequencyLabel(s).toLowerCase()}</span>
                    </td>
                    <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(s.next_billing_date)}</td>
                    <td className="py-3 text-right"><StatusBadge status={s.status} /></td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-blue-400">
                        View <ChevronRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>

          <RemindersPanel agencyId={agencyId} />
        </div>
      )}

      {showForm && (
        <SubscriptionFormModal
          agencyId={agencyId}
          userId={user?.id ?? ''}
          clients={clients}
          services={services}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Reminders panel ──────────────────────────────────────────────────────────

type ReminderTab = 'pending' | 'sent' | 'failed' | 'overdue'

const REMINDER_TABS: { value: ReminderTab; label: string }[] = [
  { value: 'pending', label: 'Upcoming' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'overdue', label: 'Overdue' },
]

const REMINDER_EMPTY: Record<ReminderTab, string> = {
  pending: 'No pending reminders are scheduled.',
  sent: 'No reminders have been sent yet.',
  failed: 'No reminders have failed.',
  overdue: 'No overdue-payment reminders exist.',
}

function RemindersPanel({ agencyId }: { agencyId: string }) {
  const [tab, setTab] = useState<ReminderTab>('pending')
  const [rows, setRows] = useState<PaymentReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      // The "Overdue" tab groups by reminder TYPE, the rest by delivery status.
      const list = tab === 'overdue'
        ? (await subscriptionService.listReminders(agencyId, {})).filter((r) => r.type === 'overdue')
        : await subscriptionService.listReminders(agencyId, { status: tab })
      setRows(list)
    } catch (err) {
      console.error('[Subscriptions] reminders load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load reminders.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, tab])

  useEffect(() => { load() }, [load])

  return (
    <Panel
      title="Payment reminders"
      action={
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {REMINDER_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                tab === t.value ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={tab === t.value ? { background: 'rgba(59,130,246,0.20)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <div className="rounded-xl px-3 py-2.5 text-xs text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}{' '}
          <button className="underline hover:text-red-300" onClick={load}>Retry</button>
        </div>
      ) : loading ? (
        <FinanceSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon="🔔" title="Nothing here" description={REMINDER_EMPTY[tab]} />
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {r.client_name || 'Unknown client'}
                  {r.subscription_name ? <span className="text-slate-500"> · {r.subscription_name}</span> : null}
                </p>
                <p className="text-[10px] text-slate-500">
                  {REMINDER_TYPE_LABELS[r.type]} · scheduled {formatDateShort(r.scheduled_for)}
                  {r.status === 'sent' && r.sent_at ? ` · sent ${formatDateShort(r.sent_at)}` : ''}
                </p>
                {r.status === 'failed' && r.error_message && (
                  <p className="text-[10px] text-red-400 mt-0.5 truncate">{r.error_message}</p>
                )}
              </div>
              <ChannelBadge channel={r.channel} status={r.status} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/**
 * Honest delivery labelling. Only in-app delivery is wired up; other channels
 * are labelled as unconfigured while pending, and we never claim an external
 * message went out unless the row itself says it was sent on that channel.
 */
function ChannelBadge({
  channel, status,
}: {
  channel: PaymentReminder['channel']
  status: PaymentReminder['status']
}) {
  const neutral = {
    color: '#94A3B8',
    background: 'rgba(148,163,184,0.10)',
    border: '1px solid rgba(148,163,184,0.25)',
  }
  if (channel === 'in_app') {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0" style={neutral}>
        In-App Only
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0" style={neutral}>
        Not configured — In-app only
      </span>
    )
  }
  const label = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Email'
  return (
    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0" style={neutral}>
      {label}
    </span>
  )
}

// ─── Create / edit form (shared with SubscriptionDetail) ─────────────────────

const FREQUENCIES: BillingFrequency[] = ['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom']

export function SubscriptionFormModal({
  agencyId, userId, clients, services, initial, onClose, onSaved,
}: {
  agencyId: string
  userId: string
  clients: Client[]
  services: AgencyService[]
  /** When provided the modal edits this subscription instead of creating one. */
  initial?: ClientSubscription
  onClose: () => void
  onSaved: () => void
}) {
  const todayIso = isoDate(new Date())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  // In edit mode the next-billing date is treated as deliberately set.
  const [nbdTouched, setNbdTouched] = useState(!!initial)

  const [f, setF] = useState({
    client_id: initial?.client_id ?? '',
    service_id: initial?.service_id ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    amount: initial ? String(initial.amount) : '',
    currency: initial?.currency ?? 'EGP',
    billing_frequency: (initial?.billing_frequency ?? 'monthly') as BillingFrequency,
    custom_interval_days: initial?.custom_interval_days ? String(initial.custom_interval_days) : '',
    start_date: initial?.start_date ?? todayIso,
    next_billing_date: initial?.next_billing_date ?? todayIso,
    billing_day: initial?.billing_day ? String(initial.billing_day) : '',
    grace_period_days: initial ? String(initial.grace_period_days) : '0',
    auto_renew: initial?.auto_renew ?? true,
    reminder_days: initial ? initial.reminder_days_before.join(',') : '7,3,1,0',
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }))

  const onStartDateChange = (v: string) => {
    // Default the next billing date to the start date until edited explicitly.
    setF((p) => ({ ...p, start_date: v, next_billing_date: nbdTouched ? p.next_billing_date : v }))
  }

  const submit = async () => {
    if (!f.client_id) return setErr('Please choose a client.')
    if (!f.name.trim()) return setErr('Please enter a subscription name.')
    const amount = Number(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter an amount greater than zero.')

    let customDays: number | null = null
    if (f.billing_frequency === 'custom') {
      customDays = Number(f.custom_interval_days)
      if (!Number.isInteger(customDays) || customDays < 1) {
        return setErr('Enter the custom billing interval in days (at least 1).')
      }
    }

    if (!f.start_date) return setErr('Please choose a start date.')
    if (!f.next_billing_date) return setErr('Please choose the next billing date.')

    let billingDay: number | null = null
    if (f.billing_day) {
      billingDay = Number(f.billing_day)
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
        return setErr('Billing day must be between 1 and 31.')
      }
    }

    const grace = f.grace_period_days === '' ? 0 : Number(f.grace_period_days)
    if (!Number.isInteger(grace) || grace < 0) {
      return setErr('Grace period must be zero or a positive number of days.')
    }

    const reminderDays = f.reminder_days
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map(Number)
    if (reminderDays.length === 0 || reminderDays.some((n) => !Number.isInteger(n) || n < 0)) {
      return setErr('Reminder days must be a comma-separated list of numbers, e.g. 7,3,1,0.')
    }

    const input: SubscriptionInput = {
      client_id: f.client_id,
      service_id: f.service_id || null,
      name: f.name.trim(),
      description: f.description.trim() || null,
      amount,
      currency: f.currency,
      billing_frequency: f.billing_frequency,
      custom_interval_days: customDays,
      start_date: f.start_date,
      next_billing_date: f.next_billing_date,
      billing_day: billingDay,
      auto_renew: f.auto_renew,
      grace_period_days: grace,
      reminder_days_before: reminderDays,
    }

    setSaving(true); setErr('')
    try {
      if (initial) {
        await subscriptionService.update(initial.id, input)
      } else {
        await subscriptionService.create(agencyId, userId, input)
      }
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the subscription.')
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
            {initial ? 'Edit subscription' : 'New subscription'}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client *">
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

          <Field label="Subscription name *">
            <input className="input py-2 text-sm" value={f.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Monthly social media retainer" />
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
            <Field label="Billing frequency">
              <select className="input py-2 text-sm" value={f.billing_frequency}
                onChange={(e) => set('billing_frequency', e.target.value as BillingFrequency)}>
                {FREQUENCIES.map((fr) => <option key={fr} value={fr}>{FREQUENCY_LABELS[fr]}</option>)}
              </select>
            </Field>
            {f.billing_frequency === 'custom' ? (
              <Field label="Interval (days) *">
                <input className="input py-2 text-sm" type="number" min="1" step="1"
                  value={f.custom_interval_days} onChange={(e) => set('custom_interval_days', e.target.value)}
                  placeholder="30" />
              </Field>
            ) : (
              <Field label="Billing day (1–31)">
                <input className="input py-2 text-sm" type="number" min="1" max="31" step="1"
                  value={f.billing_day} onChange={(e) => set('billing_day', e.target.value)} placeholder="Optional" />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date *">
              <input className="input py-2 text-sm" type="date"
                value={f.start_date} onChange={(e) => onStartDateChange(e.target.value)} />
            </Field>
            <Field label="Next billing date *">
              <input className="input py-2 text-sm" type="date"
                value={f.next_billing_date}
                onChange={(e) => { setNbdTouched(true); set('next_billing_date', e.target.value) }} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {f.billing_frequency === 'custom' && (
              <Field label="Billing day (1–31)">
                <input className="input py-2 text-sm" type="number" min="1" max="31" step="1"
                  value={f.billing_day} onChange={(e) => set('billing_day', e.target.value)} placeholder="Optional" />
              </Field>
            )}
            <Field label="Grace period (days)">
              <input className="input py-2 text-sm" type="number" min="0" step="1"
                value={f.grace_period_days} onChange={(e) => set('grace_period_days', e.target.value)} />
            </Field>
            <Field label="Reminder days before">
              <input className="input py-2 text-sm" value={f.reminder_days}
                onChange={(e) => set('reminder_days', e.target.value)} placeholder="7,3,1,0" />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input type="checkbox" className="w-4 h-4 accent-blue-500"
              checked={f.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} />
            <span className="text-sm text-slate-300">Auto-renew — advance the billing date automatically after each cycle</span>
          </label>

          <Field label="Notes">
            <textarea className="input py-2 text-sm resize-none h-16" value={f.description}
              onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create subscription'}
          </button>
        </div>
      </div>
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
