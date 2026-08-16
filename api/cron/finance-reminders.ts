/**
 * EZ Marketing Agency — Finance cron endpoint
 *
 * Runs subscription billing, recurring expenses and reminder generation on a
 * schedule so nothing depends on someone opening the website.
 *
 * SECURITY
 *   • Requires CRON_SECRET, supplied either as `Authorization: Bearer <secret>`
 *     (Vercel Cron sends this automatically) or `?secret=` for manual runs.
 *   • Uses SUPABASE_SERVICE_ROLE_KEY — SERVER SIDE ONLY. This file lives under
 *     /api and is never bundled into the browser. The key must NOT be prefixed
 *     with VITE_.
 *
 * IDEMPOTENT: every generator is safe to run repeatedly. Cycles are unique per
 * (subscription, period_start) and reminders per dedupe_key, so a double run
 * creates nothing twice.
 *
 * Schedule in vercel.json:  0 6 * * *   (06:00 UTC daily)
 *
 * TIMEZONE: Vercel Cron fires in UTC; Postgres CURRENT_DATE inside the
 * generator functions is also UTC. The business operates in Egypt
 * (UTC+2 winter / UTC+3 summer), so 06:00 UTC = 08:00–09:00 Cairo — the same
 * calendar date in both zones at that hour. Due dates are plain DATEs, so as
 * long as this job runs between ~03:00 and ~21:00 UTC there is no ambiguity.
 * Do not move the schedule close to midnight UTC without revisiting this.
 */

import { createClient } from '@supabase/supabase-js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

