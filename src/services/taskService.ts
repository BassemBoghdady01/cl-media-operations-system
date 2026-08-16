/**
 * Tasks — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import type { Task } from '../types'

export function mapTask(r: Row): Task {
  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description ?? undefined,
    assignedTo: r.assigned_to ?? '',
    assignedToName: r.profiles?.full_name ?? '',
    assignedToColor: r.profiles?.color ?? '#3B82F6',
    status: r.status ?? 'todo',
    priority: r.priority ?? 'medium',
    dueDate: dstr(r.due_date),
    clientId: r.client_id ?? undefined,
    clientName: r.clients?.name ?? undefined,
    videoId: r.video_id ?? undefined,
    projectId: r.project_id ?? undefined,
    tags: r.tags ?? undefined,
    createdAt: dstr(r.created_at),
  }
}

const TASK_SELECT = '*, profiles!tasks_assigned_to_fkey(full_name, color), clients(name)'

export const taskService = {
  getAll: async (agencyId: string): Promise<Task[]> => {
    const { data, error } = await db()
      .from('tasks').select(TASK_SELECT)
      .eq('agency_id', agencyId)
      .order('due_date', { ascending: true })
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

  updateStatus: async (id: string, status: Task['status']): Promise<void> => {
    const { error } = await db().from('tasks').update({ status }).eq('id', id)
    orThrow('taskService.updateStatus', error)
  },

  create: async (agencyId: string, task: Partial<Task>): Promise<Task> => {
    const { data, error } = await db()
      .from('tasks')
      .insert({
        agency_id: agencyId,
        title: task.title,
        description: task.description,
        assigned_to: task.assignedTo || null,
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
}
