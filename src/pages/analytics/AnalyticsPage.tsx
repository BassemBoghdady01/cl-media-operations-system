import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, Film, Users, CheckCircle, Clock,
  BarChart3, ArrowUpRight, ArrowDownRight, Star,
} from 'lucide-react'
import {
  revenueData, videoStatusData, platformData, mockClients,
  mockVideos, mockTeamMembers,
} from '../../data/mockData'
import { formatCurrency, getInitials } from '../../lib/utils'

const ranges = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months', 'This year']

const weeklyOutput = [
  { week: 'W1', completed: 12, revision: 3 },
  { week: 'W2', completed: 18, revision: 5 },
  { week: 'W3', completed: 15, revision: 2 },
  { week: 'W4', completed: 22, revision: 4 },
  { week: 'W5', completed: 19, revision: 3 },
  { week: 'W6', completed: 25, revision: 6 },
  { week: 'W7', completed: 21, revision: 2 },
  { week: 'W8', completed: 28, revision: 4 },
]

const teamPerformance = [
  { name: 'Omar T.', completed: 24, onTime: 21, revisions: 8 },
  { name: 'Nour I.', completed: 18, onTime: 17, revisions: 4 },
  { name: 'Ahmed S.', completed: 31, onTime: 30, revisions: 2 },
  { name: 'Layla K.', completed: 12, onTime: 11, revisions: 1 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-blue rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name === 'revenue' ? formatCurrency(p.value) : p.value}
          <span className="text-xs text-slate-400 font-normal">{p.name}</span>
        </p>
      ))}
    </div>
  )
}

function KPICard({
  icon: Icon, label, value, change, color, suffix = '',
}: { icon: any; label: string; value: string | number; change: number; color: string; suffix?: string }) {
  const isPos = change > 0
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
        <div className={`flex items-center gap-0.5 text-xs font-bold ${isPos ? 'text-green-400' : 'text-red-400'}`}>
          {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(change)}%
        </div>
      </div>
      <div className="text-2xl font-black text-white mb-0.5">
        {value}{suffix}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState('Last 6 months')

  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0)
  const totalVideos = revenueData.reduce((s, d) => s + d.videos, 0)
  const approvalRate = 87
  const avgDelivery = 3.2

  const clientRevenue = mockClients.map((c) => ({
    name: c.brandName,
    color: c.color,
    revenue: [4905, 2852, 7848, 3052, 3842, 0][mockClients.indexOf(c)] ?? 0,
    videos: mockVideos.filter((v) => v.clientId === c.id).length,
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

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
          onChange={(e) => setRange(e.target.value)}
          className="input py-2 text-xs w-auto">
          {ranges.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard icon={DollarSign} label="Total Revenue" value={formatCurrency(totalRevenue)} change={12} color="#10B981" />
        <KPICard icon={Film} label="Videos Delivered" value={totalVideos} change={18} color="#3B82F6" />
        <KPICard icon={CheckCircle} label="Approval Rate" value={approvalRate} suffix="%" change={3} color="#8B5CF6" />
        <KPICard icon={Clock} label="Avg. Delivery" value={avgDelivery} suffix=" days" change={-8} color="#F59E0B" />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Revenue trend */}
        <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Revenue Trend</h3>
              <p className="text-xs text-slate-500">Monthly revenue over the past 6 months</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#10B981" strokeWidth={2.5} fill="url(#revG)" dot={{ fill: '#10B981', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Platform distribution */}
        <div className="glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Platform Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Videos by platform this period</p>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={70}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {platformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}%`, '']} contentStyle={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {platformData.map(({ platform, value, color }) => (
              <div key={platform} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-slate-400 flex-1">{platform}</span>
                <span className="font-bold text-white">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* Weekly output */}
        <div className="glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Weekly Video Output</h3>
          <p className="text-xs text-slate-500 mb-5">Completed vs revision requests per week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyOutput} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" name="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revision" name="revisions" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Team performance */}
        <div className="glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Team Performance</h3>
          <p className="text-xs text-slate-500 mb-5">Videos completed, on-time rate & revisions</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={teamPerformance} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" name="completed" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey="onTime" name="on-time" fill="#10B981" radius={[0, 4, 4, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom: Client table + Status breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Top clients table */}
        <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-5">Top Clients by Revenue</h3>
          <div className="space-y-0">
            {clientRevenue.map((c, i) => {
              const maxRev = clientRevenue[0].revenue
              const pct = maxRev > 0 ? (c.revenue / maxRev) * 100 : 0
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
                      <span className="text-sm font-black text-white">{formatCurrency(c.revenue)}</span>
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
                  <span className="text-xs text-slate-500 w-16 text-right">{c.videos} videos</span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Video status breakdown */}
        <div className="glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-5">Status Breakdown</h3>
          <div className="space-y-3">
            {videoStatusData.map(({ status, value, color }) => {
              const total = videoStatusData.reduce((s, d) => s + d.value, 0)
              const pct = Math.round((value / total) * 100)
              return (
                <div key={status}>
                  <div className="flex justify-between mb-1.5 text-xs">
                    <span className="text-slate-400">{status}</span>
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
                <div className="text-lg font-black text-green-400">87%</div>
                <div className="text-[10px] text-slate-500">Approval Rate</div>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
                <div className="text-lg font-black text-blue-400">3.2d</div>
                <div className="text-[10px] text-slate-500">Avg. Delivery</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
