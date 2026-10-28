/**
 * Task drawer — everything that happens on one task:
 *   brief → submit work (files + links + note) → team-leader review →
 *   final approval, with every version, decision and comment kept.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X, Upload, Link2, Paperclip, Send, CheckCircle2, RotateCcw, Trash2, Play,
  MessageSquare, FileText, ExternalLink, Clock, User, ShieldCheck, AlertTriangle, Pencil,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  taskService, type TaskDetail, type TaskFile, type TaskLink,
} from '../../services/taskService'
import type { ManagedUser } from '../../services/userService'
import type { Task, Client } from '../../types'
import { toastError, toastSuccess } from '../../lib/toast'
import { getInitials, priorityColors } from '../../lib/utils'
import {
  STATUS_COLORS, STATUS_LABELS, OPEN_FOR_WORK, errorText, formatBytes, timeAgo, isOverdue,
} from './taskWorkflow'

const EMPTY_DETAIL: TaskDetail = { submissions: [], files: [], reviews: [], comments: [] }

function Section({ title, icon: Icon, children, action }: {
  title: string; icon: typeof FileText; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          <Icon className="w-3.5 h-3.5" /> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Avatar({ name, color = '#3B82F6', size = 22 }: { name: string; color?: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {getInitials(name || '?')}
    </div>
  )
}

function FileChip({ file, onOpen, onRemove }: {
  file: TaskFile; onOpen: (f: TaskFile) => void; onRemove?: (f: TaskFile) => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
      style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
      <Paperclip className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <button className="text-left text-slate-200 hover:text-white truncate flex-1 min-w-0" onClick={() => onOpen(file)}
        title={file.fileName}>
        {file.fileName}
      </button>
      <span className="text-[10px] text-slate-500 flex-shrink-0">{formatBytes(file.sizeBytes)}</span>
      {onRemove && (
        <button aria-label={`Remove ${file.fileName}`} onClick={() => onRemove(file)}
          className="text-slate-500 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
      )}
    </div>
  )
}

function LinkChip({ link }: { link: TaskLink }) {
  let host = link.url
  try { host = new URL(link.url).hostname.replace(/^www\./, '') } catch { /* keep raw */ }
  return (
    <a href={link.url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white"
      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
      <Link2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
      <span className="truncate flex-1 min-w-0">{link.label || host}</span>
      <span className="text-[10px] text-slate-500 flex-shrink-0">{link.label ? host : ''}</span>
      <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
    </a>
  )
}

// ─── Edit form (managers) ─────────────────────────────────────────────────────