function unauthorized(res: VercelResponse, reason: string) {
  // Deliberately vague to the caller; the detail goes to server logs only.
  console.warn('[cron/finance-reminders] rejected:', reason)
  return res.status(401).json({ error: 'Unauthorized' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/finance-reminders] CRON_SECRET is not configured')
    return res.status(500).json({ error: 'Server not configured' })
  }

  const authHeader = String(req.headers.authorization ?? '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : ''

  if (bearer !== secret && querySecret !== secret) {
    return unauthorized(res, 'bad or missing secret')
  }

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('[cron/finance-reminders] missing Supabase server credentials')
    return res.status(500).json({ error: 'Server not configured' })
  }

  // Service role bypasses RLS — required, since cron acts for every agency.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = new Date().toISOString()
  const result = {
    startedAt,
    cyclesCreated: 0,
    remindersCreated: 0,
    overdueMarked: 0,
    recurringExpensesCreated: 0,
    remindersDispatched: 0,
    errors: [] as string[],
  }

  // ── 1. Subscription cycles + reminder ladder + overdue sweep ──
  try {
    const { data, error } = await supabase.rpc('generate_subscription_cycles', {
      p_horizon_days: 45,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    result.cyclesCreated = Number(row?.cycles_created ?? 0)
    result.remindersCreated = Number(row?.reminders_created ?? 0)
    result.overdueMarked = Number(row?.overdue_marked ?? 0)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron] generate_subscription_cycles failed:', msg)
    result.errors.push(`subscription_cycles: ${msg}`)
  }

  // ── 2. Recurring expenses ──
  try {
    const { data, error } = await supabase.rpc('generate_recurring_expenses', {
      p_horizon_days: 7,
    })
    if (error) throw error
    result.recurringExpensesCreated = Number(data ?? 0)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron] generate_recurring_expenses failed:', msg)
    result.errors.push(`recurring_expenses: ${msg}`)
  }

  // Roles that receive finance reminder notifications, per agency.
  const FINANCE_ROLES = ['super_admin', 'agency_admin', 'finance_manager', 'accountant']
  const financeUsersByAgency = new Map<string, string[]>()

  const financeUsers = async (agencyId: string): Promise<string[]> => {
    const cached = financeUsersByAgency.get(agencyId)
    if (cached) return cached
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .in('role', FINANCE_ROLES)
    const ids = (data ?? []).map((p: { id: string }) => p.id)
    financeUsersByAgency.set(agencyId, ids)
    return ids
  }

  /** Insert one notification per recipient, skipping same-day duplicates. */
  const notifyUsers = async (
    userIds: string[],
    agencyId: string,
    type: string,
    title: string,
    message: string,
    actionUrl: string
  ): Promise<boolean> => {
    if (!userIds.length) return false
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`
    let anyOk = false
    for (const userId of userIds) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .gte('created_at', todayStart)
        .limit(1)
      if (existing?.length) { anyOk = true; continue }
      const { error } = await supabase.from('notifications').insert({
        agency_id: agencyId,
        user_id: userId,
        type,
        title,
        message,
        action_url: actionUrl,
      })
      if (!error) anyOk = true
      else console.error('[cron] notification insert failed:', error.message)
    }
    return anyOk
  }

  // ── 3. Turn due payment reminders into in-app notifications ──
  //    notifications.user_id is NOT NULL, so each reminder fans out to every
  //    finance-role user of the agency. Email/WhatsApp channels can be added
  //    later; the reminder rows and dedupe keys already model the attempt.
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: due, error } = await supabase
      .from('payment_reminders')
      .select('id, agency_id, client_id, subscription_id, billing_cycle_id, type, channel')
      .eq('status', 'pending')
      .eq('channel', 'in_app')
      .lte('scheduled_for', today)
      .limit(500)

    if (error) throw error

    for (const r of due ?? []) {
      const { data: cycle } = await supabase
        .from('subscription_cycles')
        .select('amount, currency, due_date, clients(name)')
        .eq('id', r.billing_cycle_id)
        .maybeSingle()

      const clientName =
        (cycle as { clients?: { name?: string } } | null)?.clients?.name ?? 'A client'
      const amount = cycle?.amount ?? 0
      const currency = cycle?.currency ?? 'EGP'

      const title =
        r.type === 'overdue'
          ? `Payment overdue — ${clientName}`
          : r.type === 'due_today'
            ? `Payment due today — ${clientName}`
            : `Upcoming payment — ${clientName}`

      const recipients = await financeUsers(r.agency_id)
      const ok = await notifyUsers(
        recipients, r.agency_id, 'invoice', title,
        `${amount} ${currency} due ${cycle?.due_date ?? 'soon'}.`,
        r.subscription_id ? `/app/finance/subscriptions/${r.subscription_id}` : '/app/finance/subscriptions'
      )

      await supabase
        .from('payment_reminders')
        .update(
          ok
            ? { status: 'sent', sent_at: new Date().toISOString() }
            : { status: 'failed', error_message: 'No recipient could be notified' }
        )
        .eq('id', r.id)

      if (ok) result.remindersDispatched += 1
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron] reminder dispatch failed:', msg)
    result.errors.push(`dispatch: ${msg}`)
  }

  // ── 4. Flag subscriptions that carry an overdue cycle ──
  try {
    const { data: overdueCycles } = await supabase
      .from('subscription_cycles')
      .select('subscription_id')
      .eq('status', 'overdue')
    const ids = Array.from(new Set((overdueCycles ?? []).map((c: { subscription_id: string }) => c.subscription_id)))
    if (ids.length) {
      await supabase
        .from('client_subscriptions')
        .update({ status: 'overdue' })
        .in('id', ids)
        .eq('status', 'active')
    }
  } catch (err) {
    result.errors.push(`overdue_subs: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── 5. Operational reminders: tasks due today, shoots tomorrow ──
  try {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)

    const { data: dueTasks } = await supabase
      .from('tasks')
      .select('id, agency_id, title, assigned_to, due_date')
      .neq('status', 'done')
      .not('assigned_to', 'is', null)
      .lte('due_date', today)
      .limit(200)

    for (const t of dueTasks ?? []) {
      await notifyUsers(
        [t.assigned_to], t.agency_id, 'task',
        `Task due: ${t.title}`,
        t.due_date < today ? `This task was due ${t.due_date}.` : 'This task is due today.',
        '/app/tasks'
      )
    }

    const { data: shoots } = await supabase
      .from('bookings')
      .select('id, agency_id, title, booking_date, assigned_team_ids, clients(name)')
      .eq('booking_date', tomorrow)
      .in('status', ['confirmed', 'deposit_paid', 'scheduled'])
      .limit(100)

    for (const b of shoots ?? []) {
      const team: string[] = b.assigned_team_ids ?? []
      const clientName = (b as { clients?: { name?: string } }).clients?.name ?? 'a client'
      await notifyUsers(
        team, b.agency_id, 'shooting',
        `Shoot tomorrow: ${b.title}`,
        `Shooting for ${clientName} is scheduled for ${b.booking_date}.`,
        '/app/booking'
      )
    }
  } catch (err) {
    result.errors.push(`ops_reminders: ${err instanceof Error ? err.message : String(err)}`)
  }

  const status = result.errors.length ? 207 : 200
  return res.status(status).json({ ...result, finishedAt: new Date().toISOString() })
}
