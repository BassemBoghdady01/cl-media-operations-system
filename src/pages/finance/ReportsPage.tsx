/**
 * EZ Marketing Agency — Financial Reports
 *
 * P&L, revenue, expenses, subscriptions and profitability reports over any
 * period, with a comparison against the immediately preceding period of equal
 * length. All aggregation happens in Postgres; nothing on this page is
 * estimated or invented — a metric that cannot be computed shows '—'.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  PeriodSelector, CurrencyTabs, EmptyState, DataTable, Money, StatusBadge,
} from '../../components/finance/FinanceKit'
import {
  formatMoney, formatCompact, formatPercent, formatMonth, formatDateShort,
  percentChange, toCsv, downloadCsv,
} from '../../lib/finance'
import {
  financeService, resolvePeriod, isoDate,
  type PeriodKey, type FinanceSummary, type MonthlyPoint, type MrrRow,
  type ExpenseBreakdownRow, type ClientProfitability,
  type ProjectProfitability, type ServiceProfitability,
} from '../../services/financeService'

const CHART_GRID = 'rgba(255,255,255,0.05)'
const TOOLTIP_STYLE = {
  background: '#0B1220',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  fontSize: 12,
} as const

const TABS = [
  { key: 'pnl', label: 'Profit & Loss' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects' },
  { key: 'services', label: 'Services' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** First / last day of the current month, as the default custom range. */
