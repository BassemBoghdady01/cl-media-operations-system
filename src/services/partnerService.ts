/**
 * Partners — ownership, capital, drawings and profit distribution (migration 011).
 *
 * Money rules (enforced in the database):
 *   • Partner movements are equity — never expenses — so P&L stays honest.
 *   • Movements tied to a finance account change that account's balance.
 *   • Balance due = allocated profit − payouts − drawings.
 */
import { db, orThrow, type Row } from './serviceCore'

export type PartnerKind = 'individual' | 'group'
export type PartnerTxType = 'capital_contribution' | 'capital_return' | 'drawing' | 'profit_payout' | 'advance_offset'
export type DistributionStatus = 'draft' | 'approved' | 'paid' | 'cancelled'

export interface Partner {
  id: string
  agency_id: string
  parent_id: string | null
  kind: PartnerKind
  name: string
  profile_id: string | null
  email: string | null
  phone: string | null
  share_percent: number
  /** Optional exact ownership units (e.g. 1 : 2 = exactly ⅓ : ⅔). When every
   *  active partner at one level has units, units decide the split and the
   *  database keeps share_percent in sync as a display value. */
  share_units?: number | null
  joined_on: string | null
  status: 'active' | 'exited'
  notes: string | null
}

export interface EffectiveShare {
  partner_id: string
  name: string
  group_id: string | null
  group_name: string | null
  own_share: number
  effective_percent: number
}

export interface PartnerBalance {
  partner_id: string
  currency: string
  capital_in: number
  capital_out: number
  net_capital: number
  profit_allocated: number
  profit_paid: number
  drawings: number
  balance_due: number
}

export interface PartnerTransaction {
  id: string
  partner_id: string
  type: PartnerTxType
  amount: number
  currency: string
  transaction_date: string
  account_id: string | null
  payment_method: string | null
  reference: string | null
  notes: string | null
  distribution_id: string | null
  created_at: string
}

export interface DistributionLine {
  id: string
  partner_id: string
  share_percent: number
  amount: number
}

export interface ProfitDistribution {
  id: string
  title: string
  period_start: string
  period_end: string
  currency: string
  revenue: number
  expenses: number
  net_profit: number
  reserve_percent: number
  distributable_amount: number
  is_manual_amount: boolean
  status: DistributionStatus
  notes: string | null
  approved_at: string | null
  created_at: string
  lines: DistributionLine[]
}

export const TX_LABELS: Record<PartnerTxType, string> = {
  capital_contribution: 'Capital in',
  capital_return: 'Capital returned',
  drawing: 'Drawing / advance',
  profit_payout: 'Profit payout',
  advance_offset: 'Advance recovered',
}

/** Types a person can record by hand (offsets are posted only by the payout RPC). */
export const MANUAL_TX_TYPES: PartnerTxType[] = ['capital_contribution', 'capital_return', 'drawing', 'profit_payout']

/**
 * Money direction from the company's point of view. An advance offset moves
 * no cash: it settles part of a profit share against an earlier drawing.
 */
