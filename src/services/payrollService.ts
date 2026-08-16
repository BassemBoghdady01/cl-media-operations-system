/**
 * EZ Marketing Agency — Payroll & Compensation
 *
 * The most sensitive service in the system. RLS (006) means a caller without
 * finance.view_payroll receives zero rows regardless of what the UI requests.
 * Run building and posting go through the permission-checked RPCs (005/009):
 *   build_payroll_run  → assembles a draft from active compensation
 *   post_payroll_run   → writes approved ledger rows (skips already-posted)
 *   mark_payroll_paid  → posts if needed, then settles everything. Idempotent.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeCompensation {
  id: string
  agency_id: string
  user_id: string
  employee_name: string
  employee_email: string
  employee_role: string
  department: string | null
  base_salary: number
  currency: string
  employment_type: 'full_time' | 'part_time' | 'contractor' | 'freelancer' | 'intern'
  payment_day: number
  allowances_default: number
  deductions_default: number
  effective_from: string
  status: 'active' | 'ended'
  notes: string | null
}

export type PayrollRunStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled'

export interface PayrollRun {
  id: string
  agency_id: string
  year: number
  month: number
  status: PayrollRunStatus
  currency: string
  total_amount: number
  headcount: number
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface PayrollItem {
  id: string
  payroll_run_id: string
  agency_id: string
  user_id: string
  employee_name: string
  employee_email: string
  base_salary: number
  bonus: number
  allowances: number
  deductions: number
  net_salary: number
  currency: string
  status: 'pending' | 'approved' | 'paid' | 'held' | 'cancelled'
  payment_date: string | null
  transaction_id: string | null
  notes: string | null
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapCompensation(r: Row): EmployeeCompensation {
  return {
    id: r.id,
    agency_id: r.agency_id,
    user_id: r.user_id,
    employee_name: r.profiles?.full_name ?? '',
    employee_email: r.profiles?.email ?? '',
    employee_role: r.profiles?.role ?? '',
    department: r.profiles?.department ?? null,
    base_salary: Number(r.base_salary ?? 0),
    currency: r.currency ?? 'EGP',
    employment_type: r.employment_type ?? 'full_time',
    payment_day: Number(r.payment_day ?? 28),
    allowances_default: Number(r.allowances_default ?? 0),
    deductions_default: Number(r.deductions_default ?? 0),
    effective_from: dstr(r.effective_from),
    status: r.status ?? 'active',
    notes: r.notes ?? null,
  }
}

function mapItem(r: Row): PayrollItem {
  return {
    id: r.id,
    payroll_run_id: r.payroll_run_id,
    agency_id: r.agency_id,
    user_id: r.user_id,
    employee_name: r.profiles?.full_name ?? '',
    employee_email: r.profiles?.email ?? '',
    base_salary: Number(r.base_salary ?? 0),
    bonus: Number(r.bonus ?? 0),
    allowances: Number(r.allowances ?? 0),
    deductions: Number(r.deductions ?? 0),
    net_salary: Number(r.net_salary ?? 0),
    currency: r.currency ?? 'EGP',
    status: r.status ?? 'pending',
    payment_date: r.payment_date ? dstr(r.payment_date) : null,
    transaction_id: r.transaction_id ?? null,
    notes: r.notes ?? null,
  }
}

const COMP_SELECT = '*, profiles!employee_compensation_user_id_fkey(full_name, email, role, department)'
const ITEM_SELECT = '*, profiles!payroll_items_user_id_fkey(full_name, email)'

// ─── Service ──────────────────────────────────────────────────────────────────

export const payrollService = {
  // ── Compensation ──
  listCompensation: async (agencyId: string): Promise<EmployeeCompensation[]> => {
    const { data, error } = await db()
      .from('employee_compensation').select(COMP_SELECT)
      .eq('agency_id', agencyId)
      .order('status').order('effective_from', { ascending: false })
    orThrow('payrollService.listCompensation', error)
    return (data ?? []).map(mapCompensation)
  },

  upsertCompensation: async (payload: {
    id?: string
    agency_id: string
    user_id: string
    base_salary: number
    currency: string
    employment_type?: string
    payment_day?: number
    allowances_default?: number
    deductions_default?: number
    effective_from?: string
    status?: 'active' | 'ended'
    notes?: string | null
    created_by?: string
  }): Promise<void> => {
    const { id, ...rest } = payload
    if (id) {
      const { error } = await db().from('employee_compensation').update(rest).eq('id', id)
      orThrow('payrollService.updateCompensation', error)
    } else {
      const { error } = await db().from('employee_compensation').insert(rest)
      orThrow('payrollService.createCompensation', error)
    }
  },

  // ── Runs ──
  listRuns: async (agencyId: string): Promise<PayrollRun[]> => {
    const { data, error } = await db()
      .from('payroll_runs').select('*')
      .eq('agency_id', agencyId)
      .order('year', { ascending: false }).order('month', { ascending: false })
    orThrow('payrollService.listRuns', error)
    return (data ?? []) as PayrollRun[]
  },

  getRun: async (runId: string): Promise<PayrollRun | undefined> => {
    const { data, error } = await db()
      .from('payroll_runs').select('*').eq('id', runId).maybeSingle()
    orThrow('payrollService.getRun', error)
    return (data as PayrollRun) ?? undefined
  },

  listItems: async (runId: string): Promise<PayrollItem[]> => {
    const { data, error } = await db()
      .from('payroll_items').select(ITEM_SELECT)
      .eq('payroll_run_id', runId)
      .order('created_at')
    orThrow('payrollService.listItems', error)
    return (data ?? []).map(mapItem)
  },

  /** Build (or refresh) the run for a month from active compensation. */
  buildRun: async (agencyId: string, year: number, month: number): Promise<string> => {
    const { data, error } = await db().rpc('build_payroll_run', {
      p_agency: agencyId, p_year: year, p_month: month,
    })
    orThrow('payrollService.buildRun', error)
    return data as string
  },

  /** Edit bonus / allowances / deductions before approval. */
  updateItem: async (
    itemId: string,
    updates: { bonus?: number; allowances?: number; deductions?: number; notes?: string | null; status?: PayrollItem['status'] }
  ): Promise<void> => {
    const { error } = await db().from('payroll_items').update(updates).eq('id', itemId)
    orThrow('payrollService.updateItem', error)
  },

  setRunStatus: async (runId: string, status: PayrollRunStatus, userId?: string): Promise<void> => {
    const patch: Row = { status }
    if (status === 'approved') {
      patch.approved_by = userId ?? null
      patch.approved_at = new Date().toISOString()
    }
    const { error } = await db().from('payroll_runs').update(patch).eq('id', runId)
    orThrow('payrollService.setRunStatus', error)
  },

  /**
   * Pay the run: posts any unposted ledger rows, settles them, marks items and
   * the run paid. Safe to call twice — nothing double-posts.
   */
  markRunPaid: async (runId: string, accountId?: string): Promise<number> => {
    const { data, error } = await db().rpc('mark_payroll_paid', {
      p_run: runId, p_account: accountId ?? null,
    })
    orThrow('payrollService.markRunPaid', error)
    return Number(data ?? 0)
  },
}
