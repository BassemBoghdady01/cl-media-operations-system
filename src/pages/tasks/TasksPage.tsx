import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, Plus, Search, Clock, AlertTriangle, X, Upload, Paperclip, RotateCcw, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import TaskDrawer from '../../components/tasks/TaskDrawer'
import {
  BOARD_COLUMNS, STATUS_COLORS, STATUS_LABELS, errorText, isOverdue, needsMyAction, formatBytes,
} from '../../components/tasks/taskWorkflow'
import { taskService, TASK_FILE_MAX_BYTES } from '../../services/taskService'
import { clientService } from '../../services/clientService'
import { userService, type ManagedUser } from '../../services/userService'
import { toastSuccess, toastError } from '../../lib/toast'
import { normalizeRole, ROLES } from '../../config/roles'
import { priorityColors, getInitials } from '../../lib/utils'
import type { Task, Client } from '../../types'

type Scope = 'action' | 'mine' | 'review' | 'all'

function TaskCard({ task, i, highlight, onOpen }: { task: Task; i: number; highlight: boolean; onOpen: (t: Task) => void }) {
  const pc = priorityColors[task.priority]
  const overdue = isOverdue(task)
  const sideStatus = task.status === 'waiting' || task.status === 'blocked'

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.3) }}
      whileHover={{ y: -1 }}
      onClick={() => onOpen(task)}
      className="w-full text-left p-3.5 rounded-xl"
      style={{
        background: 'rgba(13,22,47,0.85)',
        border: highlight ? '1px solid rgba(59,130,246,0.55)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: highlight ? '0 0 0 3px rgba(59,130,246,0.08)' : undefined,
      }}>
      <p className="text-xs font-semibold leading-snug text-white mb-1.5 line-clamp-2">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="badge text-[10px]" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
        {task.clientName && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-400" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {task.clientName}
          </span>
        )}
        {sideStatus && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
            style={{ color: STATUS_COLORS[task.status], background: `${STATUS_COLORS[task.status]}1A` }}>
            {STATUS_LABELS[task.status]}
          </span>
        )}
        {(task.revisionCount ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-orange-300"><RotateCcw className="w-2.5 h-2.5" />{task.revisionCount}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" style={{ color: overdue ? '#EF4444' : '#64748B' }}>
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">{task.dueDate || 'No due date'}</span>
          {overdue && <AlertTriangle className="w-3 h-3" />}
        </div>
        <div className="flex items-center gap-1">
          {task.reviewerName && (
            <span title={`Team leader: ${task.reviewerName}`} className="text-slate-500"><ShieldCheck className="w-3 h-3" /></span>
          )}
          {task.assignedToName && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              title={task.assignedToName} style={{ background: task.assignedToColor }}>
              {getInitials(task.assignedToName)}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── New Task modal ───────────────────────────────────────────────────────────

interface NewTaskForm {
  title: string
  description: string
  assignedTo: string
  reviewerId: string
  clientId: string
  priority: Task['priority']
  dueDate: string
  requiresFinalApproval: boolean
}

const EMPTY_TASK_FORM: NewTaskForm = {
  title: '', description: '', assignedTo: '', reviewerId: '', clientId: '', priority: 'medium',
  dueDate: '', requiresFinalApproval: true,
}

function AddTaskModal({
  members, clients, saving, error, onSubmit, onClose,
}: {
  members: ManagedUser[]
  clients: Client[]
  saving: boolean
  error: string | null
  onSubmit: (form: NewTaskForm, files: File[]) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<NewTaskForm>(EMPTY_TASK_FORM)
  const [files, setFiles] = useState<File[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<NewTaskForm>) => setForm((f) => ({ ...f, ...patch }))
  const valid = form.title.trim().length > 0
  const sameReviewer = !!form.reviewerId && form.reviewerId === form.assignedTo

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">New Task</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Title</label>
            <input className="input py-2 text-xs mt-1" placeholder="e.g. 4 feed posts for October"
              value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Brief</label>
            <textarea className="input py-2 text-xs mt-1 min-h-[80px]" placeholder="What to deliver, references, sizes, copy…"
              value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Assignee</label>
              <select className="input py-2 text-xs mt-1" value={form.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Team leader (1st review)</label>
              <select className="input py-2 text-xs mt-1" value={form.reviewerId} onChange={(e) => set({ reviewerId: e.target.value })}>
                <option value="">None — straight to final</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Client</label>
              <select className="input py-2 text-xs mt-1" value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                <option value="">Internal / no client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.brandName || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Due date</label>
              <input type="date" className="input py-2 text-xs mt-1" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Priority</label>
              <select className="input py-2 text-xs mt-1" value={form.priority}
                onChange={(e) => set({ priority: e.target.value as Task['priority'] })}>
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 sm:pt-5">
              <input type="checkbox" checked={form.requiresFinalApproval}
                onChange={(e) => set({ requiresFinalApproval: e.target.checked })} />
              Needs final approval (2nd review)
            </label>
          </div>
          {sameReviewer && (
            <p className="text-[11px] text-amber-300">The assignee can't review their own work — their submission will skip to final approval.</p>
          )}

          <div>
            <input ref={fileInput} type="file" multiple hidden
              onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
            <button className="btn-ghost text-xs" onClick={() => fileInput.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Attach brief files
            </button>
            {files.length > 0 && (
              <div className="grid gap-1 mt-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Paperclip className="w-3 h-3 text-blue-400" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className={f.size > TASK_FILE_MAX_BYTES ? 'text-red-400' : 'text-slate-500'}>{formatBytes(f.size)}</span>
                    <button aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <button className="btn-primary w-full justify-center text-xs py-2.5 disabled:opacity-50"
            disabled={!valid || saving} onClick={() => onSubmit(form, files)}>
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const me = user?.id
  const canManage = hasPermission('tasks.manage')
  const canApprove = hasPermission('tasks.approve')
  const [params, setParams] = useSearchParams()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [scope, setScope] = useState<Scope>(canManage || canApprove ? 'all' : 'action')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('All')
  const [filterClient, setFilterClient] = useState('All')

  const [members, setMembers] = useState<ManagedUser[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const openId = params.get('task')
  const openTask = useMemo(() => tasks.find((t) => t.id === openId) ?? null, [tasks, openId])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!agencyId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setError(null)
      try {
        const data = await taskService.getAll(agencyId)
        if (!cancelled) setTasks(data)
      } catch (err) {
        if (!cancelled) setError(errorText(err, 'Could not load tasks.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  // Pickers — needed for create + edit. Failure only limits the forms.
  useEffect(() => {
    if (!agencyId) return
    let cancelled = false
    Promise.all([userService.listUsers(agencyId), clientService.getAll(agencyId)])
      .then(([u, c]) => {
        if (cancelled) return
        setMembers(u.filter((x) => normalizeRole(x.role) !== ROLES.CLIENT && x.status !== 'inactive'))
        setClients(c)
      })
      .catch((err) => console.warn('[TasksPage] pickers', err))
    return () => { cancelled = true }
  }, [agencyId])

  const setOpen = (t: Task | null) => {
    const next = new URLSearchParams(params)
    if (t) next.set('task', t.id); else next.delete('task')
    setParams(next, { replace: true })
  }

  const createTask = async (form: NewTaskForm, files: File[]) => {
    if (creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const t = await taskService.create(agencyId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignedTo: form.assignedTo || undefined,
        reviewerId: form.reviewerId || undefined,
        clientId: form.clientId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        requiresFinalApproval: form.requiresFinalApproval,
        status: 'todo',
      })
      for (const f of files) {
        try { await taskService.uploadFile(agencyId, t.id, f, 'brief') }
        catch (err) { toastError(errorText(err, `Could not attach ${f.name}.`)) }
      }
      toastSuccess(form.assignedTo ? 'Task created — the assignee was notified.' : 'Task created.')
      setShowCreate(false)
      reload()
    } catch (err) {
      const msg = errorText(err, 'Could not create the task.')
      setCreateError(msg)
      toastError(msg)
    } finally {
      setCreating(false)
    }
  }

  const scoped = tasks.filter((t) => {
    if (scope === 'action') return needsMyAction(t, me, canApprove)
    if (scope === 'mine') return t.assignedTo === me
    if (scope === 'review') return (t.status === 'submitted' && (t.reviewerId === me || canApprove))
      || (t.status === 'in_final_review' && canApprove)
    return true
  })
  const filtered = scoped.filter((t) => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.clientName ?? '').toLowerCase().includes(q)
    const matchAssignee = filterAssignee === 'All' || t.assignedToName === filterAssignee
    const matchClient = filterClient === 'All' || (t.clientName ?? 'Internal') === filterClient
    return matchSearch && matchAssignee && matchClient
  })

  const assignees = ['All', ...new Set(tasks.map((t) => t.assignedToName).filter(Boolean))]
  const clientNames = ['All', ...new Set(tasks.map((t) => t.clientName ?? 'Internal'))]
  const actionCount = tasks.filter((t) => needsMyAction(t, me, canApprove)).length
  const reviewCount = tasks.filter((t) => (t.status === 'submitted' && (t.reviewerId === me || canApprove))
    || (t.status === 'in_final_review' && canApprove)).length
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const overdueCount = tasks.filter(isOverdue).length

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageErrorState title="We couldn't load your tasks" message={error} onRetry={reload} />
      </div>
    )
  }

  const SCOPES: { key: Scope; label: string; count?: number }[] = [
    { key: 'action', label: 'Needs my action', count: actionCount },
    { key: 'mine', label: 'Assigned to me' },
    { key: 'review', label: 'To review', count: reviewCount },
    { key: 'all', label: 'All tasks' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">
            {tasks.length} total · {doneCount} approved · {reviewCount} waiting review · {overdueCount} overdue
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['board', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => { setCreateError(null); setShowCreate(true) }}>
              <Plus className="w-4 h-4" /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Scope tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl mb-4 w-fit max-w-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {SCOPES.map((s) => (
          <button key={s.key} onClick={() => setScope(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${scope === s.key ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            style={scope === s.key ? { background: 'rgba(59,130,246,0.2)' } : undefined}>
            {s.label}
            {!!s.count && <span className="text-[10px] font-bold px-1.5 rounded-full bg-blue-500/25 text-blue-300">{s.count}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input className="input pl-9 py-2 text-xs w-full sm:w-56" placeholder="Search tasks or clients…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input py-2 text-xs w-auto" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} aria-label="Assignee">
          {assignees.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="input py-2 text-xs w-auto" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} aria-label="Client">
          {clientNames.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <CheckSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">
            {tasks.length === 0 ? 'No tasks yet' : scope === 'action' ? 'Nothing needs your action right now' : 'No tasks match'}
          </p>
          <p className="text-slate-600 text-xs mt-1">
            {tasks.length === 0 ? (canManage ? 'Create the first task with "Add Task".' : 'Tasks assigned to you will appear here.') : 'Try another tab or filter.'}
          </p>
        </div>
      )}

      {/* Board */}
      {!loading && filtered.length > 0 && view === 'board' && (
        <div className="overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 min-w-max">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => col.statuses.includes(t.status))
              return (
                <div key={col.key} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                      <span className="text-xs font-semibold text-slate-300">{col.label}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${col.color}18`, color: col.color }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="min-h-20 rounded-xl p-2 space-y-2" style={{ background: `${col.color}05`, border: `1px solid ${col.color}12` }}>
                    <AnimatePresence>
                      {colTasks.map((t, i) => (
                        <TaskCard key={t.id} task={t} i={i} highlight={needsMyAction(t, me, canApprove)} onOpen={setOpen} />
                      ))}
                    </AnimatePresence>
                    {colTasks.length === 0 && <div className="flex items-center justify-center h-14 text-[10px] text-slate-700">Empty</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && view === 'list' && (
        <div className="glass-blue rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-wide"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="flex-1">Task</span>
            <span className="w-20 hidden sm:block">Priority</span>
            <span className="w-28 hidden md:block">Assignee</span>
            <span className="w-32">Status</span>
            <span className="w-24 hidden sm:block">Due</span>
          </div>
          {filtered.map((t, i) => {
            const pc = priorityColors[t.priority]
            const c = STATUS_COLORS[t.status]
            const overdue = isOverdue(t)
            return (
              <button key={t.id} onClick={() => setOpen(t)}
                className="w-full text-left flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">{t.title}</p>
                  <p className="text-[10px] text-slate-600 truncate">{t.clientName ?? 'Internal'}{t.reviewerName ? ` · TL: ${t.reviewerName}` : ''}</p>
                </div>
                <span className="badge text-[10px] w-20 justify-center hidden sm:inline-flex" style={{ background: pc.bg, color: pc.text }}>{t.priority}</span>
                <div className="hidden md:flex items-center gap-1.5 w-28">
                  {t.assignedToName ? (
                    <>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                        style={{ background: t.assignedToColor }}>{getInitials(t.assignedToName)}</div>
                      <span className="text-[11px] text-slate-400 truncate">{t.assignedToName}</span>
                    </>
                  ) : <span className="text-[10px] text-slate-600">Unassigned</span>}
                </div>
                <span className="text-[10px] font-semibold w-32 px-2 py-1 rounded-lg text-center truncate"
                  style={{ color: c, background: `${c}1A` }}>{STATUS_LABELS[t.status]}</span>
                <div className="hidden sm:flex items-center gap-1 w-24" style={{ color: overdue ? '#EF4444' : '#64748B' }}>
                  <Clock className="w-3 h-3" /><span className="text-[10px]">{t.dueDate || '—'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <AddTaskModal members={members} clients={clients} saving={creating} error={createError}
            onSubmit={(f, files) => void createTask(f, files)} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openTask && (
          <TaskDrawer key={openTask.id} task={openTask} members={members} clients={clients}
            onClose={() => setOpen(null)} onChanged={reload} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