export const TX_DIRECTION: Record<PartnerTxType, 'in' | 'out' | 'none'> = {
  capital_contribution: 'in',
  capital_return: 'out',
  drawing: 'out',
  profit_payout: 'out',
  advance_offset: 'none',
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

function mapPartner(r: Row): Partner {
  return {
    ...(r as Partner),
    share_percent: num(r.share_percent),
    share_units: r.share_units === null || r.share_units === undefined ? null : Number(r.share_units),
  }
}

export const partnerService = {
  // ─── Structure ──────────────────────────────────────────────────────────────
  listPartners: async (agencyId: string): Promise<Partner[]> => {
    const { data, error } = await db().from('partners').select('*')
      .eq('agency_id', agencyId).order('kind', { ascending: false }).order('share_percent', { ascending: false })
    orThrow('partnerService.listPartners', error)
    return (data ?? []).map(mapPartner)
  },

  savePartner: async (agencyId: string, p: Partial<Partner> & { id?: string }): Promise<void> => {
    const row = {
      agency_id: agencyId,
      parent_id: p.parent_id || null,
      kind: p.kind ?? 'individual',
      name: (p.name ?? '').trim(),
      profile_id: p.profile_id || null,
      email: p.email || null,
      phone: p.phone || null,
      share_percent: Number(p.share_percent ?? 0),
      joined_on: p.joined_on || null,
      status: p.status ?? 'active',
      notes: p.notes || null,
      ...(p.share_units !== undefined
        ? { share_units: p.share_units === null || !(Number(p.share_units) > 0) ? null : Number(p.share_units) }
        : {}),
    }
    const q = p.id
      ? db().from('partners').update(row).eq('id', p.id)
      : db().from('partners').insert(row)
    const { error } = await q
    orThrow('partnerService.savePartner', error)
  },

  deletePartner: async (id: string): Promise<void> => {
    const { error } = await db().from('partners').delete().eq('id', id)
    orThrow('partnerService.deletePartner', error)
  },

  effectiveShares: async (agencyId: string): Promise<EffectiveShare[]> => {
    const { data, error } = await db().rpc('partner_effective_shares', { p_agency: agencyId })
    orThrow('partnerService.effectiveShares', error)
    return (data ?? []).map((r: Row) => ({ ...r, own_share: num(r.own_share), effective_percent: num(r.effective_percent) }))
  },

  structureIssues: async (agencyId: string): Promise<string[]> => {
    const { data, error } = await db().rpc('partner_structure_issues', { p_agency: agencyId })
    orThrow('partnerService.structureIssues', error)
    return (data ?? []).map((r: Row) => r.issue as string)
  },

  balances: async (agencyId: string): Promise<PartnerBalance[]> => {
    const { data, error } = await db().rpc('partner_balances', { p_agency: agencyId })
    orThrow('partnerService.balances', error)
    return (data ?? []).map((r: Row) => ({
      partner_id: r.partner_id, currency: r.currency,
      capital_in: num(r.capital_in), capital_out: num(r.capital_out), net_capital: num(r.net_capital),
      profit_allocated: num(r.profit_allocated), profit_paid: num(r.profit_paid),
      drawings: num(r.drawings), balance_due: num(r.balance_due),
    }))
  },

  // ─── Equity ledger ──────────────────────────────────────────────────────────
  listTransactions: async (agencyId: string): Promise<PartnerTransaction[]> => {
    const { data, error } = await db().from('partner_transactions').select('*')
      .eq('agency_id', agencyId).is('deleted_at', null)
      .order('transaction_date', { ascending: false }).order('created_at', { ascending: false })
    orThrow('partnerService.listTransactions', error)
    return (data ?? []).map((r: Row) => ({ ...(r as PartnerTransaction), amount: num(r.amount) }))
  },

  addTransaction: async (agencyId: string, t: Partial<PartnerTransaction>): Promise<void> => {
    const { error } = await db().from('partner_transactions').insert({
      agency_id: agencyId,
      partner_id: t.partner_id,
      type: t.type,
      amount: t.amount,
      currency: t.currency ?? 'EGP',
      transaction_date: t.transaction_date,
      account_id: t.account_id || null,
      payment_method: t.payment_method || null,
      reference: t.reference || null,
      notes: t.notes || null,
      distribution_id: t.distribution_id || null,
    })
    orThrow('partnerService.addTransaction', error)
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const { error } = await db().from('partner_transactions')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    orThrow('partnerService.deleteTransaction', error)
  },

  // ─── Distributions ──────────────────────────────────────────────────────────
  listDistributions: async (agencyId: string): Promise<ProfitDistribution[]> => {
    const { data, error } = await db().from('profit_distributions')
      .select('*, lines:profit_distribution_lines(id, partner_id, share_percent, amount)')
      .eq('agency_id', agencyId).neq('status', 'cancelled')
      .order('period_start', { ascending: false })
    orThrow('partnerService.listDistributions', error)
    return (data ?? []).map((r: Row) => ({
      ...(r as ProfitDistribution),
      revenue: num(r.revenue), expenses: num(r.expenses), net_profit: num(r.net_profit),
      reserve_percent: num(r.reserve_percent), distributable_amount: num(r.distributable_amount),
      lines: (r.lines ?? []).map((l: Row) => ({ ...l, share_percent: num(l.share_percent), amount: num(l.amount) })),
    }))
  },

  createDistribution: async (args: {
    agencyId: string; from: string; to: string; currency: string
    reservePercent: number; amountOverride?: number | null; title?: string; notes?: string
  }): Promise<string> => {
    const { data, error } = await db().rpc('create_profit_distribution', {
      p_agency: args.agencyId, p_from: args.from, p_to: args.to, p_currency: args.currency,
      p_reserve_percent: args.reservePercent,
      p_amount_override: args.amountOverride ?? null,
      p_title: args.title || null, p_notes: args.notes || null,
    })
    orThrow('partnerService.createDistribution', error)
    return data as string
  },

  approveDistribution: async (id: string): Promise<void> => {
    const { error } = await db().rpc('approve_profit_distribution', { p_id: id })
    orThrow('partnerService.approveDistribution', error)
  },

  cancelDistribution: async (id: string): Promise<void> => {
    const { error } = await db().rpc('cancel_profit_distribution', { p_id: id })
    orThrow('partnerService.cancelDistribution', error)
  },

  payDistribution: async (id: string, accountId: string | null, method: string, date: string): Promise<number> => {
    const { data, error } = await db().rpc('pay_profit_distribution', {
      p_id: id, p_account: accountId, p_method: method, p_date: date,
    })
    orThrow('partnerService.payDistribution', error)
    return Number(data ?? 0)
  },

  /** Live preview of a period from the main ledger (same numbers the RPC snapshots). */
  periodSummary: async (agencyId: string, from: string, to: string) => {
    const { data, error } = await db().rpc('finance_summary', { p_agency: agencyId, p_from: from, p_to: to })
    orThrow('partnerService.periodSummary', error)
    return (data ?? []).map((r: Row) => ({
      currency: r.currency as string,
      revenue: num(r.revenue_collected),
      expenses: num(r.expenses_paid),
      net: num(r.net_profit),
    }))
  },
}
