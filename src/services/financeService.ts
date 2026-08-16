/**
 * EZ Marketing Agency — Finance Service
 *
 * PRODUCTION ONLY. Unlike the older operational services, nothing here falls
 * back to seed data. A failed query THROWS so the page can show an honest error
 * state — silently returning fabricated numbers is unacceptable in accounting.
 *
 * Heavy aggregation runs in Postgres (see 007_finance_functions.sql). We never
 * pull thousands of ledger rows into the browser to add them up.
 */

import { supabase, isSupabaseReady } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund' | 'adjustment'

export type TransactionStatus =
  | 'draft' | 'expected' | 'pending' | 'approved' | 'paid'
  | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded'

export interface FinanceTransaction {
  id: string
  agency_id: string
  account_id: string | null
  category_id: string | null
  client_id: string | null
  project_id: string | null
  service_id: string | null
  invoice_id: string | null
  subscription_id: string | null
  type: TransactionType
  title: string
  description: string | null
  amount: number
  amount_paid: number
  currency: string
  transaction_date: string
  due_date: string | null
  paid_at: string | null
  status: TransactionStatus
  payment_method: string | null
  vendor: string | null
  reference: string | null
  attachment_url: string | null
  is_recurring: boolean
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface FinanceSummary {
  currency: string
  revenue_collected: number
  revenue_expected: number
  revenue_outstanding: number
  revenue_overdue: number
  expenses_paid: number
  expenses_expected: number
  payroll_paid: number
  fixed_expenses: number
  variable_expenses: number
  net_profit: number
  profit_margin: number
  transaction_count: number
}

export interface MonthlyPoint {
  month_start: string
  currency: string
  revenue: number
  expenses: number
  profit: number
}

export interface MrrRow {
  currency: string
  mrr: number
  active_subscriptions: number
  new_mrr: number
  lost_mrr: number
}

export interface ReceivableRow {
  client_id: string
  client_name: string
  currency: string
  total_billed: number
  total_paid: number
  outstanding: number
  overdue_amount: number
  oldest_due_date: string | null
  days_overdue: number
  open_items: number
}

export interface ProfitabilityRow {
  currency: string
  revenue: number
  profit: number
  margin: number
}

export interface ClientProfitability extends ProfitabilityRow {
  client_id: string
  client_name: string
  direct_cost: number
  active_projects: number
  subscription_value: number
}

export interface ProjectProfitability extends ProfitabilityRow {
  project_id: string
  project_name: string
  client_name: string
  status: string
  cost: number
}

export interface ServiceProfitability extends ProfitabilityRow {
  service_id: string
  service_name: string
  cost: number
}

export interface ExpenseBreakdownRow {
  category_id: string | null
  category_name: string
  cost_type: string
  color: string
  currency: string
  total: number
  share_percent: number
  item_count: number
}

export interface AccountBalance {
  account_id: string
  account_name: string
  type: string
  currency: string
  opening_balance: number
  inflow: number
  outflow: number
  current_balance: number
}

export interface BreakEven {
  currency: string
  monthly_fixed_cost: number
  monthly_payroll: number
  avg_monthly_revenue: number
  committed_mrr: number
  break_even_revenue: number
  gap_to_break_even: number
  coverage_percent: number
  avg_monthly_burn: number
  cash_available: number
  runway_months: number | null
  months_of_history: number
  has_sufficient_data: boolean
}

export interface ForecastRow {
  month_start: string
  committed_revenue: number
  projected_revenue: number
  committed_expenses: number
  projected_expenses: number
  expected_net: number
  is_actual: boolean
}

export interface UpcomingRow {
  kind: 'income' | 'expense'
  id: string
  title: string
  client_name: string | null
  amount: number
  currency: string
  due_date: string
  days_until: number
  status: string
}

export interface FinanceAccount {
  id: string
  agency_id: string
  name: string
  type: string
  currency: string
  opening_balance: number
  status: string
}

export interface FinanceCategory {
  id: string
  agency_id: string
  name: string
  kind: 'income' | 'expense'
  cost_type: 'fixed' | 'variable' | 'none'
  is_payroll: boolean
  color: string
  status: string
}

export interface AgencyService {
  id: string
  agency_id: string
  name: string
  category: string | null
  default_price: number | null
  currency: string
  status: string
}

export interface FinanceSettings {
  agency_id: string
  base_currency: string
  fiscal_year_start_month: number
  monthly_revenue_target: number | null
  monthly_profit_target: number | null
  mrr_target: number | null
  new_client_target: number | null
  default_reminder_days: number[]
  require_expense_approval: boolean
  expense_approval_threshold: number | null
  onboarding_completed: boolean
  onboarding_steps: Record<string, boolean>
}

export interface RecurringExpense {
  id: string
  agency_id: string
  category_id: string | null
  account_id: string | null
  title: string
  vendor: string | null
  description: string | null
  amount: number
  currency: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  start_date: string
  next_due_date: string
  end_date: string | null
  auto_generate: boolean
  reminder_days_before: number
  status: 'active' | 'paused' | 'ended'
}

export interface CashflowRow {
  account_id: string
  account_name: string
  type: string
  currency: string
  opening_balance: number
  inflow: number
  outflow: number
  payroll_out: number
  net_flow: number
  closing_balance: number
}

export interface FinancialPeriod {
  id: string
  agency_id: string
  year: number
  month: number
  status: 'open' | 'closed'
  closed_by: string | null
  closed_at: string | null
  reopened_by: string | null
  reopened_at: string | null
  notes: string | null
}

// ─── Internals ────────────────────────────────────────────────────────────────

class FinanceError extends Error {
  constructor(operation: string, cause: unknown) {
    const detail =
      typeof cause === 'object' && cause && 'message' in cause
        ? String((cause as { message: unknown }).message)
        : String(cause)
    super(`${operation} failed: ${detail}`)
    this.name = 'FinanceError'
  }
}

function db() {
  if (!isSupabaseReady || !supabase) {
    throw new Error(
      'Finance requires a configured Supabase connection. ' +
        'Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_ENABLE_REAL_AUTH=true.'
    )
  }
  return supabase
}

/** Calls a Postgres aggregation function. RLS applies to the caller. */
async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db().rpc(fn, params)
  if (error) throw new FinanceError(fn, error)
  return (data ?? []) as T[]
}

