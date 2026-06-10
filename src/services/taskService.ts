import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedTasks } from '../data/seed'
import type { Task } from '../types'

export const taskService = {
  getAll: async (agencyId: string): Promise<Task[]> => {
    if (!isSupabaseReady || !supabase) return seedTasks

    const { data, error } = await supabase
      .from('tasks')
      .select('*, profiles(full_name, color)')
      .eq('agency_id', agencyId)
      .order('due_date', { ascending: true })

    if (error) { console.error('[taskService.getAll]', error); return seedTasks }
    return (data ?? []) as unknown as Task[]
  },

  getMyTasks: async (userId: string): Promise<Task[]> => {
    if (!isSupabaseReady || !supabase) return seedTasks.filter((t) => t.assignedTo === userId)

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true })

    if (error) { console.error('[taskService.getMyTasks]', error); return [] }
    return (data ?? []) as unknown as Task[]
  },

  updateStatus: async (id: string, status: Task['status']): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] taskService.updateStatus', id, status)
      return
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  create: async (agencyId: string, task: Partial<Task>): Promise<Task> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create tasks')

    const { data, error } = await supabase
      .from('tasks')
      .insert({ agency_id: agencyId, ...task })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Task
  },
}
