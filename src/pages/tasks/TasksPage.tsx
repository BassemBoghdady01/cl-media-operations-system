import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, Plus, Search, Clock, AlertTriangle, Check,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { taskService } from '../../services/taskService'
import { statusColors, priorityColors, getInitials } from '../../lib/utils'
import type { Task } from '../../types'

const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'blocked'] as const
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', waiting: 'Waiting', done: 'Done', blocked: 'Blocked',
}
const STATUS_COLORS: Record<string, string> = {
  todo: '#64748B', in_progress: '#3B82F6', waiting: '#F59E0B', done: '#10B981', blocked: '#EF4444',
}

function TaskCard({ task, i, onToggle }: { task: Task; i: number; onToggle: (task: Task) => void }) {
  const pc = priorityColors[task.priority]
  const isOverdue = task.status !== 'done' && new Date(task.dueDate) < new Date()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      whileHover={{ y: -1 }}
      className="p-4 rounded-xl cursor-pointer"
      style={{ background: 'rgba(13,22,47,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>

      <div className="flex items-start gap-2.5 mb-2.5">
        {/* Checkbox — toggles done via taskService */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task) }}
          aria-label={task.status === 'done' ? 'Mark as to do' : 'Mark as done'}
          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${task.status === 'done' ? 'bg-green-500' : 'border border-slate-600 hover:border-blue-400'}`}>
          {task.status === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-snug ${task.status === 'done' ? 'line-through text-slate-600' : 'text-white'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{task.description}</p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="badge text-[10px]" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
        {task.clientName && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-400"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            {task.clientName}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" style={{ color: isOverdue ? '#EF4444' : '#64748B' }}>
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">{task.dueDate || 'No due date'}</span>
          {isOverdue && <AlertTriangle className="w-3 h-3" />}
        </div>
        {task.assignedToName && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              style={{ background: task.assignedToColor }}>
              {getInitials(task.assignedToName)}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function TasksPage() {
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterAssignee, setFilterAssignee] = useState('All')

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
        const data = await taskService.getAll(agencyId)
        if (cancelled) return
        setTasks(data)
      } catch (err) {
        if (cancelled) return
        console.error('[TasksPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load tasks.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  // Toggle done ↔ todo — optimistic, reverted if the write fails.
  const toggleDone = async (task: Task) => {
    const next: Task['status'] = task.status === 'done' ? 'todo' : 'done'
    const previous = tasks
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await taskService.updateStatus(task.id, next)
    } catch (err) {
      console.error('[TasksPage] status update failed', err)
      setTasks(previous)
    }
  }

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = filterPriority === 'All' || t.priority === filterPriority
    const matchAssignee = filterAssignee === 'All' || t.assignedToName === filterAssignee
    return matchSearch && matchPriority && matchAssignee
  })

  const assignees = ['All', ...new Set(tasks.map((t) => t.assignedToName).filter(Boolean))]
  const getByStatus = (status: string) => filtered.filter((t) => t.status === status)

  const done = tasks.filter((t) => t.status === 'done').length
  const urgent = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length
  const overdue = tasks.filter((t) => t.status !== 'done' && new Date(t.dueDate) < new Date()).length

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load your tasks"
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
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">{tasks.length} total · {done} done · {urgent} urgent · {overdue} overdue</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['board', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-3 mb-5">
        {STATUSES.map((s) => {
          const count = tasks.filter((t) => t.status === s).length
          return (
            <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-blue">
              <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
              <span className="text-[11px] text-slate-400">{STATUS_LABELS[s]}</span>
              <span className="text-[11px] font-bold text-white">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input className="input pl-9 py-2 text-xs w-56" placeholder="Search tasks…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input py-2 text-xs w-auto" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          {['All', 'urgent', 'high', 'medium', 'low'].map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="input py-2 text-xs w-auto" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          {assignees.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-20">
          <CheckSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No tasks yet</p>
          <p className="text-slate-600 text-xs mt-1">Tasks you create will appear here.</p>
        </div>
      )}

      {/* Board view */}
      {!loading && tasks.length > 0 && view === 'board' && (
        <div className="overflow-x-auto pb-4 no-scrollbar">
          <div className="flex gap-4 min-w-max">
            {STATUSES.map((status) => {
              const colTasks = getByStatus(status)
              const color = STATUS_COLORS[status]
              return (
                <div key={status} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-xs font-semibold text-slate-300">{STATUS_LABELS[status]}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="min-h-20 rounded-xl p-2 space-y-2"
                    style={{ background: `${color}05`, border: `1px solid ${color}12` }}>
                    <AnimatePresence>
                      {colTasks.map((t, i) => (
                        <TaskCard key={t.id} task={t} i={i} onToggle={(task) => void toggleDone(task)} />
                      ))}
                    </AnimatePresence>
                    {colTasks.length === 0 && (
                      <div className="flex items-center justify-center h-14 text-[10px] text-slate-700">Empty</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {!loading && tasks.length > 0 && view === 'list' && (
        <div className="glass-blue rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-wide"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="flex-1">Task</span>
            <span className="w-20">Priority</span>
            <span className="w-24 hidden md:block">Assignee</span>
            <span className="w-24">Status</span>
            <span className="w-24 hidden sm:block">Due Date</span>
          </div>
          {filtered.map((t, i) => {
            const pc = priorityColors[t.priority]
            const sc = statusColors[t.status]
            const isOverdue = t.status !== 'done' && new Date(t.dueDate) < new Date()
            return (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => void toggleDone(t)}
                    aria-label={t.status === 'done' ? 'Mark as to do' : 'Mark as done'}
                    className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${t.status === 'done' ? 'bg-green-500' : 'border border-slate-700 hover:border-blue-400'}`}>
                    {t.status === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>{t.title}</p>
                    {t.clientName && <p className="text-[10px] text-slate-600">{t.clientName}</p>}
                  </div>
                </div>
                <span className="badge text-[10px] w-20 justify-center" style={{ background: pc.bg, color: pc.text }}>{t.priority}</span>
                <div className="hidden md:flex items-center gap-1.5 w-24">
                  {t.assignedToName ? (
                    <>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                        style={{ background: t.assignedToColor }}>
                        {getInitials(t.assignedToName)}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate">{t.assignedToName.split(' ')[0]}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-600">Unassigned</span>
                  )}
                </div>
                <span className="badge text-[10px] w-24 justify-center" style={{ background: sc?.bg, color: sc?.text }}>
                  {STATUS_LABELS[t.status]}
                </span>
                <div className="hidden sm:flex items-center gap-1 w-24" style={{ color: isOverdue ? '#EF4444' : '#64748B' }}>
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px]">{t.dueDate || '—'}</span>
                </div>
              </motion.div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-10">No tasks match your filters.</p>
          )}
        </div>
      )}
    </motion.div>
  )
}
