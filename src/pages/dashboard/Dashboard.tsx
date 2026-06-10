import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Users, Film, CheckCircle, Clock, TrendingUp, AlertTriangle,
  Sparkles, ArrowRight, Calendar, DollarSign, BarChart3, Zap,
  Video, MessageSquare, Package, Star,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import {
  mockClients, mockVideos, mockTasks, mockActivity,
  mockPackages, mockNotifications, revenueData, videoStatusData,
} from '../../data/mockData'
import { statusColors, timeAgo, formatCurrency, getInitials } from '../../lib/utils'

const pipelineStages = [
  { id: 'idea', label: 'Idea', color: '#64748B' },
  { id: 'script', label: 'Script', color: '#8B5CF6' },
  { id: 'shooting', label: 'Shooting', color: '#F59E0B' },
  { id: 'editing', label: 'Editing', color: '#3B82F6' },
  { id: 'internal_review', label: 'Internal Review', color: '#06B6D4' },
  { id: 'client_review', label: 'Client Review', color: '#EAB308' },
  { id: 'revision', label: 'Revision', color: '#EF4444' },
  { id: 'approved', label: 'Approved', color: '#10B981' },
]

const aiInsights = [
  { icon: '🔄', color: '#EF4444', text: '3 videos awaiting client review for more than 48 hours — send a reminder?', action: 'View Videos', link: '/app/pipeline' },
  { icon: '📦', color: '#F59E0B', text: 'FitZone Gym has consumed 92% of their monthly package (11/12 videos).', action: 'View Package', link: '/app/packages' },
  { icon: '👤', color: '#3B82F6', text: 'Omar Tarek has 15 active tasks this week. Consider redistributing to Nour Ibrahim.', action: 'View Team', link: '/app/team' },
  { icon: '✅', color: '#10B981', text: '5 approved videos are not yet scheduled for posting. Schedule now to stay on track.', action: 'Open Calendar', link: '/app/calendar' },
]

function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: any, label: string, value: string | number, sub?: string, color: string, trend?: number
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass-blue rounded-2xl p-5 relative overflow-hidden glass-hover">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-6 translate-x-6"
        style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-white mb-0.5">{value}</div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-blue rounded-xl px-4 py-3 shadow-xl border border-blue-500/20">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-semibold text-white">
          {p.name === 'revenue' ? formatCurrency(p.value) : p.value}
          <span className="text-[10px] text-slate-400 ml-1">{p.name === 'revenue' ? 'revenue' : 'videos'}</span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const activeClients = mockClients.filter((c) => c.status === 'active').length
  const inProduction = mockVideos.filter((v) => ['editing', 'internal_review', 'shooting'].includes(v.status)).length
  const awaitingReview = mockVideos.filter((v) => v.status === 'client_review').length
  const approvedReady = mockVideos.filter((v) => v.status === 'approved').length
  const urgent = mockTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length

  const videoCounts = pipelineStages.map((s) => ({
    ...s,
    count: mockVideos.filter((v) => v.status === s.id).length,
  }))

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
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — Here's what needs your attention today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/app/pipeline" className="btn-secondary text-xs py-2 px-4">
            <Film className="w-3.5 h-3.5" /> Pipeline
          </Link>
          <Link to="/client" className="btn-secondary text-xs py-2 px-4">
            <Video className="w-3.5 h-3.5" /> Client Portal
          </Link>
          <Link to="/app/ai" className="btn-primary text-xs py-2 px-4">
            <Sparkles className="w-3.5 h-3.5" /> AI Studio
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Active Clients" value={activeClients} color="#3B82F6" trend={8} />
        <StatCard icon={Film} label="In Production" value={inProduction} sub="videos this week" color="#8B5CF6" />
        <StatCard icon={Clock} label="Awaiting Review" value={awaitingReview} sub="client review pending" color="#EAB308" />
        <StatCard icon={CheckCircle} label="Approved & Ready" value={approvedReady} sub="ready to schedule" color="#10B981" />
        <StatCard icon={AlertTriangle} label="Urgent Tasks" value={urgent} color="#EF4444" />
        <StatCard icon={DollarSign} label="May Revenue" value="$21.1K" sub="vs $21.6K last month" color="#06B6D4" trend={-2} />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Revenue chart */}
        <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Revenue & Output Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Revenue</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" />Videos</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="videos" stroke="#8B5CF6" strokeWidth={2} fill="url(#vidGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Video status donut */}
        <div className="glass-blue rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Videos by Status</h3>
          <p className="text-xs text-slate-500 mb-4">Current pipeline breakdown</p>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={videoStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                  {videoStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {videoStatusData.map(({ status, value, color }) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-slate-400">{status}</span>
                </div>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline mini view + AI Insights */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Pipeline overview */}
        <div className="glass-blue rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Live Pipeline</h3>
            <Link to="/app/pipeline" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Full board <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {videoCounts.filter((s) => s.count > 0).map(({ label, color, count }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="text-[11px] text-slate-400 w-28 flex-shrink-0">{label}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / mockVideos.length) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: color }} />
                </div>
                <span className="text-xs font-bold text-white w-4 text-right">{count}</span>
              </div>
            ))}
          </div>

          {/* Recent video items */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-3">Recent Activity</div>
            <div className="space-y-2">
              {mockVideos.slice(0, 3).map((v) => {
                const sc = statusColors[v.status] ?? statusColors.idea
                return (
                  <Link key={v.id} to={`/app/pipeline/${v.id}`}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors -mx-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{v.title}</p>
                      <p className="text-[10px] text-slate-500">{v.clientName}</p>
                    </div>
                    <span className="badge text-[10px]" style={{ background: sc.bg, color: sc.text }}>{v.status.replace('_', ' ')}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-blue rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(59,130,246,0.2))' }}>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Insights</h3>
              <p className="text-[10px] text-slate-500">Actionable intelligence for today</p>
            </div>
          </div>
          <div className="space-y-3">
            {aiInsights.map(({ icon, color, text, action, link }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-3 p-3.5 rounded-xl"
                style={{ background: `${color}09`, border: `1px solid ${color}20` }}>
                <span className="text-base flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
                  <Link to={link} className="text-[11px] font-semibold mt-1.5 inline-flex items-center gap-1"
                    style={{ color }}>
                    {action} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Activity + Package alerts + Quick tasks */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent activity */}
        <div className="lg:col-span-2 glass-blue rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Recent Activity</h3>
            <span className="text-xs text-slate-500">Live feed</span>
          </div>
          <div className="space-y-0">
            {mockActivity.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3 py-3"
                style={{ borderBottom: i < mockActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ background: a.userColor }}>
                  {getInitials(a.userName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-white">{a.userName}</span> {a.action}{' '}
                    <span className="text-blue-400 font-medium">{a.target}</span>
                    {a.clientName && <span className="text-slate-500"> — {a.clientName}</span>}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Package alerts */}
        <div className="glass-blue rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Package Usage</h3>
            <Link to="/app/packages" className="text-xs text-blue-400 flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {mockPackages.slice(0, 4).map((pkg) => {
              const pct = Math.round((pkg.consumedVideos / pkg.includedVideos) * 100)
              const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
              return (
                <div key={pkg.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-white truncate">{pkg.clientName}</span>
                    <span className="text-[11px] font-bold" style={{ color }}>
                      {pkg.consumedVideos}/{pkg.includedVideos}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: color }} />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">{pct}% consumed · renews {pkg.renewalDate}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
