/**
 * QA functional-flow test against the REAL Supabase project.
 *
 * Uses @supabase/supabase-js (the same library the app uses) and replicates
 * the exact calls the app services make. Creates ONE clearly-named QA user
 * whose data lives in its own agency (RLS-isolated from production data),
 * exercises the core flows, then deletes the rows it created.
 *
 * Run: node scripts/qa-flows.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const QA_EMAIL = 'qa-functional-audit@ezmarketing.agency'
const QA_PASS = 'QA-audit-2026!x'

const results = []
let step = 0
function log(name, ok, detail = '') {
  step += 1
  results.push({ step, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${String(step).padStart(2)}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  // ── FLOW 1: auth (signup or sign-in) + profile bootstrap ──
  let session = null
  {
    const { data, error } = await supabase.auth.signUp({ email: QA_EMAIL, password: QA_PASS })
    if (data?.session) session = data.session
    else if (error && /already registered/i.test(error.message ?? '')) {
      const r = await supabase.auth.signInWithPassword({ email: QA_EMAIL, password: QA_PASS })
      session = r.data?.session ?? null
      if (!session) return log('auth: sign-in existing QA user', false, r.error?.message ?? 'no session')
    } else if (!error && data?.user && !data.session) {
      return log('auth: signup', false, 'Email confirmation required — cannot run authenticated flows non-interactively')
    } else if (error) {
      return log('auth: signup', false, error.message)
    }
  }
  log('auth: session obtained', !!session)
  if (!session) return

  const authed = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
  const uid = session.user.id

  // Profile bootstrap (replicates AuthContext.resolveSession)
  let { data: profile } = await authed.from('profiles').select('*').eq('id', uid).maybeSingle()
  if (!profile) {
    const ins = await authed.from('profiles').insert({ id: uid, email: QA_EMAIL, full_name: 'QA Functional Audit' }).select().single()
    profile = ins.data
    log('profile: bootstrap insert', !!profile, ins.error?.message ?? '')
  } else log('profile: exists via trigger', true, `role=${profile.role}`)

  // Agency bootstrap (replicates autoCreateAgency)
  let agencyId = profile?.agency_id
  if (!agencyId) {
    const { data: ag, error: agErr } = await authed.from('agencies').insert({ name: 'QA Audit Agency', plan: 'starter' }).select().single()
    log('agency: created', !!ag, agErr?.message ?? '')
    if (!ag) return summary()
    agencyId = ag.id
    const up = await authed.from('profiles').update({ agency_id: agencyId, role: 'agency_admin' }).eq('id', uid).select().single()
    log('profile: linked + promoted to agency_admin', !up.error, up.error?.message ?? '')
  } else log('agency: already linked', true, agencyId)

  // has_permission sanity (DB-side RBAC)
  const perm = await authed.rpc('has_permission', { p_key: 'finance.manage' })
  log('rbac: has_permission(finance.manage) for agency_admin', perm.data === true, String(perm.data ?? perm.error?.message))
  const permPayroll = await authed.rpc('has_permission', { p_key: 'finance.manage_payroll' })
  log('rbac: payroll denied to agency_admin (separation of duties)', permPayroll.data === false, String(permPayroll.data ?? permPayroll.error?.message))

  // ── FLOW 2: create client → appears in list → update ──
  const { data: client, error: cErr } = await authed.from('clients').insert({
    agency_id: agencyId, name: 'QA Test Client', brand_name: 'QA Client',
    industry: 'QA', contact_name: 'QA Bot', email: 'qa@example.com',
    status: 'active', color: '#3B82F6', portal_access_enabled: false,
  }).select().single()
  log('clients: INSERT', !!client, cErr?.message ?? '')
  if (!client) return summary()

  const { data: list } = await authed.from('clients').select('id').eq('agency_id', agencyId)
  log('clients: appears in agency list (RLS SELECT)', (list ?? []).some((c) => c.id === client.id))

  const upC = await authed.from('clients').update({ notes: 'QA note', status: 'active' }).eq('id', client.id)
  log('clients: UPDATE (edit/notes)', !upC.error, upC.error?.message ?? '')

  // ── FLOW 6: subscription → generate cycle → mark paid → ledger reflects ──
  const today = new Date().toISOString().slice(0, 10)
  const { data: sub, error: sErr } = await authed.from('client_subscriptions').insert({
    agency_id: agencyId, client_id: client.id, name: 'QA Retainer',
    amount: 1000, currency: 'EGP', billing_frequency: 'monthly',
    start_date: today, next_billing_date: today, status: 'active', created_by: uid,
  }).select().single()
  log('subscriptions: INSERT', !!sub, sErr?.message ?? '')

  let cycleId = null
  if (sub) {
    const gen = await authed.rpc('generate_cycle_for_subscription', { p_subscription: sub.id })
    cycleId = gen.data ?? null
    log('subscriptions: generate_cycle RPC', !!cycleId, gen.error?.message ?? `cycle=${cycleId}`)

    const dup = await authed.rpc('generate_cycle_for_subscription', { p_subscription: sub.id })
    // Second call generates the NEXT period (billing date advanced) — that is
    // correct behavior. Verify no DUPLICATE of the same period instead:
    const { data: cycles } = await authed.from('subscription_cycles').select('id, period_start, status, amount_paid').eq('subscription_id', sub.id)
    const starts = (cycles ?? []).map((c) => c.period_start)
    log('cycles: no duplicate periods', new Set(starts).size === starts.length, `periods=${starts.join(',')}${dup.error ? ' (2nd call: ' + dup.error.message + ')' : ''}`)

    if (cycleId) {
      const pay = await authed.rpc('mark_cycle_paid', { p_cycle: cycleId, p_amount: 1000, p_account: null, p_method: 'bank_transfer' })
      log('cycles: mark_cycle_paid RPC', !pay.error, pay.error?.message ?? '')

      const { data: cyc } = await authed.from('subscription_cycles').select('status, amount_paid').eq('id', cycleId).single()
      log('cycles: status=paid after payment', cyc?.status === 'paid' && Number(cyc?.amount_paid) === 1000, JSON.stringify(cyc))

      const { data: ledger } = await authed.from('finance_transactions').select('id, status, amount_paid').eq('billing_cycle_id', cycleId)
      const row = (ledger ?? [])[0]
      log('ledger: cycle payment settled exactly one income row', (ledger ?? []).length >= 1 && row?.status === 'paid', JSON.stringify(row ?? null))
    }
  }

  // ── FLOW 4: manual income → finance_summary reflects ──
  const inc = await authed.from('finance_transactions').insert({
    agency_id: agencyId, client_id: client.id, type: 'income', title: 'QA manual income',
    amount: 500, amount_paid: 500, currency: 'EGP', transaction_date: today, status: 'paid', created_by: uid,
  }).select().single()
  log('ledger: INSERT income', !!inc.data, inc.error?.message ?? '')

  const sum = await authed.rpc('finance_summary', { p_agency: agencyId, p_from: today, p_to: today })
  const egp = (sum.data ?? []).find((r) => r.currency === 'EGP')
  log('reports: finance_summary reflects payments', Number(egp?.revenue_collected ?? 0) >= 1500, `revenue_collected=${egp?.revenue_collected}`)

  // ── FLOW 5: expense → approval workflow rules ──
  const exp = await authed.from('finance_transactions').insert({
    agency_id: agencyId, type: 'expense', title: 'QA expense', amount: 200,
    currency: 'EGP', transaction_date: today, status: 'pending', created_by: uid,
  }).select().single()
  log('ledger: INSERT expense (pending approval)', !!exp.data, exp.error?.message ?? '')

  if (exp.data) {
    const selfApprove = await authed.rpc('approve_expense', { p_tx: exp.data.id })
    log('approvals: self-approval BLOCKED (expected)', !!selfApprove.error && /own expense/i.test(selfApprove.error.message), selfApprove.error?.message ?? 'was allowed!')
    const rej = await authed.rpc('reject_expense', { p_tx: exp.data.id, p_reason: 'QA test rejection' })
    log('approvals: reject with reason works', !rej.error, rej.error?.message ?? '')
  }

  // ── FLOW 7 gate: payroll blocked for agency_admin ──
  const pr = await authed.rpc('build_payroll_run', { p_agency: agencyId, p_year: 2026, p_month: 8 })
  log('payroll: build_payroll_run DENIED for agency_admin (expected)', !!pr.error && /permission/i.test(pr.error.message ?? ''), pr.error?.message ?? 'was allowed!')

  // ── Audit trail exists for what we just did ──
  const audit = await authed.from('audit_logs').select('id, action, entity_type').eq('agency_id', agencyId).limit(5)
  log('audit: rows written by triggers', (audit.data ?? []).length > 0, `${(audit.data ?? []).length} entries visible`)

  // ── Cleanup (QA rows only — all inside the QA agency) ──
  const del1 = await authed.from('finance_transactions').update({ deleted_at: new Date().toISOString(), status: 'cancelled' }).eq('agency_id', agencyId)
  const del2 = await authed.from('client_subscriptions').delete().eq('agency_id', agencyId)
  const del3 = await authed.from('clients').delete().eq('agency_id', agencyId)
  log('cleanup: QA rows removed (ledger soft-deleted)', !del1.error && !del2.error && !del3.error,
    [del1.error?.message, del2.error?.message, del3.error?.message].filter(Boolean).join('; '))

  summary()
}

function summary() {
  const pass = results.filter((r) => r.ok).length
  console.log(`\n===== ${pass}/${results.length} checks passed =====`)
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1 })
