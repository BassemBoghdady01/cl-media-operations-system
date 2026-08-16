/**
 * EZ Marketing Agency — Subscriptions, Billing Cycles & Payment Reminders
 *
 * PRODUCTION ONLY. Failures throw; nothing falls back to fake data.
 * RLS (006) enforces subscriptions.view / subscriptions.manage server-side.
 * Mutations that must stay consistent across tables (generate cycle, mark
 * paid) go through the SECURITY DEFINER RPCs from 009 — never two separate
 * client-side writes.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'draft' | 'active' | 'paused' | 'overdue' | 'cancelled' | 'expired'

export type BillingFrequency =
  | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom'

export interface ClientSubscription {
  id: string
  agency_id: string
  client_id: string
  client_name: string
  package_id: string | null
  service_id: string | null
  service_name: string | null
  name: string
  description: string | null
  amount: number
  currency: string
  billing_frequency: BillingFrequency
  custom_interval_days: number | null
  start_date: string
  next_billing_date: string
  end_date: string | null
  billing_day: number | null
  auto_renew: boolean
  auto_generate_invoice: boolean
  grace_period_days: number
  reminder_days_before: number[]
  status: SubscriptionStatus
  created_at: string
}

export type CycleStatus =
  | 'expected' | 'invoiced' | 'partially_paid' | 'paid' | 'overdue'
  | 'cancelled' | 'written_off'

export interface SubscriptionCycle {
  id: string
  subscription_id: string
  agency_id: string
  client_id: string
  period_start: string
  period_end: string
  due_date: string
  amount: number
  currency: string
  amount_paid: number
  status: CycleStatus
  invoice_id: string | null
  transaction_id: string | null
  created_at: string
}

export interface PaymentReminder {
  id: string
  agency_id: string
  client_id: string | null
  client_name: string | null
  subscription_id: string | null
  subscription_name: string | null
  billing_cycle_id: string | null
  type: 'upcoming' | 'due_today' | 'overdue' | 'final_notice'
  days_offset: number | null
  scheduled_for: string
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms'
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export interface SubscriptionStats {
  currency: string
  active_count: number
  due_this_month: number
  overdue_amount: number
  renewals_next_7_days: number
}

export interface SubscriptionInput {
  client_id: string
  service_id?: string | null
  package_id?: string | null
  name: string
  description?: string | null
  amount: number
  currency: string
  billing_frequency: BillingFrequency
  custom_interval_days?: number | null
  start_date: string
  next_billing_date: string
  end_date?: string | null
  billing_day?: number | null
  auto_renew?: boolean
  grace_period_days?: number
  reminder_days_before?: number[]
  status?: SubscriptionStatus
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapSubscription(r: Row): ClientSubscription {
  return {
    id: r.id,
    agency_id: r.agency_id,
    client_id: r.client_id,
    client_name: r.clients?.name ?? '',
    package_id: r.package_id ?? null,
    service_id: r.service_id ?? null,
    service_name: r.agency_services?.name ?? null,
    name: r.name ?? '',
    description: r.description ?? null,
    amount: Number(r.amount ?? 0),
    currency: r.currency ?? 'EGP',
    billing_frequency: r.billing_frequency ?? 'monthly',
    custom_interval_days: r.custom_interval_days ?? null,
    start_date: dstr(r.start_date),
    next_billing_date: dstr(r.next_billing_date),
    end_date: r.end_date ? dstr(r.end_date) : null,
    billing_day: r.billing_day ?? null,
    auto_renew: !!r.auto_renew,
    auto_generate_invoice: !!r.auto_generate_invoice,
    grace_period_days: Number(r.grace_period_days ?? 0),
    reminder_days_before: r.reminder_days_before ?? [7, 3, 1, 0],
    status: r.status ?? 'active',
    created_at: String(r.created_at ?? ''),
  }
}

const SUB_SELECT = '*, clients(name), agency_services(name)'

// ─── Service ──────────────────────────────────────────────────────────────────

export const subscriptionService = {
  list: async (
    agencyId: string,
    filters: { status?: SubscriptionStatus; clientId?: string; search?: string } = {}
  ): Promise<ClientSubscription[]> => {
    let q = db().from('client_subscriptions').select(SUB_SELECT)
      .eq('agency_id', agencyId)
      .order('next_billing_date', { ascending: true })
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.clientId) q = q.eq('client_id', filters.clientId)
    if (filters.search) q = q.ilike('name', `%${filters.search}%`)
    const { data, error } = await q
    orThrow('subscriptionService.list', error)
    return (data ?? []).map(mapSubscription)
  },

  getById: async (id: string): Promise<ClientSubscription | undefined> => {
    const { data, error } = await db()
      .from('client_subscriptions').select(SUB_SELECT).eq('id', id).maybeSingle()
    orThrow('subscriptionService.getById', error)
    return data ? mapSubscription(data) : undefined
  },

  create: async (agencyId: string, userId: string, input: SubscriptionInput): Promise<ClientSubscription> => {
    const { data, error } = await db()
      .from('client_subscriptions')
      .insert({
        agency_id: agencyId,
        created_by: userId,
        client_id: input.client_id,
        service_id: input.service_id ?? null,
        package_id: input.package_id ?? null,
        name: input.name,
        description: input.description ?? null,
        amount: input.amount,
        currency: input.currency,
        billing_frequency: input.billing_frequency,
        custom_interval_days: input.custom_interval_days ?? null,
        start_date: input.start_date,
        next_billing_date: input.next_billing_date,
        end_date: input.end_date ?? null,
        billing_day: input.billing_day ?? null,
        auto_renew: input.auto_renew ?? true,
        grace_period_days: input.grace_period_days ?? 0,
        reminder_days_before: input.reminder_days_before ?? [7, 3, 1, 0],
        status: input.status ?? 'active',
      })
      .select(SUB_SELECT).single()
    orThrow('subscriptionService.create', error)
    return mapSubscription(data as Row)
  },

  update: async (id: string, updates: Partial<SubscriptionInput>): Promise<void> => {
    const { error } = await db().from('client_subscriptions').update(updates).eq('id', id)
    orThrow('subscriptionService.update', error)
  },

  setStatus: async (id: string, status: SubscriptionStatus): Promise<void> => {
    const { error } = await db().from('client_subscriptions').update({ status }).eq('id', id)
    orThrow('subscriptionService.setStatus', error)
  },

  // ── Cycles ──
  listCycles: async (subscriptionId: string): Promise<SubscriptionCycle[]> => {
    const { data, error } = await db()
      .from('subscription_cycles').select('*')
      .eq('subscription_id', subscriptionId)
      .order('period_start', { ascending: false })
    orThrow('subscriptionService.listCycles', error)
    return (data ?? []) as SubscriptionCycle[]
  },

  listCyclesForAgency: async (
    agencyId: string,
    filters: { status?: CycleStatus; from?: string; to?: string } = {}
  ): Promise<SubscriptionCycle[]> => {
    let q = db().from('subscription_cycles').select('*')
      .eq('agency_id', agencyId).order('due_date', { ascending: true })
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.from) q = q.gte('due_date', filters.from)
    if (filters.to) q = q.lte('due_date', filters.to)
    const { data, error } = await q
    orThrow('subscriptionService.listCyclesForAgency', error)
    return (data ?? []) as SubscriptionCycle[]
  },

  /** Manual "Generate next cycle" — idempotent RPC, refuses duplicates. */
  generateNextCycle: async (subscriptionId: string): Promise<string> => {
    const { data, error } = await db().rpc('generate_cycle_for_subscription', {
      p_subscription: subscriptionId,
    })
    orThrow('subscriptionService.generateNextCycle', error)
    return data as string
  },

  /** Record a (full or partial) payment against a cycle. Cycle + ledger move together. */
  markCyclePaid: async (
    cycleId: string, amountPaid: number, accountId?: string, method?: string
  ): Promise<void> => {
    const { error } = await db().rpc('mark_cycle_paid', {
      p_cycle: cycleId,
      p_amount: amountPaid,
      p_account: accountId ?? null,
      p_method: method ?? null,
    })
    orThrow('subscriptionService.markCyclePaid', error)
  },

  markCycleOverdue: async (cycleId: string): Promise<void> => {
    const { error } = await db()
      .from('subscription_cycles').update({ status: 'overdue' }).eq('id', cycleId)
    orThrow('subscriptionService.markCycleOverdue', error)
  },

  /** Create an invoice from a cycle and link it. */
  createInvoiceForCycle: async (cycle: SubscriptionCycle, subscriptionName: string): Promise<string> => {
    const invoiceNumber = `SUB-${cycle.period_start.replace(/-/g, '').slice(0, 6)}-${cycle.id.slice(0, 6).toUpperCase()}`
    const { data, error } = await db()
      .from('invoices')
      .insert({
        agency_id: cycle.agency_id,
        client_id: cycle.client_id,
        invoice_number: invoiceNumber,
        amount: cycle.amount,
        total: cycle.amount,
        currency: cycle.currency,
        status: 'sent',
        due_date: cycle.due_date,
        notes: `${subscriptionName} — billing period ${cycle.period_start} to ${cycle.period_end}`,
      })
      .select('id').single()
    orThrow('subscriptionService.createInvoiceForCycle', error)

    const { error: linkErr } = await db()
      .from('subscription_cycles')
      .update({ invoice_id: (data as Row).id, status: cycle.status === 'expected' ? 'invoiced' : cycle.status })
      .eq('id', cycle.id)
    orThrow('subscriptionService.linkInvoice', linkErr)
    return (data as Row).id
  },

  // ── Reminders ──
  listReminders: async (
    agencyId: string,
    filters: { status?: PaymentReminder['status']; subscriptionId?: string; limit?: number } = {}
  ): Promise<PaymentReminder[]> => {
    let q = db().from('payment_reminders')
      .select('*, clients(name), client_subscriptions(name)')
      .eq('agency_id', agencyId)
      .order('scheduled_for', { ascending: false })
      .limit(filters.limit ?? 200)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.subscriptionId) q = q.eq('subscription_id', filters.subscriptionId)
    const { data, error } = await q
    orThrow('subscriptionService.listReminders', error)
    return (data ?? []).map((r: Row) => ({
      ...r,
      client_name: r.clients?.name ?? null,
      subscription_name: r.client_subscriptions?.name ?? null,
      scheduled_for: dstr(r.scheduled_for),
    })) as PaymentReminder[]
  },

  /** Per-currency KPIs computed from real rows. */
  getStats: async (agencyId: string): Promise<SubscriptionStats[]> => {
    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1))
    const monthEnd = iso(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    const in7 = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7))
    const todayIso = iso(today)

    const [subsRes, cyclesRes] = await Promise.all([
      db().from('client_subscriptions')
        .select('currency, status, next_billing_date')
        .eq('agency_id', agencyId),
      db().from('subscription_cycles')
        .select('currency, status, amount, amount_paid, due_date')
        .eq('agency_id', agencyId)
        .in('status', ['expected', 'invoiced', 'partially_paid', 'overdue']),
    ])
    orThrow('subscriptionService.getStats(subs)', subsRes.error)
    orThrow('subscriptionService.getStats(cycles)', cyclesRes.error)

    const by = new Map<string, SubscriptionStats>()
    const bucket = (c: string) => {
      if (!by.has(c)) {
        by.set(c, { currency: c, active_count: 0, due_this_month: 0, overdue_amount: 0, renewals_next_7_days: 0 })
      }
      return by.get(c)!
    }

    for (const s of (subsRes.data ?? []) as Row[]) {
      const b = bucket(s.currency ?? 'EGP')
      if (s.status === 'active') {
        b.active_count += 1
        const nbd = dstr(s.next_billing_date)
        if (nbd >= todayIso && nbd <= in7) b.renewals_next_7_days += 1
      }
    }
    for (const c of (cyclesRes.data ?? []) as Row[]) {
      const b = bucket(c.currency ?? 'EGP')
      const open = Number(c.amount ?? 0) - Number(c.amount_paid ?? 0)
      const due = dstr(c.due_date)
      if (due >= monthStart && due <= monthEnd) b.due_this_month += open
      if (c.status === 'overdue' || due < todayIso) b.overdue_amount += open
    }
    return Array.from(by.values())
  },
}
