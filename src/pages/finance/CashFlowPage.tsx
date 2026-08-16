/**
 * EZ Marketing Agency — Cash Flow
 *
 * Actual cash movement per account for a period, computed in Postgres from
 * settled amounts only (finance_cashflow). Currencies are never combined:
 * every figure on screen belongs to the selected currency tab. `outflow`
 * already includes payroll — payroll_out is shown as its labelled subset.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  PeriodSelector, CurrencyTabs, EmptyState, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatCompact, formatMonth, formatDateShort } from '../../lib/finance'
import {
  financeService, resolvePeriod,
  type PeriodKey, type CashflowRow, type MonthlyPoint,
} from '../../services/financeService'

const CHART_GRID = 'rgba(255,255,255,0.05)'
const TOOLTIP_STYLE = {
  background: '#0B1220',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  fontSize: 12,
} as const

/** Tiny inline legend dot — identity is never carried by color alone in tooltips only. */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function CashFlowPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canViewPayroll = hasPermission('finance.view_payroll')

  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [currency, setCurrency] = useState('EGP')
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rows, setRows] = useState<CashflowRow[]>([])
  const [series, setSeries] = useState<MonthlyPoint[]>([])

  const range = useMemo(() => resolvePeriod(period), [period])

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [cf, ser] = await Promise.all([
        financeService.getCashflow(agencyId, range.from, range.to),
        financeService.getMonthlySeries(agencyId, 12, currency),
      ])
      setRows(cf)
      setSeries(ser)
    } catch (err) {
      console.error('[CashFlow] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load cash flow data.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, range.from, range.to, currency])

  useEffect(() => { load() }, [load])

  // Currencies actually present in the data — never a hardcoded list.
  const currencies = useMemo(() => {
    const set = new Set(rows.map((r) => r.currency))
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [rows])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  // The account filter belongs to a single currency's accounts.
  useEffect(() => { setAccountId('') }, [currency])

  const currencyRows = useMemo(
    () => rows.filter((r) => r.currency === currency),
    [rows, currency]
  )
  const visibleRows = useMemo(
    () => (accountId ? currencyRows.filter((r) => r.account_id === accountId) : currencyRows),
    [currencyRows, accountId]
  )

  // KPI totals — summed only within the selected currency (and account filter).
  const totals = useMemo(() => {
    const t = { opening: 0, inflow: 0, outflow: 0, payroll: 0, net: 0, closing: 0 }
    for (const r of visibleRows) {
      t.opening += Number(r.opening_balance)
      t.inflow += Number(r.inflow)
      t.outflow += Number(r.outflow)
      t.payroll += Number(r.payroll_out)
      t.net += Number(r.net_flow)
      t.closing += Number(r.closing_balance)
    }
    return t
  }, [visibleRows])

  const chartData = useMemo(
    () => series.filter((p) => p.currency === currency),
    [series, currency]
  )

  if (error) {
    return <PageErrorState title="We couldn't load cash flow" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Cash Flow"
        subtitle={`Settled money in and out per account · ${formatDateShort(range.from)} — ${formatDateShort(range.to)}`}
      >
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        <PeriodSelector value={period} onChange={setPeriod} />
        {currencyRows.length > 1 && (
          <select
            className="input py-2 text-sm max-w-[200px]"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Filter by account"
          >
            <option value="">All accounts</option>
            {currencyRows.map((r) => (
              <option key={r.account_id} value={r.account_id}>{r.account_name}</option>
            ))}
          </select>
        )}
      </FinancePageHeader>

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={6} />
          <Panel><FinanceSkeleton rows={4} /></Panel>
          <div className="h-72 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        </div>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon="🏦"
            title="No accounts to track yet"
            description="Cash flow is computed from transactions linked to a finance account. Create your accounts in Finance settings and attribute income and expenses to them — this page will populate from real settled amounts."
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {/* ── KPIs for the selected currency ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              label="Opening balance" color="#38BDF8"
              value={formatMoney(totals.opening, currency)}
              sub={`${visibleRows.length} account${visibleRows.length === 1 ? '' : 's'}`}
            />
            <KpiCard
              label="Income" color="#10B981"
              value={formatMoney(totals.inflow, currency)}
              sub="Cash received"
            />
            <KpiCard
              label="Expenses" color="#EF4444"
              value={formatMoney(totals.outflow, currency)}
              sub="Cash paid out"
            />
            <KpiCard
              label="Payroll" color="#A78BFA"
              value={canViewPayroll ? formatMoney(totals.payroll, currency) : '—'}
              sub={canViewPayroll ? 'Included in expenses' : 'Restricted'}
            />
            <KpiCard
              label="Net flow" color={totals.net >= 0 ? '#10B981' : '#EF4444'} emphasis
              value={formatMoney(totals.net, currency)}
              sub="Income − expenses"
            />
            <KpiCard
              label="Closing balance" color="#3B82F6" emphasis
              value={formatMoney(totals.closing, currency)}
              sub={`As of ${formatDateShort(range.to)}`}
            />
          </div>

          {/* ── Per-account movement ── */}
          <Panel title="Movement by account">
            {visibleRows.length === 0 ? (
              <EmptyState
                icon="🏦"
                title={`No ${currency} accounts`}
                description="No active accounts hold this currency. Switch currency or adjust the account filter."
              />
            ) : (
              <DataTable minWidth={760} columns={[
                { key: 'account', label: 'Account' },
                { key: 'type', label: 'Type' },
                { key: 'opening', label: 'Opening', align: 'right' },
                { key: 'inflow', label: 'Inflow', align: 'right' },
                { key: 'outflow', label: 'Outflow', align: 'right' },
                { key: 'net', label: 'Net', align: 'right' },
                { key: 'closing', label: 'Closing', align: 'right' },
              ]}>
                {visibleRows.map((r) => (
                  <tr key={r.account_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{r.account_name}</td>
                    <td className="py-3 text-xs text-slate-400 capitalize">{r.type}</td>
                    <td className="py-3 text-right text-xs text-slate-300">{formatMoney(Number(r.opening_balance), r.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.inflow)} currency={r.currency} tone="pos" /></td>
                    <td className="py-3 text-right"><Money amount={Number(r.outflow)} currency={r.currency} tone="neg" /></td>
                    <td className="py-3 text-right"><Money amount={Number(r.net_flow)} currency={r.currency} tone="auto" /></td>
                    <td className="py-3 text-right"><Money amount={Number(r.closing_balance)} currency={r.currency} /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>

          {/* ── Monthly history for the selected currency ── */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Panel
              title={`Inflow vs outflow — last 12 months (${currency})`}
              action={
                <div className="flex items-center gap-3">
                  <LegendDot color="#10B981" label="Inflow" />
                  <LegendDot color="#EF4444" label="Outflow" />
                </div>
              }
            >
              {chartData.length === 0 ? (
                <EmptyState icon="📊" title="No monthly history yet"
                  description="Monthly bars appear once settled transactions exist in this currency." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="month_start" tickFormatter={formatMonth}
                      tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCompact(v, '')}
                      tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={formatMonth}
                      formatter={(v: number, name: string) => [formatMoney(v, currency), name]}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="revenue" name="Inflow" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Outflow" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title={`Net cash flow trend (${currency})`}>
              {chartData.length === 0 ? (
                <EmptyState icon="📈" title="No trend yet"
                  description="The net flow trend appears once transactions span more than one month." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="netFlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="month_start" tickFormatter={formatMonth}
                      tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCompact(v, '')}
                      tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={formatMonth}
                      formatter={(v: number) => [formatMoney(v, currency), 'Net flow']}
                    />
                    <Area type="monotone" dataKey="profit" name="Net flow"
                      stroke="#3B82F6" fill="url(#netFlowGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
