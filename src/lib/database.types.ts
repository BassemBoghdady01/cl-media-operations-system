/**
 * EZ Marketing Agency — Database row types
 *
 * Hand-maintained row shapes for the finance / RBAC tables added in
 * migrations 002–009, so no new table is handled as `unknown`/`any`.
 *
 * The Supabase client itself stays untyped (see lib/supabase.ts); services map
 * raw rows to these shapes (or to the camelCase app types in src/types). If
 * you later generate full types with
 *   npx supabase gen types typescript --project-id <ID>
 * they can replace this file, and the Database generic can be re-added.
 */

// ─── RBAC (002) ───────────────────────────────────────────────────────────────

export interface RolesRow {
  key: string
  label: string
  description: string | null
  level: number
  is_internal: boolean
  is_system: boolean
  created_at: string
}

export interface PermissionsRow {
  key: string
  module: string
  action: string
  description: string | null
  is_sensitive: boolean
  created_at: string
}

export interface RolePermissionsRow {
  role_key: string
  permission_key: string
}

export interface UserPermissionsRow {
  user_id: string
  permission_key: string
  granted: boolean
  granted_by: string | null
  created_at: string
}

// ─── Finance core (003) ───────────────────────────────────────────────────────

export interface AgencyServicesRow {
  id: string
  agency_id: string
  name: string
  category: string | null
  description: string | null
  default_price: number | null
  currency: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface FinanceAccountsRow {
  id: string
  agency_id: string
  name: string
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'gateway' | 'other'
  currency: string
  opening_balance: number
  institution: string | null
  account_ref: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface FinanceCategoriesRow {
  id: string
  agency_id: string
  name: string
  kind: 'income' | 'expense'
  cost_type: 'fixed' | 'variable' | 'none'
  is_payroll: boolean
  color: string | null
  is_system: boolean
  status: 'active' | 'archived'
  created_at: string
}

export interface FinancialPeriodsRow {
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
  created_at: string
}

export interface FinanceTransactionsRow {
  id: string
  agency_id: string
  account_id: string | null
  category_id: string | null
  client_id: string | null
  project_id: string | null
  service_id: string | null
  invoice_id: string | null
  subscription_id: string | null
  billing_cycle_id: string | null
  payroll_item_id: string | null
  recurring_source_id: string | null
  type: 'income' | 'expense' | 'transfer' | 'refund' | 'adjustment'
  title: string
  description: string | null
  amount: number
  currency: string
  amount_paid: number
  transaction_date: string
  due_date: string | null
  paid_at: string | null
  status:
    | 'draft' | 'expected' | 'pending' | 'approved' | 'paid'
    | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded'
  payment_method: string | null
  reference: string | null
  vendor: string | null
  attachment_url: string | null
  is_recurring: boolean
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AgencyFinanceSettingsRow {
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
  created_at: string
  updated_at: string
}

export interface AuditLogsRow {
  id: string
  agency_id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

// ─── Subscriptions & recurring (004) ─────────────────────────────────────────

export interface ClientSubscriptionsRow {
  id: string
  agency_id: string
  client_id: string
  package_id: string | null
  service_id: string | null
  name: string
  description: string | null
  amount: number
  currency: string
  billing_frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom'
  custom_interval_days: number | null
  start_date: string
  next_billing_date: string
  end_date: string | null
  billing_day: number | null
  auto_renew: boolean
  auto_generate_invoice: boolean
  grace_period_days: number
  reminder_days_before: number[]
  status: 'draft' | 'active' | 'paused' | 'overdue' | 'cancelled' | 'expired'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionCyclesRow {
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
  status: 'expected' | 'invoiced' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'written_off'
  invoice_id: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
}

export interface PaymentRemindersRow {
  id: string
  agency_id: string
  client_id: string | null
  subscription_id: string | null
  billing_cycle_id: string | null
  invoice_id: string | null
  type: 'upcoming' | 'due_today' | 'overdue' | 'final_notice'
  days_offset: number | null
  scheduled_for: string
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms'
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null
  error_message: string | null
  dedupe_key: string
  created_at: string
}

export interface RecurringExpensesRow {
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
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Payroll (005) ────────────────────────────────────────────────────────────

export interface EmployeeCompensationRow {
  id: string
  agency_id: string
  user_id: string
  base_salary: number
  currency: string
  employment_type: 'full_time' | 'part_time' | 'contractor' | 'freelancer' | 'intern'
  payment_day: number
  allowances_default: number
  deductions_default: number
  effective_from: string
  status: 'active' | 'ended'
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PayrollRunsRow {
  id: string
  agency_id: string
  year: number
  month: number
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled'
  currency: string
  total_amount: number
  headcount: number
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PayrollItemsRow {
  id: string
  payroll_run_id: string
  agency_id: string
  user_id: string
  base_salary: number
  bonus: number
  allowances: number
  deductions: number
  /** Generated column: base + bonus + allowances − deductions. */
  net_salary: number
  currency: string
  status: 'pending' | 'approved' | 'paid' | 'held' | 'cancelled'
  payment_date: string | null
  transaction_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