function EditTaskForm({ task, members, clients, onSaved, onCancel }: {
  task: Task; members: ManagedUser[]; clients: Client[]; onSaved: () => void; onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: task.title, description: task.description ?? '', assignedTo: task.assignedTo ?? '',
    reviewerId: task.reviewerId ?? '', clientId: task.clientId ?? '', priority: task.priority,
    dueDate: task.dueDate ?? '', requiresFinalApproval: task.requiresFinalApproval ?? true,
  })
  const [saving, setSaving] = useState(false)
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  const save = async () => {
    setSaving(true)
    try {
      await taskService.update(task.id, { ...form, title: form.title.trim() })
      toastSuccess('Task updated.')
      onSaved()
    } catch (err) {
      toastError(errorText(err, 'Could not update the task.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <input className="input py-2 text-xs" value={form.title} onChange={(e) => set({ title: e.target.value })} />
      <textarea className="input py-2 text-xs min-h-[70px]" value={form.description}
        onChange={(e) => set({ description: e.target.value })} placeholder="Brief / description" />
      <div className="grid grid-cols-2 gap-2">
        <select className="input py-2 text-xs" value={form.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
        <select className="input py-2 text-xs" value={form.reviewerId} onChange={(e) => set({ reviewerId: e.target.value })}>
          <option value="">No team leader</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
        <select className="input py-2 text-xs" value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
          <option value="">No client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.brandName || c.name}</option>)}
        </select>
        <input type="date" className="input py-2 text-xs" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        <select className="input py-2 text-xs" value={form.priority} onChange={(e) => set({ priority: e.target.value as Task['priority'] })}>
          {(['low', 'medium', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 px-1">
          <input type="checkbox" checked={form.requiresFinalApproval}
            onChange={(e) => set({ requiresFinalApproval: e.target.checked })} />
          Needs final approval
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-xs" disabled={saving || !form.title.trim()} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function TaskDrawer({
  task, members, clients, onClose, onChanged,
}: {
  task: Task
  members: ManagedUser[]
  clients: Client[]
  onClose: () => void
  onChanged: () => void
}) {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const me = user?.id
  const canManage = hasPermission('tasks.manage')
  const canApprove = hasPermission('tasks.approve')

  const [detail, setDetail] = useState<TaskDetail>(EMPTY_DETAIL)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  // Submission draft
  const [note, setNote] = useState('')
  const [links, setLinks] = useState<TaskLink[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [uploading, setUploading] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const briefInput = useRef<HTMLInputElement>(null)

  // Review draft
  const [reviewComment, setReviewComment] = useState('')
  // Comment draft
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    try {
      setDetail(await taskService.getDetail(task.id))
    } catch (err) {
      toastError(errorText(err, 'Could not load the task history.'))
    } finally {
      setLoading(false)
    }
  }, [task.id])

  useEffect(() => { setLoading(true); void load() }, [load])

  const isAssignee = !!me && task.assignedTo === me
  const latest = detail.submissions[0]
  const iSubmittedLatest = !!latest && latest.submittedBy === me
  const canSubmit = (isAssignee || canManage) && OPEN_FOR_WORK.includes(task.status)
  const canLeaderReview = task.status === 'submitted' && !iSubmittedLatest && (task.reviewerId === me || canApprove)
  const canFinalReview = task.status === 'in_final_review' && canApprove && !iSubmittedLatest
  const reviewStageLabel = task.status === 'submitted' && task.reviewerId === me ? 'Team leader review' : 'Final approval'

  const pendingFiles = detail.files.filter((f) => f.kind === 'submission' && !f.submissionId && f.uploadedBy === me)
  const briefFiles = detail.files.filter((f) => f.kind === 'brief')
  const lastChangeRequest = [...detail.reviews].reverse().find((r) => r.decision === 'changes_requested')

  const openFile = async (f: TaskFile) => {
    try {
      window.open(await taskService.fileUrl(f), '_blank', 'noopener')
    } catch (err) {
      toastError(errorText(err, 'Could not open the file.'))
    }
  }

  const uploadFiles = async (files: FileList | null, kind: 'brief' | 'submission') => {
    if (!files?.length) return
    const list = Array.from(files)
    setUploading((n) => n + list.length)
    for (const f of list) {
      try {
        await taskService.uploadFile(agencyId, task.id, f, kind)
      } catch (err) {
        toastError(errorText(err, `Could not upload ${f.name}.`))
      } finally {
        setUploading((n) => n - 1)
      }
    }
    await load()
  }

  const removeFile = async (f: TaskFile) => {
    try {
      await taskService.removeFile(f)
      await load()
    } catch (err) {
      toastError(errorText(err, 'Could not remove the file.'))
    }
  }

  const addLink = () => {
    let url = linkUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try { new URL(url) } catch { toastError('That link doesn\'t look right.'); return }
    setLinks((l) => [...l, { url, label: linkLabel.trim() || undefined }])
    setLinkUrl(''); setLinkLabel('')
  }

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const start = () => run(async () => {
    try {
      await taskService.updateStatus(task.id, 'in_progress')
      toastSuccess('Marked as in progress.')
      onChanged()
    } catch (err) { toastError(errorText(err)) }
  })

  const setSimpleStatus = (status: 'todo' | 'waiting' | 'blocked' | 'in_progress') => run(async () => {
    try {
      await taskService.updateStatus(task.id, status)
      onChanged()
    } catch (err) { toastError(errorText(err)) }
  })

  const submit = () => run(async () => {
    const draftLinks = linkUrl.trim() ? [...links, { url: /^https?:\/\//i.test(linkUrl) ? linkUrl.trim() : `https://${linkUrl.trim()}`, label: linkLabel.trim() || undefined }] : links
    try {
      await taskService.submit(task.id, note.trim(), draftLinks, pendingFiles.map((f) => f.id))
      toastSuccess('Work submitted for review.')
      setNote(''); setLinks([]); setLinkUrl(''); setLinkLabel('')
      onChanged()
      await load()
    } catch (err) { toastError(errorText(err, 'Could not submit.')) }
  })

  const review = (decision: 'approved' | 'changes_requested') => run(async () => {
    if (decision === 'changes_requested' && !reviewComment.trim()) {
      toastError('Write what needs to change.')
      return
    }
    try {
      const next = await taskService.review(task.id, decision, reviewComment.trim())
      toastSuccess(
        decision === 'changes_requested' ? 'Sent back for changes.'
          : next === 'done' ? 'Approved — task complete.' : 'Approved — sent for final approval.'
      )
      setReviewComment('')
      onChanged()
      await load()
    } catch (err) { toastError(errorText(err, 'Could not save the review.')) }
  })

  const postComment = () => run(async () => {
    if (!comment.trim()) return
    try {
      await taskService.addComment(agencyId, task.id, comment.trim())
      setComment('')
      await load()
    } catch (err) { toastError(errorText(err, 'Could not post the comment.')) }
  })

  const remove = () => run(async () => {
    if (!window.confirm(`Delete "${task.title}"? This also removes its submissions and files.`)) return
    try {
      await taskService.remove(task.id)
      toastSuccess('Task deleted.')
      onChanged()
      onClose()
    } catch (err) { toastError(errorText(err)) }
  })

  const color = STATUS_COLORS[task.status]
  const pc = priorityColors[task.priority]
  const overdue = isOverdue(task)

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.aside
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[640px] overflow-y-auto"
        style={{ background: 'rgba(6,11,30,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        role="dialog" aria-label={task.title}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-5 sm:px-6 pt-5 pb-4"
          style={{ background: 'rgba(6,11,30,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                  style={{ color, background: `${color}1A`, border: `1px solid ${color}40` }}>
                  {STATUS_LABELS[task.status]}
                </span>
                <span className="badge text-[10px]" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
                {(task.revisionCount ?? 0) > 0 && (
                  <span className="text-[10px] text-orange-300">{task.revisionCount} revision{task.revisionCount === 1 ? '' : 's'}</span>
                )}
              </div>
              <h2 className="text-lg font-black text-white leading-snug break-words">{task.title}</h2>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {canManage && !editing && (
                <button aria-label="Edit task" onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canManage && (
                <button aria-label="Delete task" onClick={() => void remove()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/[0.08]">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button aria-label="Close" onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-[11px]">
            <div>
              <div className="text-slate-500 mb-1">Assignee</div>
              <div className="flex items-center gap-1.5 text-slate-200 min-w-0">
                {task.assignedToName ? <><Avatar name={task.assignedToName} color={task.assignedToColor} size={18} /><span className="truncate">{task.assignedToName}</span></> : <span className="text-slate-500">Unassigned</span>}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Team leader</div>
              <div className="text-slate-200 truncate">{task.reviewerName || <span className="text-slate-500">—</span>}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Due</div>
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-slate-200'}`}>
                <Clock className="w-3 h-3" />{task.dueDate || '—'}{overdue && <AlertTriangle className="w-3 h-3" />}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Client</div>
              <div className="text-slate-200 truncate">{task.clientName || <span className="text-slate-500">Internal</span>}</div>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          {editing ? (
            <Section title="Edit task" icon={Pencil}>
              <EditTaskForm task={task} members={members} clients={clients}
                onCancel={() => setEditing(false)}
                onSaved={() => { setEditing(false); onChanged() }} />
            </Section>
          ) : (
            <Section title="Brief" icon={FileText}
              action={canManage ? (
                <button className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  onClick={() => briefInput.current?.click()}>
                  <Upload className="w-3 h-3" /> Attach
                </button>
              ) : undefined}>
              <input ref={briefInput} type="file" multiple hidden
                onChange={(e) => { void uploadFiles(e.target.files, 'brief'); e.target.value = '' }} />
              {task.description
                ? <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                : <p className="text-xs text-slate-600">No brief written.</p>}
              {briefFiles.length > 0 && (
                <div className="grid gap-1.5 mt-3">
                  {briefFiles.map((f) => <FileChip key={f.id} file={f} onOpen={(x) => void openFile(x)}
                    onRemove={canManage ? (x) => void removeFile(x) : undefined} />)}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-500">
                <ShieldCheck className="w-3 h-3" />
                {task.reviewerName ? `Reviewed by ${task.reviewerName}` : 'No team-leader stage'}
                {task.requiresFinalApproval !== false ? ' → final approval by management' : ' · no final approval'}
              </div>
            </Section>
          )}

          {/* Changes requested banner */}
          {task.status === 'changes_requested' && lastChangeRequest && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <div className="flex items-center gap-2 text-xs font-bold text-orange-300 mb-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Changes requested by {lastChangeRequest.reviewerName || 'reviewer'}
              </div>
              <p className="text-sm text-orange-100/90 whitespace-pre-wrap">{lastChangeRequest.comment}</p>
            </div>
          )}

          {/* Assignee actions */}
          {canSubmit && (
            <Section title={task.status === 'changes_requested' ? 'Submit the revision' : 'Submit your work'} icon={Send}
              action={task.status === 'todo' ? (
                <button className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1" onClick={() => void start()}>
                  <Play className="w-3 h-3" /> Start working
                </button>
              ) : undefined}>
              <input ref={fileInput} type="file" multiple hidden
                onChange={(e) => { void uploadFiles(e.target.files, 'submission'); e.target.value = '' }} />
              <button
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void uploadFiles(e.dataTransfer.files, 'submission') }}
                className="w-full rounded-xl py-5 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                style={{ border: '1.5px dashed rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.03)' }}>
                <Upload className="w-5 h-5 text-blue-400" />
                {uploading > 0 ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}…` : 'Drop files here or click to upload'}
                <span className="text-[10px] text-slate-600">Up to 50 MB each — bigger files as a link</span>
              </button>

              {pendingFiles.length > 0 && (
                <div className="grid gap-1.5 mt-3">
                  {pendingFiles.map((f) => <FileChip key={f.id} file={f} onOpen={(x) => void openFile(x)} onRemove={(x) => void removeFile(x)} />)}
                </div>
              )}

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input className="input py-2 text-xs flex-1" placeholder="Paste a link (Drive, Canva, Figma, YouTube…)"
                  value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
                <input className="input py-2 text-xs sm:w-36" placeholder="Label (optional)"
                  value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
                <button className="btn-secondary text-xs justify-center" onClick={addLink}><Link2 className="w-3.5 h-3.5" /> Add</button>
              </div>
              {links.length > 0 && (
                <div className="grid gap-1.5 mt-2">
                  {links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0"><LinkChip link={l} /></div>
                      <button aria-label="Remove link" className="text-slate-500 hover:text-red-400"
                        onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              <textarea className="input py-2 text-xs mt-3 min-h-[64px]" placeholder="Note for the reviewer (what you did, what to check)…"
                value={note} onChange={(e) => setNote(e.target.value)} />

              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <div className="flex gap-1">
                  {task.status !== 'in_progress' && task.status !== 'todo' && task.status !== 'changes_requested' && (
                    <button className="btn-ghost text-[11px]" onClick={() => void setSimpleStatus('in_progress')}>Resume</button>
                  )}
                  {task.status !== 'waiting' && (
                    <button className="btn-ghost text-[11px]" onClick={() => void setSimpleStatus('waiting')}>Waiting</button>
                  )}
                  {task.status !== 'blocked' && (
                    <button className="btn-ghost text-[11px]" onClick={() => void setSimpleStatus('blocked')}>Blocked</button>
                  )}
                </div>
                <button className="btn-primary text-xs" disabled={busy || uploading > 0} onClick={() => void submit()}>
                  <Send className="w-3.5 h-3.5" /> {busy ? 'Submitting…' : 'Submit for review'}
                </button>
              </div>
            </Section>
          )}

          {/* Reviewer actions */}
          {(canLeaderReview || canFinalReview) && (
            <Section title={reviewStageLabel} icon={ShieldCheck}>
              <p className="text-xs text-slate-400 mb-2.5">
                Check version {latest?.version} below, then approve it or send it back with what to change.
              </p>
              <textarea className="input py-2 text-xs min-h-[70px]" placeholder="Feedback (required when requesting changes)…"
                value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
              <div className="flex flex-wrap gap-2 justify-end mt-3">
                <button className="btn-secondary text-xs" disabled={busy} onClick={() => void review('changes_requested')}
                  style={{ color: '#FDBA74', borderColor: 'rgba(249,115,22,0.35)' }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Request changes
                </button>
                <button className="btn-primary text-xs" disabled={busy} onClick={() => void review('approved')}
                  style={{ background: 'linear-gradient(135deg,#059669,#10B981)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {reviewStageLabel === 'Final approval' ? 'Final approve' : 'Approve'}
                </button>
              </div>
            </Section>
          )}

          {/* Waiting notice for the assignee */}
          {isAssignee && (task.status === 'submitted' || task.status === 'in_final_review') && (
            <div className="rounded-2xl p-4 text-xs text-cyan-200" style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.25)' }}>
              Submitted — waiting for {task.status === 'submitted' ? (task.reviewerName || 'the team leader') : 'final approval'}.
              You'll get a notification when it's reviewed.
            </div>
          )}

          {/* History */}
          <Section title={`Submissions (${detail.submissions.length})`} icon={Upload}>
            {loading ? (
              <div className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
            ) : detail.submissions.length === 0 ? (
              <p className="text-xs text-slate-600">Nothing submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {detail.submissions.map((s) => {
                  const files = detail.files.filter((f) => f.submissionId === s.id)
                  const reviews = detail.reviews.filter((r) => r.submissionId === s.id)
                  const sc = s.status === 'approved' ? '#10B981' : s.status === 'changes_requested' ? '#F97316'
                    : s.status === 'leader_approved' ? '#8B5CF6' : '#06B6D4'
                  const sl = s.status === 'approved' ? 'Approved' : s.status === 'changes_requested' ? 'Changes requested'
                    : s.status === 'leader_approved' ? 'Leader approved' : 'Pending review'
                  return (
                    <div key={s.id} className="rounded-xl p-3.5" style={{ background: 'rgba(13,22,47,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">v{s.version}</span>
                          <span className="text-[11px] text-slate-400">{s.submittedByName || 'Team member'} · {timeAgo(s.createdAt)}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: sc, background: `${sc}1A` }}>{sl}</span>
                      </div>
                      {s.note && <p className="text-xs text-slate-300 whitespace-pre-wrap mb-2">{s.note}</p>}
                      {(files.length > 0 || s.links.length > 0) && (
                        <div className="grid gap-1.5">
                          {files.map((f) => <FileChip key={f.id} file={f} onOpen={(x) => void openFile(x)} />)}
                          {s.links.map((l, i) => <LinkChip key={i} link={l} />)}
                        </div>
                      )}
                      {reviews.length > 0 && (
                        <div className="mt-2.5 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          {reviews.map((r) => (
                            <div key={r.id} className="text-[11px] flex gap-2">
                              {r.decision === 'approved'
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-px" />
                                : <RotateCcw className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-px" />}
                              <div className="min-w-0">
                                <span className="text-slate-200 font-semibold">{r.reviewerName || 'Reviewer'}</span>
                                <span className="text-slate-500"> · {r.stage === 'leader' ? 'team leader' : 'final'} · {timeAgo(r.createdAt)}</span>
                                {r.comment && <p className="text-slate-400 whitespace-pre-wrap mt-0.5">{r.comment}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Comments */}
          <Section title={`Comments (${detail.comments.length})`} icon={MessageSquare}>
            <div className="space-y-3 mb-3">
              {detail.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.authorName} color={c.authorColor} />
                  <div className="min-w-0">
                    <div className="text-[11px]"><span className="font-semibold text-slate-200">{c.authorName || 'User'}</span>
                      <span className="text-slate-500"> · {timeAgo(c.createdAt)}</span></div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                </div>
              ))}
              {!loading && detail.comments.length === 0 && <p className="text-xs text-slate-600">No comments yet.</p>}
            </div>
            <div className="flex gap-2">
              <div className="flex-shrink-0 pt-1.5"><User className="w-4 h-4 text-slate-600" /></div>
              <textarea className="input py-2 text-xs min-h-[40px] flex-1" placeholder="Write a comment…"
                value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void postComment() }} />
              <button className="btn-secondary text-xs self-end" disabled={busy || !comment.trim()} onClick={() => void postComment()}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </Section>
        </div>
      </motion.aside>
    </motion.div>
  )
}
