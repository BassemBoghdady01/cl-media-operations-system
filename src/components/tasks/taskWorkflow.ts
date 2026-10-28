/**
 * Task workflow vocabulary shared by the board and the task drawer.
 */
import type { Task, TaskStatus } from '../../types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  submitted: 'Team Leader Review',
  in_final_review: 'Final Approval',
  changes_requested: 'Changes Requested',
  done: 'Approved',
  waiting: 'Waiting',
  blocked: 'Blocked',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#64748B',
  in_progress: '#3B82F6',
  submitted: '#06B6D4',
  in_final_review: '#8B5CF6',
  changes_requested: '#F97316',
  done: '#10B981',
  waiting: '#F59E0B',
  blocked: '#EF4444',
}

/** Board columns, in the order work moves. Waiting/blocked sit with To Do. */
export const BOARD_COLUMNS: { key: string; label: string; statuses: TaskStatus[]; color: string }[] = [
  { key: 'todo', label: 'To Do', statuses: ['todo', 'waiting', 'blocked'], color: STATUS_COLORS.todo },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'], color: STATUS_COLORS.in_progress },
  { key: 'changes', label: 'Changes Requested', statuses: ['changes_requested'], color: STATUS_COLORS.changes_requested },
  { key: 'leader', label: 'Team Leader Review', statuses: ['submitted'], color: STATUS_COLORS.submitted },
  { key: 'final', label: 'Final Approval', statuses: ['in_final_review'], color: STATUS_COLORS.in_final_review },
  { key: 'done', label: 'Approved', statuses: ['done'], color: STATUS_COLORS.done },
]

export const OPEN_FOR_WORK: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'blocked', 'changes_requested']

export function isOverdue(t: Task): boolean {
  return t.status !== 'done' && !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)
}

/** Whether the signed-in user is the one who should act on this task now. */
export function needsMyAction(t: Task, userId: string | undefined, canApprove: boolean): boolean {
  if (!userId) return false
  if (t.assignedTo === userId && OPEN_FOR_WORK.includes(t.status)) return true
  if (t.status === 'submitted' && t.reviewerId === userId) return true
  if (t.status === 'in_final_review' && canApprove && t.assignedTo !== userId) return true
  return false
}

/** Human message from a ServiceError ("op failed: detail" → "detail"). */
export function errorText(err: unknown, fallback = 'Something went wrong.'): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return (msg.replace(/^[\w.()]+ failed: /, '') || fallback).trim()
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
