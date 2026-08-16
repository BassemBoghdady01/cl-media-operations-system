import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Film, CheckSquare, TrendingUp, Zap, Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { userService, type ManagedUser } from '../../services/userService'
import { taskService } from '../../services/taskService'
import { videoService } from '../../services/videoService'
import { getInitials } from '../../lib/utils'
import { ROLE_LABELS, ROLES, normalizeRole } from '../../config/roles'
import type { Task, Video } from '../../types'

const availabilityConfig = {
  available: { color: '#10B981', label: 'Available' },
  busy: { color: '#F59E0B', label: 'Busy' },
  off: { color: '#64748B', label: 'Off' },
} as const

type Availability = keyof typeof availabilityConfig

/** Video statuses that count as "in production" for a member. */
const IN_PROGRESS_VIDEO_STATUSES = ['shooting', 'editing', 'internal_review']

/** How many concurrent active tasks we treat as a full plate. */
const FULL_WORKLOAD_TASKS = 15
const BUSY_THRESHOLD_TASKS = 5

interface MemberStats {
  id: string
  name: string
  email: string
  roleLabel: string
  color: string
  activeTasks: number
  urgentTasks: number
  inProgressVideos: number
  completedThisWeek: number
  availability: Availability
}

/** [start, end) of the current calendar week (Monday-based), as epoch ms. */
function currentWeekRange(): [number, number] {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return [start.getTime(), start.getTime() + 7 * 24 * 60 * 60 * 1000]
}

function MemberCard({ member, i }: { member: MemberStats; i: number }) {
  const avail = availabilityConfig[member.availability]
  const workloadPct = Math.min(100, Math.round((member.activeTasks / FULL_WORKLOAD_TASKS) * 100))
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
            <p className="text-[11px] text-slate-500">{member.roleLabel}</p>
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
          <div className="text-base font-black text-blue-400">{member.activeTasks}</div>
          <div className="text-[9px] text-slate-500">Active Tasks</div>
        </div>
        <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)' }}>
          <div className="text-base font-black text-green-400">{member.completedThisWeek}</div>
          <div className="text-[9px] text-slate-500">Done This Week</div>
        </div>
        <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)' }}>
          <div className="text-base font-black text-purple-400">{member.inProgressVideos}</div>
          <div className="text-[9px] text-slate-500">In Production</div>
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
      {member.urgentTasks > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-[11px]"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5' }}>
          <Zap className="w-3 h-3 flex-shrink-0" />
          {member.urgentTasks} urgent task{member.urgentTasks > 1 ? 's' : ''} pending
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
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')

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
        const [userData, taskData, videoData] = await Promise.all([
          userService.listUsers(agencyId),
          taskService.getAll(agencyId),
          videoService.getAll(agencyId),
        ])
        if (cancelled) return
        setUsers(userData)
        setTasks(taskData)
        setVideos(videoData)
      } catch (err) {
        if (cancelled) return
        console.error('[TeamPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load the team.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  // Per-member stats derived from real tasks and videos. Availability is
  // derived, not stored: inactive profile → off, >5 active tasks → busy.
  const members: MemberStats[] = useMemo(() => {
    const [weekStart, weekEnd] = currentWeekRange()
    return users
      .filter((u) => normalizeRole(u.role) !== ROLES.CLIENT)
      .map((u) => {
        const memberTasks = tasks.filter((t) => t.assignedTo === u.id)
        const activeTasks = memberTasks.filter((t) => t.status !== 'done').length
        const urgentTasks = memberTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length
        const inProgressVideos = videos.filter(
          (v) => v.assignedEditor === u.id && IN_PROGRESS_VIDEO_STATUSES.includes(v.status)
        ).length
        const completedThisWeek = memberTasks.filter((t) => {
          if (t.status !== 'done') return false
          const due = new Date(t.dueDate).getTime()
          return Number.isFinite(due) && due >= weekStart && due < weekEnd
        }).length

        const normalized = normalizeRole(u.role)
        const availability: Availability =
          u.status === 'inactive' ? 'off' : activeTasks > BUSY_THRESHOLD_TASKS ? 'busy' : 'available'

        return {
          id: u.id,
          name: u.full_name || u.email,
          email: u.email,
          roleLabel: normalized ? ROLE_LABELS[normalized] : u.role,
          color: u.color,
          activeTasks,
          urgentTasks,
          inProgressVideos,
          completedThisWeek,
          availability,
        }
      })
  }, [users, tasks, videos])

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.roleLabel.toLowerCase().includes(search.toLowerCase())
  )

  const totalActiveTasks = tasks.filter((t) => t.status !== 'done').length
  const availableCount = members.filter((m) => m.availability === 'available').length
  const busyCount = members.filter((m) => m.availability === 'busy').length
  const completedThisWeekTotal = members.reduce((s, m) => s + m.completedThisWeek, 0)

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load the team"
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
          <h1 className="text-2xl font-black text-white">Team</h1>
          <p className="text-slate-400 text-sm mt-1">{members.length} members · {availableCount} available · {busyCount} busy</p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: 'Team Members', value: members.length, color: '#3B82F6' },
          { icon: CheckSquare, label: 'Active Tasks', value: totalActiveTasks, color: '#8B5CF6' },
          { icon: Film, label: 'Videos in Editing', value: videos.filter((v) => v.status === 'editing').length, color: '#06B6D4' },
          { icon: TrendingUp, label: 'Completed This Week', value: completedThisWeekTotal, color: '#10B981' },
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && members.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No team members yet</p>
          <p className="text-slate-600 text-xs mt-1">Invite teammates and they will appear here.</p>
        </div>
      )}

      {/* Team grid */}
      {!loading && members.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((member, i) => (
              <MemberCard key={member.id} member={member} i={i} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No team members match your search.</p>
            </div>
          )}

          {/* Workload comparison */}
          <div className="mt-8 glass-blue rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white mb-5">Team Workload Overview</h2>
            <div className="space-y-4">
              {members.map((m) => {
                const pct = Math.min(100, Math.round((m.activeTasks / FULL_WORKLOAD_TASKS) * 100))
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
                      <p className="text-[10px] text-slate-500 truncate">{m.roleLabel}</p>
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
                      <span className="text-[10px] text-slate-400">{m.activeTasks} tasks</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
