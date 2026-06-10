import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedProjects } from '../data/seed'
import type { Project } from '../types'

export const projectService = {
  getAll: async (agencyId: string): Promise<Project[]> => {
    if (!isSupabaseReady || !supabase) return seedProjects

    const { data, error } = await supabase
      .from('projects')
      .select('*, clients(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[projectService.getAll]', error); return seedProjects }
    return (data ?? []) as unknown as Project[]
  },

  getByClient: async (clientId: string): Promise<Project[]> => {
    if (!isSupabaseReady || !supabase) return seedProjects.filter((p) => p.clientId === clientId)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[projectService.getByClient]', error); return [] }
    return (data ?? []) as unknown as Project[]
  },

  create: async (agencyId: string, project: Partial<Project>): Promise<Project> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create projects')

    const { data, error } = await supabase
      .from('projects')
      .insert({ agency_id: agencyId, ...project })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Project
  },
}