function defaultCustomRange() {
  const now = new Date()
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

export default function ReportsPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canViewPayroll = hasPermission('finance.view_payroll')

  const [tab, setTab] = useState<TabKey>('pnl')
  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [custom, setCustom] = useState(defaultCustomRange)
  const [currency, setCurrency] = useState('EGP')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<FinanceSummary[]>([])
  const [prevSummary, setPrevSummary] = useState<FinanceSummary[]>([])
  const [series, setSeries] = useState<MonthlyPoint[]>([])
  const [expenses, setExpenses] = useState<ExpenseBreakdownRow[]>([])
  const [mrr, setMrr] = useState<MrrRow[]>([])
  const [clients, setClients] = useState<ClientProfitability[]>([])
  const [projects, setProjects] = useState<ProjectProfitability[]>([])
  const [services, setServices] = useState<ServiceProfitability[]>([])

  // Current range — custom dates are normalised so from ≤ to.
  const range = useMemo(() => {
    const ordered = custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
    return resolvePeriod(period, ordered)
  }, [period, custom])

  // Previous period of equal length: shift the range back by its own duration.
  const prevRange = useMemo(() => {
    const from = new Date(`${range.from}T00:00:00`)
    const to = new Date(`${range.to}T00:00:00`)
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(prevTo)
    prevFrom.setDate(prevFrom.getDate() - (days - 1))
    return { from: isoDate(prevFrom), to: isoDate(prevTo) }
  }, [range.from, range.to])

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [s, ps, ser, ex, m, cp, pp, sp] = await Promise.all([
        financeService.getSummary(agencyId, range.from, range.to),
        financeService.getSummary(agencyId, prevRange.from, prevRange.to),
        financeService.getMonthlySeries(agencyId, 12, currency),
        financeService.getExpenseBreakdown(agencyId, range.from, range.to),
        financeService.getMrr(agencyId),
        financeService.getClientProfitability(agencyId, range.from, range.to),
        financeService.getProjectProfitability(agencyId, range.from, range.to),
        financeService.getServiceProfitability(agencyId, range.from, range.to),
      ])
      setSummary(s); setPrevSummary(ps); setSeries(ser); setExpenses(ex)
      setMrr(m); setClients(cp); setProjects(pp); setServices(sp)
    } catch (err) {
      console.error('[Reports] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load report data.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, range.from, range.to, prevRange.from, prevRange.to, currency])

  useEffect(() => { load() }, [load])

  // Currencies actually present in the data — never a hardcoded list.
  const currencies = useMemo(() => {
    const set = new Set<string>([
      ...summary.map((x) => x.currency),
      ...prevSummary.map((x) => x.currency),
      ...mrr.map((x) => x.currency),
      ...expenses.map((x) => x.currency),
      ...clients.map((x) => x.currency),
      ...projects.map((x) => x.currency),
      ...services.map((x) => x.currency),
    ])
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [summary, prevSummary, mrr, expenses, clients, projects, services])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  const s = summary.find((x) => x.currency === currency)
  const prev = prevSummary.find((x) => x.currency === currency)
  const m = mrr.find((x) => x.currency === currency)
  const chartData = series.filter((p) => p.currency === currency)
  const expenseRows = expenses.filter((e) => e.currency === currency)
  const clientRows = useMemo(
    () => clients.filter((c) => c.currency === currency).slice().sort((a, b) => Number(b.profit) - Number(a.profit)),
    [clients, currency]
  )
  const projectRows = useMemo(
    () => projects.filter((p) => p.currency === currency).slice().sort((a, b) => Number(b.profit) - Number(a.profit)),
    [projects, currency]
  )
  const serviceRows = useMemo(
    () => services.filter((x) => x.currency === currency).slice().sort((a, b) => Number(b.profit) - Number(a.profit)),
    [services, currency]
  )
  const topClientsByRevenue = useMemo(
    () => clients.filter((c) => c.currency === currency).slice().sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 10),
    [clients, currency]
  )

  // ── P&L statement (current vs previous) ────────────────────────────────────
  const grossCurrent = s ? Number(s.revenue_collected) - Number(s.variable_expenses) : null
  const grossPrev = prev ? Number(prev.revenue_collected) - Number(prev.variable_expenses) : null
  const grossMarginCurrent =
    s && Number(s.revenue_collected) > 0 ? ((grossCurrent as number) / Number(s.revenue_collected)) * 100 : null
  const grossMarginPrev =
    prev && Number(prev.revenue_collected) > 0 ? ((grossPrev as number) / Number(prev.revenue_collected)) * 100 : null

  interface PnlLine {
    key: string
    label: string
    kind: 'money' | 'percent'
    current: number | null
    previous: number | null
    /** For cost lines an increase is unfavourable. */
    invert?: boolean
    emphasis?: boolean
    restricted?: boolean
  }

  const pnlLines: PnlLine[] = [
    { key: 'revenue', label: 'Revenue (collected)', kind: 'money',
      current: s ? Number(s.revenue_collected) : null, previous: prev ? Number(prev.revenue_collected) : null },
    { key: 'direct', label: 'Direct costs (variable)', kind: 'money', invert: true,
      current: s ? Number(s.variable_expenses) : null, previous: prev ? Number(prev.variable_expenses) : null },
    { key: 'gross', label: 'Gross profit', kind: 'money', emphasis: true,
      current: grossCurrent, previous: grossPrev },
    { key: 'gross_margin', label: 'Gross margin', kind: 'percent',
      current: grossMarginCurrent, previous: grossMarginPrev },
    { key: 'opex', label: 'Operating expenses (fixed)', kind: 'money', invert: true,
      current: s ? Number(s.fixed_expenses) : null, previous: prev ? Number(prev.fixed_expenses) : null },
    { key: 'payroll', label: 'Payroll', kind: 'money', invert: true, restricted: !canViewPayroll,
      current: canViewPayroll && s ? Number(s.payroll_paid) : null,
      previous: canViewPayroll && prev ? Number(prev.payroll_paid) : null },
    { key: 'net', label: 'Net profit', kind: 'money', emphasis: true,
      current: s ? Number(s.net_profit) : null, previous: prev ? Number(prev.net_profit) : null },
    { key: 'net_margin', label: 'Net margin', kind: 'percent',
      current: s ? Number(s.profit_margin) : null, previous: prev ? Number(prev.profit_margin) : null },
  ]

  // ── CSV export of the ACTIVE tab's table ───────────────────────────────────
  const exportRows = useMemo((): Record<string, unknown>[] => {
    switch (tab) {
      case 'pnl':
        return pnlLines.map((l) => ({
          line: l.label,
          current: l.restricted ? 'restricted' : l.current ?? '',
          previous: l.restricted ? 'restricted' : l.previous ?? '',
          change_percent: l.restricted || l.current === null || l.previous === null
            ? '' : percentChange(l.current, l.previous) ?? '',
          currency,
        }))
      case 'revenue':
        return topClientsByRevenue.map((c) => ({
          client: c.client_name, revenue: c.revenue, profit: c.profit,
          margin_percent: c.margin, currency: c.currency,
        }))
      case 'expenses':
        return expenseRows.map((e) => ({
          category: e.category_name, cost_type: e.cost_type, total: e.total,
          share_percent: e.share_percent, items: e.item_count, currency: e.currency,
        }))
      case 'subscriptions':
        return mrr.map((r) => ({
          currency: r.currency, mrr: r.mrr, active_subscriptions: r.active_subscriptions,
          new_mrr: r.new_mrr, lost_mrr: r.lost_mrr,
        }))
      case 'clients':
        return clientRows.map((c) => ({
          client: c.client_name, revenue: c.revenue, cost: c.direct_cost,
          profit: c.profit, margin_percent: c.margin, currency: c.currency,
        }))
      case 'projects':
        return projectRows.map((p) => ({
          project: p.project_name, client: p.client_name, status: p.status,
          revenue: p.revenue, cost: p.cost, profit: p.profit,
          margin_percent: p.margin, currency: p.currency,
        }))
      case 'services':
        return serviceRows.map((x) => ({
          service: x.service_name, revenue: x.revenue, cost: x.cost,
          profit: x.profit, margin_percent: x.margin, currency: x.currency,
        }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currency, s, prev, canViewPayroll, topClientsByRevenue, expenseRows, mrr, clientRows, projectRows, serviceRows])

  const handleExport = () => {
    downloadCsv(`ez-report-${tab}-${range.from}-to-${range.to}`, toCsv(exportRows))
  }

  if (error) {
    return <PageErrorState title="We couldn't load reports" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Reports"
        subtitle={`${formatDateShort(range.from)} — ${formatDateShort(range.to)} · compared with ${formatDateShort(prevRange.from)} — ${formatDateShort(prevRange.to)}`}
      >
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === 'custom' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            style={period === 'custom' ? { background: 'rgba(59,130,246,0.20)' } : undefined}
          >
            Custom
          </button>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
        {hasPermission('finance.export') && exportRows.length > 0 && (
          <button className="btn-secondary py-2 px-3 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
        {hasPermission('finance.close_period') && (
          <Link to="/app/finance/reports/month-close" className="btn-primary py-2 px-3 text-xs">
            Month close →
          </Link>
        )}
      </FinancePageHeader>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <label className="text-[11px] text-slate-400">From</label>
          <input type="date" className="input py-2 text-sm max-w-[170px]" value={custom.from}
            onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))} />
          <label className="text-[11px] text-slate-400">To</label>
          <input type="date" className="input py-2 text-sm max-w-[170px]" value={custom.to}
            onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))} />
        </div>
      )}

      {/* ── Report tabs ── */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl mb-5 w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            style={tab === t.key ? { background: 'rgba(59,130,246,0.20)' } : undefined}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <KpiSkeleton count={4} />
          <Panel><FinanceSkeleton rows={6} /></Panel>
        </div>
      ) : tab === 'pnl' ? (
        <Panel title="Profit & Loss statement">
          {!s && !prev ? (
            <EmptyState icon="📑" title="No activity in either period"
              description="Record income and expenses and the statement will build itself from the ledger." />
          ) : (
            <>
              <DataTable minWidth={640} columns={[
                { key: 'line', label: 'Line' },
                { key: 'current', label: 'Current period', align: 'right' },
                { key: 'previous', label: 'Previous period', align: 'right' },
                { key: 'change', label: 'Change', align: 'right' },
              ]}>
                {pnlLines.map((l) => (
                  <tr key={l.key}
                    className={`border-b border-white/5 last:border-0 ${l.emphasis ? 'bg-white/[0.02]' : ''}`}>
                    <td className={`py-3 text-sm ${l.emphasis ? 'font-bold text-white' : 'text-slate-300'}`}>
                      {l.label}
                    </td>
                    <td className="py-3 text-right">
                      <PnlValue line={l} value={l.current} currency={currency} />
                    </td>
                    <td className="py-3 text-right">
                      <PnlValue line={l} value={l.previous} currency={currency} muted />
                    </td>
                    <td className="py-3 text-right">
                      <PnlChange line={l} currency={currency} />
                    </td>
                  </tr>
                ))}
              </DataTable>
              <p className="text-[11px] text-slate-500 mt-4">
                Current: {formatDateShort(range.from)} — {formatDateShort(range.to)} ·
                Previous: {formatDateShort(prevRange.from)} — {formatDateShort(prevRange.to)}.
                Figures are collected/settled amounts from the ledger in {currency}.
                {!canViewPayroll && ' Payroll is not visible to your role.'}
              </p>
            </>
          )}
        </Panel>
      ) : tab === 'revenue' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Collected" color="#10B981" emphasis
              value={formatMoney(s?.revenue_collected ?? 0, currency)} sub="Settled this period" />
            <KpiCard label="Expected" color="#38BDF8"
              value={formatMoney(s?.revenue_expected ?? 0, currency)} sub="Total billed" />
            <KpiCard label="Outstanding" color="#F59E0B"
              value={formatMoney(s?.revenue_outstanding ?? 0, currency)} sub="Awaiting collection" />
            <KpiCard label="Overdue" color="#EF4444"
              value={formatMoney(s?.revenue_overdue ?? 0, currency)} sub="Past due date" />
          </div>

          <Panel title={`Monthly revenue — last 12 months (${currency})`}>
            {chartData.length === 0 ? (
              <EmptyState icon="📈" title="No monthly history yet"
                description="The revenue trend appears once transactions span more than one month." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="reportRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
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
                    formatter={(v: number) => [formatMoney(v, currency), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue"
                    stroke="#10B981" fill="url(#reportRevGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Top clients by revenue">
            {topClientsByRevenue.length === 0 ? (
              <EmptyState icon="👥" title="No client revenue in this period"
                description="Attribute income to a client to rank contribution here." />
            ) : (
              <DataTable minWidth={560} columns={[
                { key: 'client', label: 'Client' },
                { key: 'revenue', label: 'Revenue', align: 'right' },
                { key: 'profit', label: 'Contribution', align: 'right' },
                { key: 'margin', label: 'Margin', align: 'right' },
              ]}>
                {topClientsByRevenue.map((c) => (
                  <tr key={c.client_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{c.client_name}</td>
                    <td className="py-3 text-right text-xs text-slate-300">{formatMoney(Number(c.revenue), c.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(c.profit)} currency={c.currency} tone="auto" /></td>
                    <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(Number(c.margin), 0)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </div>
      ) : tab === 'expenses' ? (
        <div className="grid lg:grid-cols-5 gap-5 items-start">
          <Panel title="Expense mix" className="lg:col-span-2">
            {expenseRows.length === 0 ? (
              <EmptyState icon="🧾" title="No expenses in this period"
                description="Recorded expenses will break down by category here." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={expenseRows} dataKey="total" nameKey="category_name"
                    innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {expenseRows.map((e) => <Cell key={e.category_name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => formatMoney(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
          <Panel title="By category" className="lg:col-span-3">
            {expenseRows.length === 0 ? (
              <EmptyState icon="🧾" title="Nothing to break down"
                description="Categorise expenses to see where money goes." />
            ) : (
              <DataTable minWidth={520} columns={[
                { key: 'category', label: 'Category' },
                { key: 'cost_type', label: 'Cost type' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'share', label: 'Share', align: 'right' },
              ]}>
                {expenseRows.map((e) => (
                  <tr key={`${e.category_id ?? 'uncat'}-${e.category_name}`}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                        <span className="text-white">{e.category_name}</span>
                      </span>
                    </td>
                    <td className="py-3 text-xs text-slate-400 capitalize">{e.cost_type}</td>
                    <td className="py-3 text-right"><Money amount={Number(e.total)} currency={e.currency} /></td>
                    <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(Number(e.share_percent), 1)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </div>
      ) : tab === 'subscriptions' ? (
        <div className="space-y-5">
          {!m && mrr.length === 0 ? (
            <Panel>
              <EmptyState icon="🔁" title="No active subscriptions"
                description="Recurring client subscriptions will report their monthly value here." />
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Monthly recurring revenue" color="#8B5CF6" emphasis
                  value={formatMoney(m?.mrr ?? 0, currency)}
                  sub="Current snapshot" />
                <KpiCard label="Active subscriptions" color="#3B82F6"
                  value={String(m?.active_subscriptions ?? 0)}
                  sub={`Billing in ${currency}`} />
                <KpiCard label="New MRR" color="#10B981"
                  value={formatMoney(m?.new_mrr ?? 0, currency)}
                  sub="Added this month" />
                <KpiCard label="Lost MRR" color="#EF4444"
                  value={formatMoney(m?.lost_mrr ?? 0, currency)}
                  sub="Churned this month" />
              </div>
              <Panel>
                <p className="text-xs text-slate-400">
                  MRR counts <span className="text-white font-semibold">active subscriptions normalised to a
                  monthly value</span> — quarterly, semi-annual and annual plans are divided across their
                  term. It is a point-in-time snapshot and does not change with the selected report period.
                </p>
              </Panel>
            </>
          )}
        </div>
      ) : tab === 'clients' ? (
        <ProfitabilityTable
          rows={clientRows.map((c) => ({
            id: c.client_id, name: c.client_name, status: null,
            revenue: Number(c.revenue), cost: Number(c.direct_cost),
            profit: Number(c.profit), margin: Number(c.margin), currency: c.currency,
          }))}
          entity="client" nameLabel="Client" costLabel="Attributed cost"
        />
      ) : tab === 'projects' ? (
        <ProfitabilityTable
          rows={projectRows.map((p) => ({
            id: p.project_id, name: p.project_name, subtitle: p.client_name, status: p.status,
            revenue: Number(p.revenue), cost: Number(p.cost),
            profit: Number(p.profit), margin: Number(p.margin), currency: p.currency,
          }))}
          entity="project" nameLabel="Project" costLabel="Cost"
        />
      ) : (
        <ProfitabilityTable
          rows={serviceRows.map((x) => ({
            id: x.service_id, name: x.service_name, status: null,
            revenue: Number(x.revenue), cost: Number(x.cost),
            profit: Number(x.profit), margin: Number(x.margin), currency: x.currency,
          }))}
          entity="service" nameLabel="Service" costLabel="Cost"
        />
      )}
    </div>
  )
}

// ─── P&L cells ────────────────────────────────────────────────────────────────

interface PnlLineShape {
  kind: 'money' | 'percent'
  invert?: boolean
  emphasis?: boolean
  restricted?: boolean
  current: number | null
  previous: number | null
}

function PnlValue({
  line, value, currency, muted = false,
}: {
  line: PnlLineShape
  value: number | null
  currency: string
  muted?: boolean
}) {
  if (line.restricted) return <span className="text-xs text-slate-500">—</span>
  if (value === null) return <span className="text-xs text-slate-500">—</span>
  if (line.kind === 'percent') {
    return (
      <span className={`text-xs font-semibold ${muted ? 'text-slate-400' : 'text-slate-200'}`}>
        {formatPercent(value, 1)}
      </span>
    )
  }
  if (line.emphasis && !muted) return <Money amount={value} currency={currency} tone="auto" />
  return (
    <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-200'} ${line.emphasis ? 'font-bold' : ''}`}>
      {formatMoney(value, currency)}
    </span>
  )
}

function PnlChange({ line, currency }: { line: PnlLineShape; currency: string }) {
  if (line.restricted || line.current === null || line.previous === null) {
    return <span className="text-xs text-slate-500">—</span>
  }
  const diff = line.current - line.previous
  const favourable = line.invert ? diff <= 0 : diff >= 0
  const cls = diff === 0 ? 'text-slate-400' : favourable ? 'text-green-400' : 'text-red-400'
  const sign = diff >= 0 ? '+' : ''

  if (line.kind === 'percent') {
    return <span className={`text-xs font-semibold ${cls}`}>{sign}{diff.toFixed(1)} pp</span>
  }

  const pc = percentChange(line.current, line.previous)
  return (
    <span className={`text-xs font-semibold ${cls}`}>
      {sign}{formatMoney(diff, currency)}
      {pc !== null && <span className="ml-1 text-[10px] opacity-80">({sign}{formatPercent(Math.abs(pc), 1)})</span>}
    </span>
  )
}

// ─── Shared profitability table (clients / projects / services) ───────────────

interface ProfitRow {
  id: string
  name: string
  subtitle?: string
  status: string | null
  revenue: number
  cost: number
  profit: number
  margin: number
  currency: string
}

function ProfitabilityTable({
  rows, entity, nameLabel, costLabel,
}: {
  rows: ProfitRow[]
  entity: string
  nameLabel: string
  costLabel: string
}) {
  const hasStatus = rows.some((r) => r.status !== null)
  return (
    <Panel>
      {rows.length === 0 ? (
        <EmptyState icon="📊" title={`No ${entity} activity in this period`}
          description={`Record income and attribute costs to a ${entity} to report contribution here.`} />
      ) : (
        <DataTable minWidth={hasStatus ? 720 : 560} columns={[
          { key: 'name', label: nameLabel },
          ...(hasStatus ? [{ key: 'status', label: 'Status' }] : []),
          { key: 'revenue', label: 'Revenue', align: 'right' as const },
          { key: 'cost', label: costLabel, align: 'right' as const },
          { key: 'profit', label: 'Profit', align: 'right' as const },
          { key: 'margin', label: 'Margin', align: 'right' as const },
        ]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td className="py-3">
                <span className="text-white text-sm">{r.name}</span>
                {r.subtitle && <span className="block text-[11px] text-slate-500">{r.subtitle}</span>}
              </td>
              {hasStatus && (
                <td className="py-3">{r.status ? <StatusBadge status={r.status} /> : '—'}</td>
              )}
              <td className="py-3 text-right text-xs text-slate-300">{formatMoney(r.revenue, r.currency)}</td>
              <td className="py-3 text-right text-xs text-slate-400">{formatMoney(r.cost, r.currency)}</td>
              <td className="py-3 text-right"><Money amount={r.profit} currency={r.currency} tone="auto" /></td>
              <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(r.margin, 0)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  )
}
