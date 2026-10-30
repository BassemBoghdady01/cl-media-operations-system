/**
 * Tasks — production service. No seed fallback.
 *
 * Delivery workflow (migration 012): the assignee submits work (files, links,
 * a note) through submit_task_work; the team leader and then an owner review
 * it through review_task_work. Those statuses can't be set by hand — the
 * database guard rejects it — so the UI never calls updateStatus for them.
 */
import { db, orThrow, dstr, type Row, requireRows } from './serviceCore'
import type { Task, TaskStatus } from '../types'

export const TASK_FILES_BUCKET = 'task-files'
export const TASK_FILE_MAX_BYTES = 50 * 1024 * 1024

export function mapTask(r: Row): Task {
  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description ?? undefined,
    assignedTo: r.assigned_to ?? '',
    assignedToName: r.assignee?.full_name ?? r.profiles?.full_name ?? '',
    assignedToColor: r.assignee?.color ?? r.profiles?.color ?? '#3B82F6',
    status: r.status ?? 'todo',
    priority: r.priority ?? 'medium',
    dueDate: dstr(r.due_date),
    clientId: r.client_id ?? undefined,
    clientName: r.clients?.name ?? undefined,
    videoId: r.video_id ?? undefined,
    projectId: r.project_id ?? undefined,
    tags: r.tags ?? undefined,
    createdAt: dstr(r.created_at),
    reviewerId: r.reviewer_id ?? undefined,
    reviewerName: r.reviewer?.full_name ?? undefined,
    createdBy: r.created_by ?? undefined,
    requiresFinalApproval: r.requires_final_approval ?? true,
    revisionCount: r.revision_count ?? 0,
    submittedAt: r.submitted_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
  }
}

const TASK_SELECT =
  '*, assignee:profiles!tasks_assigned_to_fkey(full_name, color), ' +
  'reviewer:profiles!tasks_reviewer_id_fkey(full_name), clients(name)'

// ─── Workflow detail types ────────────────────────────────────────────────────

export interface TaskLink { url: string; label?: string }

export interface TaskFile {
  id: string
  taskId: string
  submissionId: string | null
  kind: 'brief' | 'submission'
  storagePath: string
  fileName: string
  sizeBytes: number | null
  mimeType: string | null
  uploadedBy: string | null
  uploadedByName: string
  createdAt: string
}

export interface TaskSubmission {
  id: string
  version: number
  submittedBy: string | null
  submittedByName: string
  note: string | null
  links: TaskLink[]
  status: 'pending' | 'leader_approved' | 'approved' | 'changes_requested'
  createdAt: string
}

export interface TaskReview {
  id: string
  submissionId: string | null
  reviewerId: string | null
  reviewerName: string
  stage: 'leader' | 'final'
  decision: 'approved' | 'changes_requested'
  comment: string | null
  createdAt: string
}

export interface TaskComment {
  id: string
  authorId: string | null
  authorName: string
  authorColor: string
  body: string
  createdAt: string
}

export interface TaskDetail {
  submissions: TaskSubmission[]
  files: TaskFile[]
  reviews: TaskReview[]
  comments: TaskComment[]
}

const mapFile = (r: Row): TaskFile => ({
  id: r.id,
  taskId: r.task_id,
  submissionId: r.submission_id ?? null,
  kind: r.kind,
  storagePath: r.storage_path,
  fileName: r.file_name,
  sizeBytes: r.size_bytes ?? null,
  mimeType: r.mime_type ?? null,
  uploadedBy: r.uploaded_by ?? null,
  uploadedByName: r.uploader?.full_name ?? '',
  createdAt: r.created_at,
})

function cleanName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120)
}

