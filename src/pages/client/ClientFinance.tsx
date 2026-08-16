/**
 * EZ Marketing Agency — Client Portal · Billing & Payments
 *
 * A client sees ONLY their own package, subscriptions, billing cycles and
 * invoices. RLS enforces this server-side (client_id = my_client_id()); this
 * page never requests agency-level figures — no revenue, costs, payroll or
 * other clients.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, CalendarClock, CheckCircle, AlertCircle, Clock, Package as PackageIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { formatMoney, formatDateShort } from '../../lib/finance'
import { packageService } from '../../services/packageService'
import { invoiceService } from '../../services/invoiceService'
import {
  subscriptionService,
  type ClientSubscription, type SubscriptionCycle,
} from '../../services/subscriptionService'
import type { Package, Invoice } from '../../types'

const FREQ_LABELS: Record<string, string> = {
  weekly: 'per week', monthly: 'per month', quarterly: 'per quarter',
  semi_annual: 'every 6 months', annual: 'per year', custom: 'per cycle',
}

const CYCLE_BADGES: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: '#10B981' },
  partially_paid: { label: 'Partially paid', color: '#FBBF24' },
  expected: { label: 'Upcoming', color: '#38BDF8' },
  invoiced: { label: 'Invoiced', color: '#38BDF8' },
  overdue: { label: 'Overdue', color: '#EF4444' },
  cancelled: { label: 'Cancelled', color: '#64748B' },
  written_off: { label: 'Written off', color: '#64748B' },
}

export default function ClientFinance() {
  const { user, profile } = useAuth()
  const clientId = profile?.client_id ?? null
  const agencyId = profile?.agency_id || user?.agencyId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pkg, setPkg] = useState<Package | undefined>(undefined)
  const [subs, setSubs] = useState<ClientSubscription[]>([])
  const [cyclesBySub, setCyclesBySub] = useState<Record<string, SubscriptionCycle[]>>({})
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const load = useCallback(async () => {
    if (!clientId || !agencyId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [p, s, inv] = await Promise.all([
        packageService.getByClient(clientId),
        subscriptionService.list(agencyId, { clientId }),
        invoiceService.getByClient(clientId),
      ])
      setPkg(p)
      setSubs(s)
      setInvoices(inv)

      const cycleEntries = await Promise.all(
        s.map(async (sub) => [sub.id, await subscriptionService.listCycles(sub.id)] as const)
      )
      setCyclesBySub(Object.fromEntries(cycleEntries))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your billing information.')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load])

  if (!clientId) {
    return (
      <div className="px-5 py-16 max-w-2xl mx-auto text-center">
        <Wallet className="w-8 h-8 mx-auto mb-3 text-slate-600" />
        <h1 className="text-lg font-black text-white mb-2">Billing not linked yet</h1>
        <p className="text-sm text-slate-400">
          Your portal account is not linked to a client record yet. Contact your account manager and
          they'll connect it in a minute.
        </p>
      </div>
    )
  }

  if (error) {
    return <PageErrorState title="We couldn't load your billing" message={error} onRetry={load} />
  }

  // Per-currency paid / remaining across all cycles.
  const totals = new Map<string, { paid: number; remaining: number }>()
  for (const cycles of Object.values(cyclesBySub)) {
    for (const c of cycles) {
      if (['cancelled', 'written_off'].includes(c.status)) continue
      const t = totals.get(c.currency) ?? { paid: 0, remaining: 0 }
      t.paid += Number(c.amount_paid)
      t.remaining += Math.max(0, Number(c.amount) - Number(c.amount_paid))
      totals.set(c.currency, t)
    }
  }

  const nextPayment = subs
    .filter((s) => s.status === 'active')
    .sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date))[0]

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Billing & Payments</h1>
        <p className="text-sm text-slate-400">Your subscription, payment schedule and history</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mb-1">Next payment</div>
              <div className="text-base font-black text-white">
                {nextPayment ? formatDateShort(nextPayment.next_billing_date) : '—'}
              </div>
              {nextPayment && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formatMoney(nextPayment.amount, nextPayment.currency)}
                </div>
              )}
            </div>
            {Array.from(totals.entries()).slice(0, 2).map(([currency, t]) => (
              <div key={`paid-${currency}`} className="rounded-xl p-4"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">
                  Paid ({currency})
                </div>
                <div className="text-base font-black text-white">{formatMoney(t.paid, currency)}</div>
              </div>
            ))}
            {Array.from(totals.entries()).slice(0, 1).map(([currency, t]) => (
              <div key={`rem-${currency}`} className="rounded-xl p-4"
                style={{
                  background: t.remaining > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${t.remaining > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)'}`,
                }}>
                <div className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${t.remaining > 0 ? 'text-red-500' : 'text-slate-600'}`}>
                  Remaining ({currency})
                </div>
                <div className={`text-base font-black ${t.remaining > 0 ? 'text-red-400' : 'text-white'}`}>
                  {formatMoney(t.remaining, currency)}
                </div>
              </div>
            ))}
          </div>

          {/* Package */}
          {pkg && (
            <div className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>
                <PackageIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{pkg.name}</div>
                <div className="text-[11px] text-slate-500">
                  {pkg.consumedVideos}/{pkg.includedVideos} videos used · renews {pkg.renewalDate ? formatDateShort(pkg.renewalDate) : '—'}
                </div>
              </div>
              <div className="text-sm font-bold text-white flex-shrink-0">
                {formatMoney(pkg.monthlyPrice)} <span className="text-[10px] text-slate-500 font-medium">/ month</span>
              </div>
            </div>
          )}

          {/* Subscriptions & billing history */}
          {subs.length === 0 ? (
            <div className="text-center py-14"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16 }}>
              <CalendarClock className="w-8 h-8 mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-400">No active subscription on file</p>
            </div>
          ) : subs.map((sub) => (
            <motion.div key={sub.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-white">{sub.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatMoney(sub.amount, sub.currency)} {FREQ_LABELS[sub.billing_frequency] ?? ''}
                    {sub.status === 'active' && ` · next payment ${formatDateShort(sub.next_billing_date)}`}
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{
                    color: sub.status === 'active' ? '#10B981' : sub.status === 'overdue' ? '#EF4444' : '#94A3B8',
                    background: 'rgba(255,255,255,0.05)',
                  }}>
                  {sub.status}
                </span>
              </div>

              <div className="space-y-1.5">
                {(cyclesBySub[sub.id] ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-600">No billing periods generated yet.</p>
                ) : (cyclesBySub[sub.id] ?? []).map((c) => {
                  const badge = CYCLE_BADGES[c.status] ?? { label: c.status, color: '#94A3B8' }
                  const Icon = c.status === 'paid' ? CheckCircle : c.status === 'overdue' ? AlertCircle : Clock
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: badge.color }} />
                      <span className="text-xs text-white flex-1">
                        {new Date(c.period_start).toLocaleDateString('en-EG', { month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-[11px] text-slate-500 hidden sm:block">
                        due {formatDateShort(c.due_date)}
                      </span>
                      <span className="text-xs font-semibold text-white">{formatMoney(Number(c.amount), c.currency)}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-20 text-center"
                        style={{ color: badge.color, background: `${badge.color}18` }}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}

          {/* Invoices */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-500">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="rounded-xl p-3.5 flex items-center gap-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500">
                        Issued {formatDateShort(inv.issuedDate)}
                        {inv.dueDate && ` · due ${formatDateShort(inv.dueDate)}`}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white">{formatMoney(inv.total)}</div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{
                        color: inv.status === 'paid' ? '#10B981' : inv.status === 'overdue' ? '#EF4444' : '#38BDF8',
                        background: 'rgba(255,255,255,0.05)',
                      }}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