/** ISO date (YYYY-MM-DD) for a Date, in local time. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export type PeriodKey =
  | 'this_month' | 'last_month' | 'last_3_months'
  | 'this_quarter' | 'this_year' | 'custom'

export function resolvePeriod(key: PeriodKey, custom?: { from: string; to: string }) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (key) {
    case 'this_month':
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) }
    case 'last_month':
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) }
    case 'last_3_months':
      return { from: isoDate(new Date(y, m - 2, 1)), to: isoDate(new Date(y, m + 1, 0)) }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3
      return { from: isoDate(new Date(y, qStart, 1)), to: isoDate(new Date(y, qStart + 3, 0)) }
    }
    case 'this_year':
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) }
    case 'custom':
      return custom ?? { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) }
  }
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  this_quarter: 'This quarter',
  this_year: 'This year',
  custom: 'Custom range',
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const financeService = {
  // ── Aggregates (computed in Postgres) ──
  getSummary: (agencyId: string, from: string, to: string) =>
    rpc<FinanceSummary>('finance_summary', { p_agency: agencyId, p_from: from, p_to: to }),

  getMonthlySeries: (agencyId: string, months = 12, currency?: string) =>
    rpc<MonthlyPoint>('finance_monthly_series', {
      p_agency: agencyId, p_months: months, p_currency: currency ?? null,
    }),

  getMrr: (agencyId: string) => rpc<MrrRow>('finance_mrr', { p_agency: agencyId }),

  getReceivables: (agencyId: string) =>
    rpc<ReceivableRow>('finance_receivables', { p_agency: agencyId }),

  getClientProfitability: (agencyId: string, from: string, to: string) =>
    rpc<ClientProfitability>('finance_client_profitability', {
      p_agency: agencyId, p_from: from, p_to: to,
    }),

  getProjectProfitability: (agencyId: string, from: string, to: string) =>
    rpc<ProjectProfitability>('finance_project_profitability', {
      p_agency: agencyId, p_from: from, p_to: to,
    }),

  getServiceProfitability: (agencyId: string, from: string, to: string) =>
    rpc<ServiceProfitability>('finance_service_profitability', {
      p_agency: agencyId, p_from: from, p_to: to,
    }),

  getExpenseBreakdown: (agencyId: string, from: string, to: string) =>
    rpc<ExpenseBreakdownRow>('finance_expense_breakdown', {
      p_agency: agencyId, p_from: from, p_to: to,
    }),

  getAccountBalances: (agencyId: string) =>
    rpc<AccountBalance>('finance_account_balances', { p_agency: agencyId }),

  getBreakEven: (agencyId: string, currency = 'EGP') =>
    rpc<BreakEven>('finance_break_even', { p_agency: agencyId, p_currency: currency }),

  getForecast: (agencyId: string, months = 6, currency = 'EGP') =>
    rpc<ForecastRow>('finance_forecast', {
      p_agency: agencyId, p_months: months, p_currency: currency,
    }),

  getUpcoming: (agencyId: string, days = 30) =>
    rpc<UpcomingRow>('finance_upcoming', { p_agency: agencyId, p_days: days }),

  // ── Ledger ──
  listTransactions: async (
    agencyId: string,
    filters: {
      type?: TransactionType
      status?: TransactionStatus
      clientId?: string
      projectId?: string
      serviceId?: string
      categoryId?: string
      accountId?: string
      currency?: string
      from?: string
      to?: string
      search?: string
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ rows: FinanceTransaction[]; total: number }> => {
    let q = db()
      .from('finance_transactions')
      .select('*', { count: 'exact' })
      .eq('agency_id', agencyId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })

    if (filters.type) q = q.eq('type', filters.type)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.clientId) q = q.eq('client_id', filters.clientId)
    if (filters.projectId) q = q.eq('project_id', filters.projectId)
    if (filters.serviceId) q = q.eq('service_id', filters.serviceId)
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId)
    if (filters.accountId) q = q.eq('account_id', filters.accountId)
    if (filters.currency) q = q.eq('currency', filters.currency)
    if (filters.from) q = q.gte('transaction_date', filters.from)
    if (filters.to) q = q.lte('transaction_date', filters.to)
    if (filters.search) q = q.ilike('title', `%${filters.search}%`)

    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    q = q.range(offset, offset + limit - 1)

    const { data, error, count } = await q
    if (error) throw new FinanceError('listTransactions', error)
    return { rows: (data ?? []) as FinanceTransaction[], total: count ?? 0 }
  },

  createTransaction: async (payload: Partial<FinanceTransaction>): Promise<FinanceTransaction> => {
    const { data, error } = await db()
      .from('finance_transactions')
      .insert(payload)
      .select()
      .single()
    if (error) throw new FinanceError('createTransaction', error)
    return data as FinanceTransaction
  },

  updateTransaction: async (id: string, updates: Partial<FinanceTransaction>): Promise<void> => {
    const { error } = await db().from('finance_transactions').update(updates).eq('id', id)
    if (error) throw new FinanceError('updateTransaction', error)
  },

  /** Soft delete — preserves the audit trail and closed-period totals. */
  archiveTransaction: async (id: string): Promise<void> => {
    const { error } = await db()
      .from('finance_transactions')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .eq('id', id)
    if (error) throw new FinanceError('archiveTransaction', error)
  },

  recordPayment: async (id: string, amountPaid: number, paidAt?: string): Promise<void> => {
    // The DB trigger derives status from amount_paid, so we only send the amount.
    const { error } = await db()
      .from('finance_transactions')
      .update({ amount_paid: amountPaid, paid_at: paidAt ?? new Date().toISOString() })
      .eq('id', id)
    if (error) throw new FinanceError('recordPayment', error)
  },

  // ── Configuration ──
  listAccounts: async (agencyId: string): Promise<FinanceAccount[]> => {
    const { data, error } = await db()
      .from('finance_accounts').select('*')
      .eq('agency_id', agencyId).eq('status', 'active').order('name')
    if (error) throw new FinanceError('listAccounts', error)
    return (data ?? []) as FinanceAccount[]
  },

  listCategories: async (agencyId: string, kind?: 'income' | 'expense'): Promise<FinanceCategory[]> => {
    let q = db().from('finance_categories').select('*')
      .eq('agency_id', agencyId).eq('status', 'active').order('name')
    if (kind) q = q.eq('kind', kind)
    const { data, error } = await q
    if (error) throw new FinanceError('listCategories', error)
    return (data ?? []) as FinanceCategory[]
  },

  listServices: async (agencyId: string): Promise<AgencyService[]> => {
    const { data, error } = await db()
      .from('agency_services').select('*')
      .eq('agency_id', agencyId).eq('status', 'active').order('name')
    if (error) throw new FinanceError('listServices', error)
    return (data ?? []) as AgencyService[]
  },

  createAccount: async (payload: Partial<FinanceAccount>): Promise<FinanceAccount> => {
    const { data, error } = await db().from('finance_accounts').insert(payload).select().single()
    if (error) throw new FinanceError('createAccount', error)
    return data as FinanceAccount
  },

  updateAccount: async (id: string, updates: Partial<FinanceAccount>): Promise<void> => {
    const { error } = await db().from('finance_accounts').update(updates).eq('id', id)
    if (error) throw new FinanceError('updateAccount', error)
  },

  /** Accounts are never hard-deleted — the ledger references them. */
  archiveAccount: async (id: string): Promise<void> => {
    const { error } = await db().from('finance_accounts').update({ status: 'archived' }).eq('id', id)
    if (error) throw new FinanceError('archiveAccount', error)
  },

  createCategory: async (payload: Partial<FinanceCategory>): Promise<FinanceCategory> => {
    const { data, error } = await db().from('finance_categories').insert(payload).select().single()
    if (error) throw new FinanceError('createCategory', error)
    return data as FinanceCategory
  },

  updateCategory: async (id: string, updates: Partial<FinanceCategory>): Promise<void> => {
    const { error } = await db().from('finance_categories').update(updates).eq('id', id)
    if (error) throw new FinanceError('updateCategory', error)
  },

  archiveCategory: async (id: string): Promise<void> => {
    const { error } = await db().from('finance_categories').update({ status: 'archived' }).eq('id', id)
    if (error) throw new FinanceError('archiveCategory', error)
  },

  createAgencyService: async (payload: Partial<AgencyService>): Promise<AgencyService> => {
    const { data, error } = await db().from('agency_services').insert(payload).select().single()
    if (error) throw new FinanceError('createAgencyService', error)
    return data as AgencyService
  },

  updateAgencyService: async (id: string, updates: Partial<AgencyService>): Promise<void> => {
    const { error } = await db().from('agency_services').update(updates).eq('id', id)
    if (error) throw new FinanceError('updateAgencyService', error)
  },

  archiveAgencyService: async (id: string): Promise<void> => {
    const { error } = await db().from('agency_services').update({ status: 'archived' }).eq('id', id)
    if (error) throw new FinanceError('archiveAgencyService', error)
  },

  // ── Cash flow ──
  getCashflow: (agencyId: string, from: string, to: string) =>
    rpc<CashflowRow>('finance_cashflow', { p_agency: agencyId, p_from: from, p_to: to }),

  // ── Settings & targets ──
  getSettings: async (agencyId: string): Promise<FinanceSettings | null> => {
    const { data, error } = await db()
      .from('agency_finance_settings').select('*')
      .eq('agency_id', agencyId).maybeSingle()
    if (error) throw new FinanceError('getSettings', error)
    return (data as FinanceSettings) ?? null
  },

  updateSettings: async (agencyId: string, patch: Partial<FinanceSettings>): Promise<void> => {
    const { error } = await db()
      .from('agency_finance_settings')
      .upsert({ agency_id: agencyId, ...patch }, { onConflict: 'agency_id' })
    if (error) throw new FinanceError('updateSettings', error)
  },

  // ── Recurring company expenses ──
  listRecurringExpenses: async (agencyId: string): Promise<RecurringExpense[]> => {
    const { data, error } = await db()
      .from('recurring_expenses').select('*')
      .eq('agency_id', agencyId)
      .order('status').order('next_due_date')
    if (error) throw new FinanceError('listRecurringExpenses', error)
    return (data ?? []) as RecurringExpense[]
  },

  createRecurringExpense: async (payload: Partial<RecurringExpense> & { created_by?: string }): Promise<RecurringExpense> => {
    const { data, error } = await db().from('recurring_expenses').insert(payload).select().single()
    if (error) throw new FinanceError('createRecurringExpense', error)
    return data as RecurringExpense
  },

  updateRecurringExpense: async (id: string, updates: Partial<RecurringExpense>): Promise<void> => {
    const { error } = await db().from('recurring_expenses').update(updates).eq('id', id)
    if (error) throw new FinanceError('updateRecurringExpense', error)
  },

  // ── Expense approval workflow ──
  listPendingApprovals: async (agencyId: string): Promise<FinanceTransaction[]> => {
    const { data, error } = await db()
      .from('finance_transactions').select('*')
      .eq('agency_id', agencyId).eq('type', 'expense')
      .in('status', ['draft', 'pending'])
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
    if (error) throw new FinanceError('listPendingApprovals', error)
    return (data ?? []) as FinanceTransaction[]
  },

  submitForApproval: async (id: string): Promise<void> => {
    const { error } = await db()
      .from('finance_transactions').update({ status: 'pending' }).eq('id', id)
    if (error) throw new FinanceError('submitForApproval', error)
  },

  /** Permission-checked in the database (finance.approve_expenses). */
  approveExpense: async (id: string): Promise<void> => {
    const { error } = await db().rpc('approve_expense', { p_tx: id })
    if (error) throw new FinanceError('approveExpense', error)
  },

  rejectExpense: async (id: string, reason: string): Promise<void> => {
    const { error } = await db().rpc('reject_expense', { p_tx: id, p_reason: reason })
    if (error) throw new FinanceError('rejectExpense', error)
  },

  // ── Period close ──
  listPeriods: async (agencyId: string): Promise<FinancialPeriod[]> => {
    const { data, error } = await db()
      .from('financial_periods').select('*')
      .eq('agency_id', agencyId)
      .order('year', { ascending: false }).order('month', { ascending: false })
    if (error) throw new FinanceError('listPeriods', error)
    return (data ?? []) as FinancialPeriod[]
  },

  setPeriodStatus: async (
    agencyId: string, year: number, month: number, status: 'open' | 'closed',
    userId: string, reason?: string
  ): Promise<void> => {
    const stamp =
      status === 'closed'
        ? { closed_by: userId, closed_at: new Date().toISOString() }
        : { reopened_by: userId, reopened_at: new Date().toISOString() }

    const { error } = await db()
      .from('financial_periods')
      .upsert(
        { agency_id: agencyId, year, month, status, notes: reason ?? null, ...stamp },
        { onConflict: 'agency_id,year,month' }
      )
    if (error) throw new FinanceError('setPeriodStatus', error)
  },

  // ── Attachments (receipts, payment proofs) — private bucket, signed URLs ──
  uploadAttachment: async (agencyId: string, entity: string, file: File): Promise<string> => {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${agencyId}/${entity}/${Date.now()}-${safeName}`
    const { error } = await db().storage
      .from('finance-attachments')
      .upload(path, file, { upsert: false })
    if (error) throw new FinanceError('uploadAttachment', error)
    return `storage:${path}`
  },

  /** Resolves a stored attachment reference to a viewable URL (1h signed). */
  attachmentUrl: async (ref: string): Promise<string> => {
    if (!ref.startsWith('storage:')) return ref
    const { data, error } = await db().storage
      .from('finance-attachments')
      .createSignedUrl(ref.slice('storage:'.length), 3600)
    if (error) throw new FinanceError('attachmentUrl', error)
    return data.signedUrl
  },

  deleteAttachment: async (ref: string): Promise<void> => {
    if (!ref.startsWith('storage:')) return
    const { error } = await db().storage
      .from('finance-attachments')
      .remove([ref.slice('storage:'.length)])
    if (error) throw new FinanceError('deleteAttachment', error)
  },
}