export const taskService = {
  getAll: async (agencyId: string): Promise<Task[]> => {
    const { data, error } = await db()
      .from('tasks').select(TASK_SELECT)
      .eq('agency_id', agencyId)
      .order('due_date', { ascending: true, nullsFirst: false })
    orThrow('taskService.getAll', error)
    return (data ?? []).map(mapTask)
  },

  getMyTasks: async (userId: string): Promise<Task[]> => {
    const { data, error } = await db()
      .from('tasks').select(TASK_SELECT)
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true })
    orThrow('taskService.getMyTasks', error)
    return (data ?? []).map(mapTask)
  },

  getOne: async (id: string): Promise<Task | null> => {
    const { data, error } = await db().from('tasks').select(TASK_SELECT).eq('id', id).maybeSingle()
    orThrow('taskService.getOne', error)
    return data ? mapTask(data as Row) : null
  },

  /** Only for the free statuses (todo / in_progress / waiting / blocked). */
  updateStatus: async (id: string, status: TaskStatus): Promise<void> => {
    const { data: _rows, error } = await db().from('tasks').update({ status }).eq('id', id).select('id')
    orThrow('taskService.updateStatus', error)
    requireRows('taskService.updateStatus', _rows)
  },

  update: async (id: string, patch: Partial<Task>): Promise<void> => {
    const row: Row = {}
    if (patch.title !== undefined) row.title = patch.title
    if (patch.description !== undefined) row.description = patch.description || null
    if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null
    if (patch.reviewerId !== undefined) row.reviewer_id = patch.reviewerId || null
    if (patch.priority !== undefined) row.priority = patch.priority
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null
    if (patch.clientId !== undefined) row.client_id = patch.clientId || null
    if (patch.requiresFinalApproval !== undefined) row.requires_final_approval = patch.requiresFinalApproval
    const { data: _rows, error } = await db().from('tasks').update(row).eq('id', id).select('id')
    orThrow('taskService.update', error)
    requireRows('taskService.update', _rows)
  },

  remove: async (id: string): Promise<void> => {
    const { data: _rows, error } = await db().from('tasks').delete().eq('id', id).select('id')
    orThrow('taskService.remove', error)
    requireRows('taskService.remove', _rows)
  },

  create: async (agencyId: string, task: Partial<Task>): Promise<Task> => {
    const { data, error } = await db()
      .from('tasks')
      .insert({
        agency_id: agencyId,
        title: task.title,
        description: task.description,
        assigned_to: task.assignedTo || null,
        reviewer_id: task.reviewerId || null,
        requires_final_approval: task.requiresFinalApproval ?? true,
        status: task.status ?? 'todo',
        priority: task.priority ?? 'medium',
        due_date: task.dueDate || null,
        client_id: task.clientId ?? null,
        project_id: task.projectId ?? null,
        video_id: task.videoId ?? null,
        tags: task.tags ?? [],
      })
      .select(TASK_SELECT).single()
    orThrow('taskService.create', error)
    return mapTask(data as Row)
  },

  // ─── Workflow ───────────────────────────────────────────────────────────────

  getDetail: async (taskId: string): Promise<TaskDetail> => {
    const [subs, files, reviews, comments] = await Promise.all([
      db().from('task_submissions')
        .select('*, submitter:profiles!task_submissions_submitted_by_fkey(full_name)')
        .eq('task_id', taskId).order('version', { ascending: false }),
      db().from('task_files')
        .select('*, uploader:profiles!task_files_uploaded_by_fkey(full_name)')
        .eq('task_id', taskId).order('created_at'),
      db().from('task_reviews')
        .select('*, reviewer:profiles!task_reviews_reviewer_id_fkey(full_name)')
        .eq('task_id', taskId).order('created_at'),
      db().from('task_comments')
        .select('*, author:profiles!task_comments_author_id_fkey(full_name, color)')
        .eq('task_id', taskId).order('created_at'),
    ])
    orThrow('taskService.getDetail(submissions)', subs.error)
    orThrow('taskService.getDetail(files)', files.error)
    orThrow('taskService.getDetail(reviews)', reviews.error)
    orThrow('taskService.getDetail(comments)', comments.error)
    return {
      submissions: (subs.data ?? []).map((r: Row) => ({
        id: r.id,
        version: r.version,
        submittedBy: r.submitted_by ?? null,
        submittedByName: r.submitter?.full_name ?? '',
        note: r.note ?? null,
        links: Array.isArray(r.links) ? r.links : [],
        status: r.status,
        createdAt: r.created_at,
      })),
      files: (files.data ?? []).map(mapFile),
      reviews: (reviews.data ?? []).map((r: Row) => ({
        id: r.id,
        submissionId: r.submission_id ?? null,
        reviewerId: r.reviewer_id ?? null,
        reviewerName: r.reviewer?.full_name ?? '',
        stage: r.stage,
        decision: r.decision,
        comment: r.comment ?? null,
        createdAt: r.created_at,
      })),
      comments: (comments.data ?? []).map((r: Row) => ({
        id: r.id,
        authorId: r.author_id ?? null,
        authorName: r.author?.full_name ?? '',
        authorColor: r.author?.color ?? '#3B82F6',
        body: r.body,
        createdAt: r.created_at,
      })),
    }
  },

  /** Uploads to the private bucket and records the file (not yet submitted). */
  uploadFile: async (
    agencyId: string, taskId: string, file: File, kind: 'brief' | 'submission' = 'submission'
  ): Promise<TaskFile> => {
    if (file.size > TASK_FILE_MAX_BYTES) {
      throw new Error(`"${file.name}" is over 50 MB — share it as a Drive link instead.`)
    }
    const path = `${agencyId}/${taskId}/${Date.now()}-${cleanName(file.name)}`
    const client = db()
    const { error: upErr } = await client.storage.from(TASK_FILES_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
    orThrow('taskService.uploadFile(storage)', upErr)
    const { data, error } = await client.from('task_files')
      .insert({
        agency_id: agencyId,
        task_id: taskId,
        kind,
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
      })
      .select('*, uploader:profiles!task_files_uploaded_by_fkey(full_name)').single()
    if (error) {
      await client.storage.from(TASK_FILES_BUCKET).remove([path])
      orThrow('taskService.uploadFile(record)', error)
    }
    return mapFile(data as Row)
  },

  removeFile: async (file: TaskFile): Promise<void> => {
    const client = db()
    const { error } = await client.from('task_files').delete().eq('id', file.id)
    orThrow('taskService.removeFile', error)
    await client.storage.from(TASK_FILES_BUCKET).remove([file.storagePath])
  },

  fileUrl: async (file: TaskFile): Promise<string> => {
    const { data, error } = await db().storage
      .from(TASK_FILES_BUCKET)
      .createSignedUrl(file.storagePath, 3600, { download: file.fileName })
    orThrow('taskService.fileUrl', error)
    return data!.signedUrl
  },

  submit: async (taskId: string, note: string, links: TaskLink[], fileIds: string[]): Promise<void> => {
    const { error } = await db().rpc('submit_task_work', {
      p_task: taskId, p_note: note || null, p_links: links, p_file_ids: fileIds,
    })
    orThrow('taskService.submit', error)
  },

  review: async (
    taskId: string, decision: 'approved' | 'changes_requested', comment: string
  ): Promise<TaskStatus> => {
    const { data, error } = await db().rpc('review_task_work', {
      p_task: taskId, p_decision: decision, p_comment: comment || null,
    })
    orThrow('taskService.review', error)
    return data as TaskStatus
  },

  addComment: async (agencyId: string, taskId: string, body: string): Promise<void> => {
    const { error } = await db().from('task_comments').insert({ agency_id: agencyId, task_id: taskId, body })
    orThrow('taskService.addComment', error)
  },
}
