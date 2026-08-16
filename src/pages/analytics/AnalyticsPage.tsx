import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, Film, Users, CheckCircle, BarChart3,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { videoService } from '../../services/videoService'
import { clientService } from '../../services/clientService'
import { taskService } from '../../services/taskService'
import { packageService } from '../../services/packageService'
import { formatCurrency, getInitials, platformColors, platformLabels, statusColors } from '../../lib/utils'
import type { Client, Package, Task, Video } from '../../types'

const ranges = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months', 'This year'] as const
type Range = (typeof ranges)[number]

function rangeCutoff(range: Range): Date {
  const now = new Date()
  if (range === 'This year') return new Date(now.getFullYear(), 0, 1)
  const days: Record<Exclude<Range, 'This year'>, number> = {
    'Last 7 days': 7,
    'Last 30 days': 30,
    'Last 3 months': 90,
    'Last 6 months': 180,
  }
  return new Date(now.getTime() - days[range] * 86_400_000)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-blue rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.value}
          <span className="text-xs text-slate-400 font-normal">{p.name}</span>
        </p>
      ))}
    </div>
  )
}

function KPICard({
  icon: Icon, label, value, change, color, suffix = '',
}: { icon: any; label: string; value: string | number; change?: number; color: string; suffix?: string }) {
  const isPos = (change ?? 0) > 0
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-blue rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-8"
        style={{ background: color }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${isPos ? 'text-green-400' : 'text-red-400'}`}>
            {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-black text-white mb-0.5">
        {value}{suffix}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </motion.div>
  )
}

/** Honest placeholder rendered when a chart's real data source is empty. */
function EmptyChart({ height = 200, message }: { height?: number; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl"
      style={{ height, border: '1px dashed rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}>
      <BarChart3 className="w-7 h-7 text-slate-700 mb-2" />
      <p className="text-xs text-slate-600">{message}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [videos, setVideos] = useState<Video[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [range, setRange] = useState<Range>('Last 6 months')

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [videoRows, clientRows, taskRows, pkgRows] = await Promise.all([
          videoService.getAll(agencyId),
          clientService.getAll(agencyId),
          taskService.getAll(agencyId),
          packageService.getAll(agencyId),
        ])
        if (cancelled) return
        setVideos(videoRows)
        setClients(clientRows)
        setTasks(taskRows)
        setPackages(pkgRows)
      } catch (err) {
        if (cancelled) return
        console.error('[AnalyticsPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load analytics data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const cutoff = useMemo(() => rangeCutoff(range), [range])

  const inRange = (dateStr: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return !Number.isNaN(d.getTime()) && d >= cutoff
  }

  const rangeVideos = useMemo(() => videos.filter((v) => inRange(v.createdAt)), [videos, cutoff]) // eslint-disable-line react-hooks/exhaustive-deps
  const rangeTasks = useMemo(() => tasks.filter((t) => inRange(t.createdAt)), [tasks, cutoff]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPIs (all computed from real rows; empty data → zeros / em-dash) ────────
  const activePackages = packages.filter((p) => p.status === 'active')
  const totalMRR = activePackages.reduce((s, p) => s + p.monthlyPrice, 0)
  const postedVideos = rangeVideos.filter((v) => v.status === 'posted').length
  const reviewedVideos = rangeVideos.filter((v) => v.approvalStatus !== 'pending')
  const approvalRate = reviewedVideos.length > 0
    ? Math.round((reviewedVideos.filter((v) => v.approvalStatus === 'approved').length / reviewedVideos.length) * 100)
    : null
  const activeClients = clients.filter((c) => c.status === 'active').length

  // ── Videos created per month across the selected window ─────────────────────
  const monthlyOutput = useMemo(() => {
    const now = new Date()
    const buckets: { key: string; month: string; created: number; posted: number }[] = []
    const start = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1)
    for (let d = new Date(start); d <= now; d.setMonth(d.getMonth() + 1)) {
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        created: 0,
        posted: 0,
      })
    }
    rangeVideos.forEach((v) => {
      const d = new Date(v.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const bucket = buckets.find((b) => b.key === key)
      if (bucket) {
        bucket.created += 1
        if (v.status === 'posted') bucket.posted += 1
      }
    })
    return buckets
  }, [rangeVideos, cutoff])

  // ── Platform distribution from real videos ──────────────────────────────────
  const platformDist = useMemo(() => {
    const counts = new Map<string, number>()
    rangeVideos.forEach((v) => counts.set(v.platform, (counts.get(v.platform) ?? 0) + 1))
    const total = rangeVideos.length
    return [...counts.entries()]
      .map(([platform, count]) => ({
        platform: platformLabels[platform] ?? platform,
        value: count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        color: platformColors[platform] ?? '#64748B',
      }))
      .sort((a, b) => b.value - a.value)
  }, [rangeVideos])

  // ── Weekly output (last 8 weeks): created vs needing revision ───────────────
  const weeklyOutput = useMemo(() => {
    const now = new Date()
    const weekStart = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      x.setDate(x.getDate() - x.getDay())
      return x
    }
    const weeks: { start: Date; week: string; completed: number; revision: number }[] = []
    const thisWeek = weekStart(now)
    for (let i = 7; i >= 0; i--) {
      const s = new Date(thisWeek)
      s.setDate(s.getDate() - i * 7)
      weeks.push({
        start: s,
        week: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: 0,
        revision: 0,
      })
    }
    videos.forEach((v) => {
      const d = new Date(v.createdAt)
      if (Number.isNaN(d.getTime())) return
      const s = weekStart(d).getTime()
      const bucket = weeks.find((w) => w.start.getTime() === s)
      if (!bucket) return
      if (v.status === 'approved' || v.status === 'scheduled' || v.status === 'posted') bucket.completed += 1
      if (v.revisionCount > 0) bucket.revision += 1
    })
    return weeks
  }, [videos])
  const weeklyHasData = weeklyOutput.some((w) => w.completed > 0 || w.revision > 0)

  // ── Team task load from real tasks ──────────────────────────────────────────
  const teamPerformance = useMemo(() => {
    const byName = new Map<string, { name: string; completed: number; open: number }>()
    rangeTasks.forEach((t) => {
      if (!t.assignedToName) return
      const entry = byName.get(t.assignedToName) ?? { name: t.assignedToName, completed: 0, open: 0 }
      if (t.status === 'done') entry.completed += 1
      else entry.open += 1
      byName.set(t.assignedToName, entry)
    })
    return [...byName.values()]
      .sort((a, b) => (b.completed + b.open) - (a.completed + a.open))
      .slice(0, 5)
  }, [rangeTasks])

  // ── Top clients: monthly package revenue + video output ─────────────────────
  const clientRevenue = useMemo(() => {
    return clients
      .map((c) => ({
        name: c.brandName || c.name,
        color: c.color,
        revenue: activePackages.filter((p) => p.clientId === c.id).reduce((s, p) => s + p.monthlyPrice, 0),
        videos: rangeVideos.filter((v) => v.clientId === c.id).length,
      }))
      .filter((c) => c.revenue > 0 || c.videos > 0)
      .sort((a, b) => b.revenue - a.revenue || b.videos - a.videos)
      .slice(0, 5)
  }, [clients, activePackages, rangeVideos])

  // ── Status breakdown from real videos ───────────────────────────────────────
  const videoStatusDist = useMemo(() => {
    const counts = new Map<string, number>()
    rangeVideos.forEach((v) => counts.set(v.status, (counts.get(v.status) ?? 0) + 1))
    return [...counts.entries()]
      .map(([status, value]) => ({
        status: status.replace('_', ' '),
        value,
        color: statusColors[status]?.dot ?? '#64748B',
      }))
      .sort((a, b) => b.value - a.value)
  }, [rangeVideos])
  const statusTotal = videoStatusDist.reduce((s, d) => s + d.value, 0)

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load analytics"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Agency performance at a glance</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="input py-2 text-xs w-auto">
          {ranges.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard icon={DollarSign} label="Monthly Recurring Revenue" value={formatCurrency(totalMRR)} color="#10B981" />
            <KPICard icon={Film} label="Videos Posted" value={postedVideos} color="#3B82F6" />
            <KPICard icon={CheckCircle} label="Approval Rate" value={approvalRate ?? '—'} suffix={approvalRate !== null ? '%' : ''} color="#8B5CF6" />
            <KPICard icon={Users} label="Active Clients" value={activeClients} color="#F59E0B" />
          </div>

          {/* Charts row 1 */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">

            {/* Video production trend */}
            <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-white">Video Production Trend</h3>
                  <p className="text-xs text-slate-500">Videos created and posted per month ({range.toLowerCase()})</p>
                </div>
              </div>
              {rangeVideos.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyOutput} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="createdG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="postedG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="created" name="created" stroke="#3B82F6" strokeWidth={2.5} fill="url(#createdG)" dot={{ fill: '#3B82F6', r: 3 }} />
                    <Area type="monotone" dataKey="posted" name="posted" stroke="#10B981" strokeWidth={2.5} fill="url(#postedG)" dot={{ fill: '#10B981', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart height={220} message="No videos in this period yet." />
              )}
            </div>

            {/* Platform distribution */}
            <div className="glass-blue rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-1">Platform Distribution</h3>
              <p className="text-xs text-slate-500 mb-4">Videos by platform this period</p>
              {platformDist.length > 0 ? (
                <>
                  <div className="flex justify-center mb-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={platformDist}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={70}
                          paddingAngle={3} dataKey="value" stroke="none">
                          {platformDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => [`${v} video${v !== 1 ? 's' : ''}`, '']}
                          contentStyle={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {platformDist.map(({ platform, pct, color }) => (
                      <div key={platform} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-slate-400 flex-1">{platform}</span>
                        <span className="font-bold text-white">{pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart height={220} message="No videos in this period yet." />
              )}
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">

            {/* Weekly output */}
            <div className="glass-blue rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-1">Weekly Video Output</h3>
              <p className="text-xs text-slate-500 mb-5">Completed vs sent for revision, last 8 weeks</p>
              {weeklyHasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyOutput} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="completed" name="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revision" name="revisions" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No video activity in the last 8 weeks." />
              )}
            </div>

            {/* Team task load */}
            <div className="glass-blue rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-1">Team Task Load</h3>
              <p className="text-xs text-slate-500 mb-5">Completed vs open tasks per team member</p>
              {teamPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={teamPerformance} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="completed" name="completed" fill="#10B981" radius={[0, 4, 4, 0]} barSize={8} />
                    <Bar dataKey="open" name="open" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No assigned tasks in this period yet." />
              )}
            </div>
          </div>

          {/* Bottom: Client table + Status breakdown */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Top clients table */}
            <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-5">Top Clients</h3>
              {clientRevenue.length > 0 ? (
                <div className="space-y-0">
                  {clientRevenue.map((c, i) => {
                    const maxRev = Math.max(...clientRevenue.map((x) => x.revenue), 1)
                    const pct = (c.revenue / maxRev) * 100
                    return (
                      <motion.div
                        key={c.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-4 py-3"
                        style={{ borderBottom: i < clientRevenue.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span className="text-sm font-black text-slate-600 w-4">#{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ background: c.color }}>
                          {getInitials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-white truncate">{c.name}</span>
                            <span className="text-sm font-black text-white">{formatCurrency(c.revenue)}<span className="text-[10px] text-slate-500 font-normal">/mo</span></span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, delay: i * 0.1 }}
                              className="h-full rounded-full"
                              style={{ background: c.color }} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 w-16 text-right">{c.videos} video{c.videos !== 1 ? 's' : ''}</span>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <EmptyChart height={220} message="No client packages or videos in this period yet." />
              )}
            </div>

            {/* Video status breakdown */}
            <div className="glass-blue rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-5">Status Breakdown</h3>
              {videoStatusDist.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {videoStatusDist.map(({ status, value, color }) => {
                      const pct = statusTotal > 0 ? Math.round((value / statusTotal) * 100) : 0
                      return (
                        <div key={status}>
                          <div className="flex justify-between mb-1.5 text-xs">
                            <span className="text-slate-400 capitalize">{status}</span>
                            <span className="font-bold text-white">{value} <span className="text-slate-500 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8 }}
                              className="h-full rounded-full"
                              style={{ background: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)' }}>
                        <div className="text-lg font-black text-green-400">{approvalRate !== null ? `${approvalRate}%` : '—'}</div>
                        <div className="text-[10px] text-slate-500">Approval Rate</div>
                      </div>
                      <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
                        <div className="text-lg font-black text-blue-400">{postedVideos}</div>
                        <div className="text-[10px] text-slate-500">Posted</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyChart height={220} message="No videos in this period yet." />
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
