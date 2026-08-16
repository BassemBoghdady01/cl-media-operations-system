/**
 * EZ Marketing Agency — Home dashboard
 *
 * Every number on this screen is computed from real Supabase data. Sections
 * are composed by permission, so each role lands on a relevant view:
 *   • operations tiles for everyone with dashboard.view
 *   • a finance strip only for roles holding the matching finance permissions
 *   • insights derived arithmetically from the loaded aggregates
 * When there is no data yet, tiles show 0 and lists show honest empty states —
 * nothing is ever fabricated.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, Film, Clock, CheckCircle, AlertTriangle, Sparkles,
  ArrowRight, Camera, FolderKanban,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { KpiCard, Panel, EmptyState, StatusBadge, Money } from '../../components/finance/FinanceKit'
import { formatMoney, formatPercent } from '../../lib/finance'
import { statusColors } from '../../lib/utils'
import { videoService } from '../../services/videoService'
import { clientService } from '../../services/clientService'
import { projectService } from '../../services/projectService'
import { taskService } from '../../services/taskService'
import { bookingService } from '../../services/bookingService'
import {
  financeService, resolvePeriod,
  type FinanceSummary, type MrrRow, type ReceivableRow, type UpcomingRow,
  type ClientProfitability, type ServiceProfitability, type ExpenseBreakdownRow,
  type BreakEven,
} from '../../services/financeService'
import type { Video, Client, Project, Task, Booking } from '../../types'

const PIPELINE_STAGES = [
  { id: 'idea', label: 'Idea' },
  { id: 'script', label: 'Script' },
  { id: 'shooting', label: 'Shooting' },
  { id: 'editing', label: 'Editing' },
  { id: 'internal_review', label: 'Internal Review' },
  { id: 'client_review', label: 'Client Review' },
  { id: 'revision', label: 'Revision' },
  { id: 'approved', label: 'Approved' },
]

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="glass-blue rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-6 translate-x-6"
        style={{ background: color }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="text-2xl font-black text-white mb-0.5">{value}</div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </motion.div>
  )
}

export default function Dashboard() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const canOps = hasPermission('videos.view') || hasPermission('clients.view')
  const canFinance = hasPermission('finance.view')
  const canRevenue = canFinance && hasPermission('finance.view_revenue')
  const canProfit = canFinance && hasPermission('finance.view_profit')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [videos, setVideos] = useState<Video[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  const [summary, setSummary] = useState<FinanceSummary[]>([])
  const [mrr, setMrr] = useState<MrrRow[]>([])
  const [receivables, setReceivables] = useState<ReceivableRow[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([])
  const [breakEven, setBreakEven] = useState<BreakEven | null>(null)
  const [topClients, setTopClients] = useState<ClientProfitability[]>([])
  const [topServices, setTopServices] = useState<ServiceProfitability[]>([])
  const [expenseMix, setExpenseMix] = useState<ExpenseBreakdownRow[]>([])

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    const range = resolvePeriod('this_month')

    const opsPromises: Promise<unknown>[] = canOps
      ? [
          hasPermission('videos.view') ? videoService.getAll(agencyId).then(setVideos) : Promise.resolve(),
          hasPermission('clients.view') ? clientService.getAll(agencyId).then(setClients) : Promise.resolve(),
          hasPermission('projects.view') ? projectService.getAll(agencyId).then(setProjects) : Promise.resolve(),
          hasPermission('tasks.view') ? taskService.getAll(agencyId).then(setTasks) : Promise.resolve(),
          hasPermission('bookings.view') ? bookingService.getAll(agencyId).then(setBookings) : Promise.resolve(),
        ]
      : []

    const finPromises: Promise<unknown>[] = canFinance
      ? [
          financeService.getSummary(agencyId, range.from, range.to).then(setSummary),
          financeService.getMrr(agencyId).then(setMrr),
          canRevenue ? financeService.getReceivables(agencyId).then(setReceivables) : Promise.resolve(),
          financeService.getUpcoming(agencyId, 7).then(setUpcoming),
          canProfit ? financeService.getBreakEven(agencyId, 'EGP').then((r) => setBreakEven(r[0] ?? null)) : Promise.resolve(),
          canProfit ? financeService.getClientProfitability(agencyId, range.from, range.to).then(setTopClients) : Promise.resolve(),
          canProfit ? financeService.getServiceProfitability(agencyId, range.from, range.to).then(setTopServices) : Promise.resolve(),
          hasPermission('finance.view_expenses')
            ? financeService.getExpenseBreakdown(agencyId, range.from, range.to).then(setExpenseMix)
            : Promise.resolve(),
        ]
      : []

    const results = await Promise.allSettled([...opsPromises, ...finPromises])
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    // Only surface a page-level error when EVERYTHING failed — a single failed
    // aggregate should not blank a dashboard that has other real data.
    if (failures.length > 0 && failures.length === results.length && results.length > 0) {
      setError(failures[0].reason instanceof Error ? failures[0].reason.message : 'Could not load dashboard data.')
    } else if (failures.length) {
      console.warn('[Dashboard] partial load failures:', failures.map((f) => String(f.reason)))
    }
    setLoading(false)
  }, [agencyId, canOps, canFinance, canRevenue, canProfit, hasPermission])

  useEffect(() => { load() }, [load])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // ── Ops aggregates (all real) ──
  const activeClients = clients.filter((c) => c.status === 'active').length
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const inProduction = videos.filter((v) => ['editing', 'internal_review', 'shooting'].includes(v.status)).length
  const awaitingReview = videos.filter((v) => v.status === 'client_review').length
  const todayIso = new Date().toISOString().slice(0, 10)
  const in7Iso = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
  const upcomingShoots = bookings.filter((b) =>
    b.date >= todayIso && b.date <= in7Iso && !['cancelled', 'completed'].includes(b.status)).length
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayIso).length

  const videoCounts = PIPELINE_STAGES.map((s) => ({
    ...s,
    color: statusColors[s.id]?.dot ?? '#64748B',
    count: videos.filter((v) => v.status === s.id).length,
  }))
  const totalVideos = videos.length || 1

  // ── Finance aggregates for the base currency actually present ──
  const finCurrency = summary[0]?.currency ?? mrr[0]?.currency ?? 'EGP'
  const s = summary.find((x) => x.currency === finCurrency)
  const m = mrr.find((x) => x.currency === finCurrency)
  const outstanding = receivables
    .filter((r) => r.currency === finCurrency)
    .reduce((a, r) => a + r.outstanding, 0)
  const upcomingIn = upcoming.filter((u) => u.kind === 'income' && u.currency === finCurrency && u.days_until >= 0)
  const upcomingTotal = upcomingIn.reduce((a, u) => a + u.amount, 0)

  const insights = useMemo(() => {
    const lines: { icon: string; text: string; link: string; label: string }[] = []
    const tc = topClients.filter((c) => c.currency === finCurrency)[0]
    if (tc && tc.revenue > 0) {
      lines.push({
        icon: '👑',
        text: `${tc.client_name} is your top revenue client this month (${formatMoney(tc.revenue, finCurrency)}).`,
        link: '/app/finance/profitability', label: 'Profitability',
      })
    }
    const ts = topServices.filter((x) => x.currency === finCurrency && x.revenue > 0)
      .sort((a, b) => b.margin - a.margin)[0]
    if (ts) {
      lines.push({
        icon: '⭐',
        text: `${ts.service_name} is your most profitable service (${formatPercent(ts.margin, 0)} margin).`,
        link: '/app/finance/reports', label: 'Reports',
      })
    }
    const te = expenseMix.filter((e) => e.currency === finCurrency)[0]
    if (te) {
      lines.push({
        icon: '🧾',
        text: `${te.category_name} is your largest expense category (${formatPercent(te.share_percent, 0)} of spend).`,
        link: '/app/finance/expenses', label: 'Expenses',
      })
    }
    if (breakEven?.has_sufficient_data) {
      lines.push({
        icon: breakEven.coverage_percent >= 100 ? '✅' : '📉',
        text: `Recurring revenue covers ${formatPercent(breakEven.coverage_percent, 0)} of your fixed cost base.`,
        link: '/app/finance', label: 'Finance',
      })
    }
    if (awaitingReview > 0) {
      lines.push({
        icon: '🎬',
        text: `${awaitingReview} video${awaitingReview === 1 ? ' is' : 's are'} waiting on client review.`,
        link: '/app/pipeline', label: 'Pipeline',
      })
    }
    if (overdueTasks > 0) {
      lines.push({
        icon: '⏰',
        text: `${overdueTasks} task${overdueTasks === 1 ? ' is' : 's are'} past their due date.`,
        link: '/app/tasks', label: 'Tasks',
      })
    }
    return lines
  }, [topClients, topServices, expenseMix, breakEven, awaitingReview, overdueTasks, finCurrency])

  if (error) {
    return <PageErrorState title="We couldn't load your dashboard" message={error} onRetry={load} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 space-y-8">

      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' — '}here's where things stand.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {hasPermission('videos.view') && (
            <Link to="/app/pipeline" className="btn-secondary text-xs py-2 px-4">
              <Film className="w-3.5 h-3.5" /> Pipeline
            </Link>
          )}
          {canFinance && (
            <Link to="/app/finance" className="btn-secondary text-xs py-2 px-4">
              <FolderKanban className="w-3.5 h-3.5" /> Finance
            </Link>
          )}
          {hasPermission('ai.use') && (
            <Link to="/app/ai" className="btn-primary text-xs py-2 px-4">
              <Sparkles className="w-3.5 h-3.5" /> AI Studio
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* ── Operations ── */}
          {canOps && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {hasPermission('clients.view') && (
                <StatCard icon={Users} label="Active Clients" value={activeClients} color="#3B82F6" />
              )}
              {hasPermission('projects.view') && (
                <StatCard icon={FolderKanban} label="Active Projects" value={activeProjects} color="#8B5CF6" />
              )}
              {hasPermission('videos.view') && (
                <StatCard icon={Film} label="In Production" value={inProduction} sub="videos right now" color="#06B6D4" />
              )}
              {hasPermission('videos.view') && (
                <StatCard icon={Clock} label="Awaiting Review" value={awaitingReview} sub="client review pending" color="#EAB308" />
              )}
              {hasPermission('bookings.view') && (
                <StatCard icon={Camera} label="Upcoming Shoots" value={upcomingShoots} sub="next 7 days" color="#10B981" />
              )}
              {hasPermission('tasks.view') && (
                <StatCard icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks} color="#EF4444" />
              )}
            </div>
          )}

          {/* ── Finance strip ── */}
          {canFinance && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {canRevenue && (
                <KpiCard label="Revenue this month" color="#10B981" emphasis
                  value={formatMoney(s?.revenue_collected ?? 0, finCurrency)}
                  sub={`${formatMoney(s?.revenue_expected ?? 0, finCurrency)} expected`} />
              )}
              {hasPermission('finance.view_expenses') && (
                <KpiCard label="Expenses this month" color="#EF4444"
                  value={formatMoney(s?.expenses_paid ?? 0, finCurrency)} />
              )}
              {canProfit && (
                <KpiCard label="Net profit" color={(s?.net_profit ?? 0) >= 0 ? '#10B981' : '#EF4444'} emphasis
                  value={formatMoney(s?.net_profit ?? 0, finCurrency)}
                  sub={`${formatPercent(s?.profit_margin ?? 0)} margin`} />
              )}
              {hasPermission('subscriptions.view') && (
                <KpiCard label="MRR" color="#8B5CF6"
                  value={formatMoney(m?.mrr ?? 0, finCurrency)}
                  sub={`${m?.active_subscriptions ?? 0} active subscriptions`} />
              )}
              {canRevenue && (
                <KpiCard label="Receivables" color="#F59E0B"
                  value={formatMoney(outstanding, finCurrency)} sub="Outstanding" />
              )}
              {canRevenue && (
                <KpiCard label="Upcoming payments" color="#38BDF8"
                  value={formatMoney(upcomingTotal, finCurrency)} sub="Due within 7 days" />
              )}
              {canProfit && breakEven?.has_sufficient_data && (
                <KpiCard label="Break-even coverage" color="#A78BFA"
                  value={formatPercent(breakEven.coverage_percent, 0)}
                  sub="Recurring revenue vs fixed costs" />
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ── Pipeline overview ── */}
            {hasPermission('videos.view') && (
              <Panel title="Live Pipeline" action={
                <Link to="/app/pipeline" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Full board <ArrowRight className="w-3 h-3" />
                </Link>
              }>
                {videos.length === 0 ? (
                  <EmptyState icon="🎬" title="No videos yet"
                    description="Videos you create appear here as they move through the pipeline." />
                ) : (
                  <div className="space-y-2.5">
                    {videoCounts.filter((st) => st.count > 0).map(({ label, color, count }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="text-[11px] text-slate-400 w-28 flex-shrink-0">{label}</div>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / totalVideos) * 100}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: color }} />
                        </div>
                        <span className="text-xs font-bold text-white w-4 text-right">{count}</span>
                      </div>
                    ))}
                    <div className="mt-4 pt-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {videos.slice(0, 3).map((v) => {
                        const sc = statusColors[v.status] ?? statusColors.idea
                        return (
                          <Link key={v.id} to={`/app/pipeline/${v.id}`}
                            className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors -mx-3">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{v.title}</p>
                              <p className="text-[10px] text-slate-500">{v.clientName}</p>
                            </div>
                            <span className="badge text-[10px]" style={{ background: sc.bg, color: sc.text }}>
                              {v.status.replace('_', ' ')}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            {/* ── Upcoming money / insights ── */}
            {canFinance ? (
              <Panel title="Next 7 days — money" action={
                canRevenue ? (
                  <Link to="/app/finance/receivables" className="text-[11px] text-blue-400 hover:text-blue-300">
                    Receivables →
                  </Link>
                ) : undefined
              }>
                {upcoming.length === 0 ? (
                  <EmptyState icon="📅" title="Nothing due this week"
                    description="Scheduled payments and bills will appear here." />
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                    {upcoming.slice(0, 8).map((u) => (
                      <div key={`${u.kind}-${u.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <span className="w-1.5 h-8 rounded-full flex-shrink-0"
                          style={{ background: u.kind === 'income' ? '#10B981' : '#EF4444' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{u.title}</p>
                          <p className="text-[10px] text-slate-500">
                            {u.client_name ? `${u.client_name} · ` : ''}
                            {u.days_until < 0 ? `${Math.abs(u.days_until)} days overdue`
                              : u.days_until === 0 ? 'Due today' : `in ${u.days_until} days`}
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
            ) : hasPermission('tasks.view') && (
              <Panel title="My Tasks" action={
                <Link to="/app/tasks" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  All tasks <ArrowRight className="w-3 h-3" />
                </Link>
              }>
                {tasks.filter((t) => t.assignedTo === user?.id && t.status !== 'done').length === 0 ? (
                  <EmptyState icon="✅" title="No open tasks assigned to you" />
                ) : (
                  <div className="space-y-2">
                    {tasks.filter((t) => t.assignedTo === user?.id && t.status !== 'done').slice(0, 6).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <CheckCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{t.title}</p>
                          <p className="text-[10px] text-slate-500">{t.clientName ?? ''} {t.dueDate ? `· due ${t.dueDate}` : ''}</p>
                        </div>
                        <span className={`text-[10px] font-semibold ${t.priority === 'urgent' ? 'text-red-400' : 'text-slate-500'}`}>
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>

          {/* ── Insights (calculated, never invented) ── */}
          {insights.length > 0 && (
            <Panel title="Insights">
              <div className="grid md:grid-cols-2 gap-3">
                {insights.map((ins) => (
                  <div key={ins.text} className="flex gap-3 p-3.5 rounded-xl"
                    style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}>
                    <span className="text-base flex-shrink-0">{ins.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-relaxed">{ins.text}</p>
                      <Link to={ins.link} className="text-[11px] font-semibold mt-1.5 inline-flex items-center gap-1 text-blue-400">
                        {ins.label} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </motion.div>
  )
}
