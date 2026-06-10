import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  UserCheck, Plus, Mail, MoreHorizontal, Film, CheckSquare,
  Clock, TrendingUp, Zap, Circle, Users,
} from 'lucide-react'
import { mockTeamMembers, mockTasks, mockVideos } from '../../data/mockData'
import { getInitials, statusColors } from '../../lib/utils'
import type { TeamMember } from '../../types'

const roleLabels: Record<string, string> = {
  agency_admin: 'Admin',
  project_manager: 'Project Manager',
  editor: 'Video Editor',
  social_manager: 'Social Media',
  creator: 'Creator',
  accountant: 'Accountant',
}

const availabilityConfig = {
  available: { color: '#10B981', label: 'Available' },
  busy: { color: '#F59E0B', label: 'Busy' },
  off: { color: '#64748B', label: 'Off today' },
}

function MemberCard({ member, i }: { member: TeamMember; i: number }) {
  const memberTasks = mockTasks.filter((t) => t.assignedTo === member.id)
  const activeTasks = memberTasks.filter((t) => t.status !== 'done').length
  const urgentTasks = memberTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length
  const memberVideos = mockVideos.filter((v) => v.assignedEditor === member.id)
  const inProgressVideos = memberVideos.filter((v) => ['editing', 'internal_review'].includes(v.status)).length
  const avail = availabilityConfig[member.availability]
  const workloadPct = Math.min(100, Math.round((activeTasks / 15) * 100))
  const workloadColor = workloadPct >= 80 ? '#EF4444' : workloadPct >= 60 ? '#F59E0B' : '#10B981'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.07 }}
      whileHover={{ y: -3 }}
      className="glass-blue rounded-2xl p-5">

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white"
              style={{ background: `linear-gradient(135deg, ${member.color}, ${member.color}88)` }}>
              {getInitials(member.name)}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#04081A]"
              style={{ background: avail.color }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{member.name}</h3>
            <p className="text-[11px] text-slate-500">{roleLabels[member.role] ?? member.role}</p>
          </div>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${avail.color}18`, color: avail.color }}>
          {avail.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)' }}>
          <div className="text-base font-black text-blue-400">{activeTasks}</div>
          <div className="text-[9px] text-slate-500">Active Tasks</div>
        </div>
        <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)' }}>
          <div className="text-base font-black text-green-400">{member.completedThisWeek}</div>
          <div className="text-[9px] text-slate-500">Done This Week</div>
        </div>
        <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)' }}>
          <div className="text-base font-black text-purple-400">{inProgressVideos}</div>
          <div className="text-[9px] text-slate-500">In Editing</div>
        </div>
      </div>

      {/* Workload bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5 text-[10px]">
          <span className="text-slate-500">Workload</span>
          <span style={{ color: workloadColor }}>{workloadPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${workloadPct}%` }}
            transition={{ duration: 0.8, delay: i * 0.07 }}
            className="h-full rounded-full"
            style={{ background: workloadColor }} />
        </div>
      </div>

      {/* Urgent alert */}
      {urgentTasks > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-[11px]"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5' }}>
          <Zap className="w-3 h-3 flex-shrink-0" />
          {urgentTasks} urgent task{urgentTasks > 1 ? 's' : ''} pending
        </div>
      )}

      {/* Email + action */}
      <div className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-[10px] text-slate-600 truncate max-w-[130px]">{member.email}</span>
        <button className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Assign Task →
        </button>
      </div>
    </motion.div>
  )
}

export default function TeamPage() {
  const [search, setSearch] = useState('')

  const filtered = mockTeamMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  )

  const totalActiveTasks = mockTasks.filter((t) => t.status !== 'done').length
  const availableCount = mockTeamMembers.filter((m) => m.availability === 'available').length
  const busyCount = mockTeamMembers.filter((m) => m.availability === 'busy').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Team</h1>
          <p className="text-slate-400 text-sm mt-1">{mockTeamMembers.length} members · {availableCount} available · {busyCount} busy</p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: 'Team Members', value: mockTeamMembers.length, color: '#3B82F6' },
          { icon: CheckSquare, label: 'Active Tasks', value: totalActiveTasks, color: '#8B5CF6' },
          { icon: Film, label: 'Videos in Editing', value: mockVideos.filter((v) => v.status === 'editing').length, color: '#06B6D4' },
          { icon: TrendingUp, label: 'Completed This Week', value: mockTeamMembers.reduce((s, m) => s + m.completedThisWeek, 0), color: '#10B981' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-blue rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-black text-white">{value}</div>
              <div className="text-[10px] text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6 max-w-sm">
        <input className="input py-2 text-xs" placeholder="Search team members…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Team grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((member, i) => (
          <MemberCard key={member.id} member={member} i={i} />
        ))}
      </div>

      {/* Workload comparison */}
      <div className="mt-8 glass-blue rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-5">Team Workload Overview</h2>
        <div className="space-y-4">
          {mockTeamMembers.map((m) => {
            const tasks = mockTasks.filter((t) => t.assignedTo === m.id && t.status !== 'done').length
            const pct = Math.min(100, Math.round((tasks / 15) * 100))
            const color = pct >= 80 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#10B981'
            const avail = availabilityConfig[m.availability]
            return (
              <div key={m.id} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                  style={{ background: m.color }}>
                  {getInitials(m.name)}
                </div>
                <div className="w-28 flex-shrink-0">
                  <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-500">{roleLabels[m.role]}</p>
                </div>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: color }} />
                </div>
                <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: avail.color }} />
                  <span className="text-[10px] text-slate-400">{tasks} tasks</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
