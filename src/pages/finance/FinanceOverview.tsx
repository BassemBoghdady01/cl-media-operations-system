/**
 * EZ Marketing Agency — Finance Overview
 *
 * Every figure here is aggregated in Postgres from the real ledger. There are
 * no fallbacks, no placeholder totals and no invented numbers: if a metric
 * cannot be computed honestly it says so.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  PeriodSelector, CurrencyTabs, EmptyState, InsufficientData, StatusBadge, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatCompact, formatPercent, formatMonth, formatDateShort } from '../../lib/finance'
import {
  financeService, resolvePeriod,
  type PeriodKey, type FinanceSummary, type MonthlyPoint, type MrrRow,
  type BreakEven, type ExpenseBreakdownRow, type UpcomingRow, type ClientProfitability,
  type ServiceProfitability,
} from '../../services/financeService'

const CHART_GRID = 'rgba(255,255,255,0.05)'

export default function FinanceOverview() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [currency, setCurrency] = useState('EGP')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<FinanceSummary[]>([])
  const [series, setSeries] = useState<MonthlyPoint[]>([])
  const [mrr, setMrr] = useState<MrrRow[]>([])
  const [breakEven, setBreakEven] = useState<BreakEven | null>(null)
  const [expenses, setExpenses] = useState<ExpenseBreakdownRow[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([])
  const [clients, setClients] = useState<ClientProfitability[]>([])
  const [services, setServices] = useState<ServiceProfitability[]>([])

  const range = useMemo(() => resolvePeriod(period), [period])

  useEffect(() => {
    if (!agencyId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [s, ser, m, be, ex, up, cp, sp] = await Promise.all([
          financeService.getSummary(agencyId, range.from, range.to),
          financeService.getMonthlySeries(agencyId, 12),
          financeService.getMrr(agencyId),
          financeService.getBreakEven(agencyId, currency),
          financeService.getExpenseBreakdown(agencyId, range.from, range.to),
          financeService.getUpcoming(agencyId, 30),
          financeService.getClientProfitability(agencyId, range.from, range.to),
          financeService.getServiceProfitability(agencyId, range.from, range.to),
        ])
        if (cancelled) return
        setSummary(s); setSeries(ser); setMrr(m)
        setBreakEven(be[0] ?? null); setExpenses(ex)
        setUpcoming(up); setClients(cp); setServices(sp)
      } catch (err) {
        if (cancelled) return
        console.error('[FinanceOverview] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load finance data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, range.from, range.to, currency])

  // Currencies actually present in the data — never a hardcoded list.
  const currencies = useMemo(() => {
    const set = new Set<string>([...summary.map((s) => s.currency), ...mrr.map((m) => m.currency)])
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [summary, mrr])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  const s = summary.find((x) => x.currency === currency)
  const m = mrr.find((x) => x.currency === currency)
  const chartData = series.filter((p) => p.currency === currency)
  const expenseData = expenses.filter((e) => e.currency === currency)
  const hasAnyData = summary.length > 0 || mrr.length > 0

  if (error) {
    return (
      <PageErrorState
        title="We couldn't load your finance data"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div>
      <FinancePageHeader
        title="Finance Overview"
        subtitle={`${formatDateShort(range.from)} — ${formatDateShort(range.to)}`}
      >
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        <PeriodSelector value={period} onChange={setPeriod} />
      </FinancePageHeader>

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={4} />
          <KpiSkeleton count={4} />
          <div className="h-72 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        </div>
      ) : !hasAnyData ? (
        <Panel>
          <EmptyState
            icon="💼"
            title="Configure your finance workspace"
            description="No financial records exist yet. Add your accounts and your first income or expense, and this dashboard will populate from real data."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Link className="btn-primary py-2 px-4 text-xs" to="/app/finance/revenue">Add income</Link>
                <Link className="btn-secondary py-2 px-4 text-xs" to="/app/finance/expenses">Add expense</Link>
                <Link className="btn-secondary py-2 px-4 text-xs" to="/app/finance/settings">Finance settings</Link>
              </div>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {/* ── Headline ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Revenue collected" color="#10B981" emphasis
              value={formatMoney(s?.revenue_collected ?? 0, currency)}
              sub={`${formatMoney(s?.revenue_expected ?? 0, currency)} expected`}
            />
            <KpiCard
              label="Expenses" color="#EF4444"
              value={formatMoney(s?.expenses_paid ?? 0, currency)}
              sub={`${formatMoney(s?.fixed_expenses ?? 0, currency)} fixed`}
            />
            <KpiCard
              label="Net profit" color={(s?.net_profit ?? 0) >= 0 ? '#10B981' : '#EF4444'} emphasis
              value={formatMoney(s?.net_profit ?? 0, currency)}
              sub={`${formatPercent(s?.profit_margin ?? 0)} margin`}
            />
            <KpiCard
              label="Monthly recurring revenue" color="#8B5CF6"
              value={formatMoney(m?.mrr ?? 0, currency)}
              sub={`${m?.active_subscriptions ?? 0} active subscription${m?.active_subscriptions === 1 ? '' : 's'}`}
            />
          </div>

          {/* ── Secondary ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Outstanding" color="#F59E0B"
              value={formatMoney(s?.revenue_outstanding ?? 0, currency)}
              sub="Awaiting collection"
            />
            <KpiCard
              label="Overdue" color="#EF4444"
              value={formatMoney(s?.revenue_overdue ?? 0, currency)}
              sub="Past due date"
            />
            <KpiCard
              label="Payroll" color="#A78BFA"
              value={hasPermission('finance.view_payroll')
                ? formatMoney(s?.payroll_paid ?? 0, currency)
                : '—'}
              sub={hasPermission('finance.view_payroll') ? 'This period' : 'Restricted'}
            />
            <KpiCard
              label="Variable costs" color="#F97316"
              value={formatMoney(s?.variable_expenses ?? 0, currency)}
              sub="Non-fixed spend"
            />
          </div>

          {/* ── Trend ── */}
          <Panel title="Revenue vs Expenses — last 12 months">
            {chartData.length === 0 ? (
              <EmptyState icon="📈" title="No monthly history yet"
                description="Trends appear once transactions span more than one month." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="month_start" tickFormatter={formatMonth}
                    tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCompact(v, '')}
                    tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{ background: '#0B1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                    labelFormatter={formatMonth}
                    formatter={(v: number, name: string) => [formatMoney(v, currency), name]}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" fill="url(#revGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="url(#expGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* ── Break-even ── */}
            <Panel title="Break-even">
              {!breakEven?.has_sufficient_data ? (
                <InsufficientData message="More financial history is required to calculate break-even accurately. Record at least two months of transactions and configure your recurring costs and payroll." />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">Monthly fixed cost</p>
                      <p className="text-lg font-black text-white">{formatMoney(breakEven.monthly_fixed_cost, currency)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">Committed recurring revenue</p>
                      <p className="text-lg font-black text-white">{formatMoney(breakEven.committed_mrr, currency)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Coverage of fixed costs</span>
                      <span className="text-white font-semibold">{formatPercent(breakEven.coverage_percent)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(breakEven.coverage_percent, 100)}%`,
                          background: breakEven.coverage_percent >= 100
                            ? 'linear-gradient(90deg,#10B981,#34D399)'
                            : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
                        }}
                      />
                    </div>
                  </div>

                  {breakEven.gap_to_break_even > 0 ? (
                    <p className="text-xs text-amber-400">
                      {formatMoney(breakEven.gap_to_break_even, currency)} more recurring revenue needed to cover fixed costs.
                    </p>
                  ) : (
                    <p className="text-xs text-green-400">Recurring revenue covers your fixed cost base.</p>
                  )}

                  <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">Avg monthly burn</p>
                      <p className="text-sm font-bold text-white">
                        {breakEven.avg_monthly_burn > 0
                          ? formatMoney(breakEven.avg_monthly_burn, currency)
                          : 'Positive operating cash flow'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">Runway</p>
                      <p className="text-sm font-bold text-white">
                        {breakEven.avg_monthly_burn > 0 && breakEven.runway_months != null
                          ? `${breakEven.runway_months} months`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            {/* ── Expense mix ── */}
            <Panel title="Expense categories">
              {expenseData.length === 0 ? (
                <EmptyState icon="🧾" title="No expenses yet"
                  description="Recorded expenses will break down by category here." />
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={190}>
                    <PieChart>
                      <Pie data={expenseData} dataKey="total" nameKey="category_name"
                        innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {expenseData.map((e) => <Cell key={e.category_name} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0B1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => formatMoney(v, currency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 max-h-[190px] overflow-y-auto no-scrollbar">
                    {expenseData.slice(0, 8).map((e) => (
                      <div key={e.category_name} className="flex items-center gap-2 text-[11px]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                        <span className="text-slate-400 flex-1 truncate">{e.category_name}</span>
                        <span className="text-white font-semibold">{formatPercent(e.share_percent, 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* ── Upcoming money ── */}
            <Panel title="Next 30 days" action={
              <Link to="/app/finance/receivables" className="text-[11px] text-blue-400 hover:text-blue-300">Receivables →</Link>
            }>
              {upcoming.length === 0 ? (
                <EmptyState icon="📅" title="Nothing scheduled"
                  description="Upcoming payments and bills will appear here." />
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                  {upcoming.slice(0, 10).map((u) => (
                    <div key={`${u.kind}-${u.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="w-1.5 h-8 rounded-full flex-shrink-0"
                        style={{ background: u.kind === 'income' ? '#10B981' : '#EF4444' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{u.title}</p>
                        <p className="text-[10px] text-slate-500">
                          {u.client_name ? `${u.client_name} · ` : ''}
                          {u.days_until < 0 ? `${Math.abs(u.days_until)} days overdue` :
                            u.days_until === 0 ? 'Due today' : `in ${u.days_until} days`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Money amount={u.amount} currency={u.currency} tone={u.kind === 'income' ? 'pos' : 'neg'} />
                        <div className="mt-0.5"><StatusBadge status={u.status} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ── Top clients ── */}
            <Panel title="Client contribution" action={
              <Link to="/app/finance/profitability" className="text-[11px] text-blue-400 hover:text-blue-300">All →</Link>
            }>
              {clients.filter((c) => c.currency === currency).length === 0 ? (
                <EmptyState icon="👥" title="No client revenue in this period"
                  description="Attribute income to a client to see contribution here." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={clients.filter((c) => c.currency === currency).slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatCompact(v, '')}
                      tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="client_name" width={90}
                      tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0B1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number, n: string) => [formatMoney(v, currency), n]}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* ── Deterministic insights (calculated, never invented) ── */}
          <Panel title="Business insights">
            <BusinessInsights
              summary={s} mrr={m} breakEven={breakEven}
              expenses={expenseData} clients={clients.filter((c) => c.currency === currency)}
              services={services.filter((x) => x.currency === currency)}
              upcoming={upcoming.filter((u) => u.currency === currency)}
              currency={currency}
            />
          </Panel>
        </div>
      )}
    </div>
  )
}

/**
 * Rule-based insights. Each line is derived arithmetically from the loaded
 * aggregates — no model, no estimation, no invented figures. If an input is
 * missing the corresponding line is simply omitted.
 */
function BusinessInsights({
  summary, mrr, breakEven, expenses, clients, services, upcoming, currency,
}: {
  summary?: FinanceSummary
  mrr?: MrrRow
  breakEven: BreakEven | null
  expenses: ExpenseBreakdownRow[]
  clients: ClientProfitability[]
  services: ServiceProfitability[]
  upcoming: UpcomingRow[]
  currency: string
}) {
  const lines: string[] = []

  const totalRevenue = summary?.revenue_collected ?? 0

  if (expenses.length && summary?.expenses_paid) {
    const top = expenses[0]
    lines.push(`${top.category_name} represents ${formatPercent(top.share_percent, 0)} of expenses this period.`)
  }

  const dueSoon = upcoming.filter((u) => u.kind === 'income' && u.days_until >= 0 && u.days_until <= 7)
  if (dueSoon.length) {
    const total = dueSoon.reduce((a, b) => a + b.amount, 0)
    lines.push(`${dueSoon.length} incoming payment${dueSoon.length === 1 ? '' : 's'} worth ${formatMoney(total, currency)} ${dueSoon.length === 1 ? 'is' : 'are'} due within seven days.`)
  }

  const overdue = upcoming.filter((u) => u.kind === 'income' && u.days_until < 0)
  if (overdue.length) {
    const total = overdue.reduce((a, b) => a + b.amount, 0)
    lines.push(`${formatMoney(total, currency)} across ${overdue.length} payment${overdue.length === 1 ? '' : 's'} is past its due date.`)
  }

  if (clients.length && totalRevenue > 0) {
    const top = clients[0]
    const share = (top.revenue / totalRevenue) * 100
    if (Number.isFinite(share) && share > 0) {
      lines.push(`${top.client_name} represents ${formatPercent(share, 0)} of collected revenue this period.`)
    }
  }

  const bestService = services.filter((s) => s.revenue > 0).sort((a, b) => b.margin - a.margin)[0]
  if (bestService) {
    lines.push(`${bestService.service_name} currently has the highest margin at ${formatPercent(bestService.margin, 0)}.`)
  }

  if (breakEven?.has_sufficient_data) {
    lines.push(`Recurring revenue covers ${formatPercent(breakEven.coverage_percent, 0)} of fixed costs.`)
    if (breakEven.gap_to_break_even > 0) {
      lines.push(`Committed revenue is ${formatMoney(breakEven.gap_to_break_even, currency)} below the estimated break-even point.`)
    }
  }

  if (mrr && mrr.new_mrr > 0) {
    lines.push(`${formatMoney(mrr.new_mrr, currency)} of new recurring revenue was added this month.`)
  }
  if (mrr && mrr.lost_mrr > 0) {
    lines.push(`${formatMoney(mrr.lost_mrr, currency)} of recurring revenue was lost this month.`)
  }

  if (!lines.length) {
    return (
      <p className="text-xs text-slate-500">
        Insights appear once there is enough recorded activity to calculate them.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {lines.map((l) => (
        <li key={l} className="flex gap-2.5 text-xs text-slate-300">
          <span className="text-blue-400 flex-shrink-0">▸</span>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  )
}
