/**
 * Projects — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import type { Project } from '../types'

function mapProject(r: Row): Project {
  return {
    id: r.id,
    agencyId: r.agency_id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    name: r.name ?? '',
    type: r.type ?? '',
    status: r.status ?? 'active',
    startDate: dstr(r.start_date),
    dueDate: dstr(r.due_date),
    description: r.description ?? undefined,
    progress: Number(r.progress ?? 0),
    teamIds: r.team_ids ?? [],
  }
}

export const projectService = {
  getAll: async (agencyId: string): Promise<Project[]> => {
    const { data, error } = await db()
      .from('projects').select('*, clients(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    orThrow('projectService.getAll', error)
    return (data ?? []).map(mapProject)
  },

  getByClient: async (clientId: string): Promise<Project[]> => {
    const { data, error } = await db()
      .from('projects').select('*, clients(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    orThrow('projectService.getByClient', error)
    return (data ?? []).map(mapProject)
  },

  create: async (agencyId: string, project: Partial<Project>): Promise<Project> => {
    const { data, error } = await db()
      .from('projects')
      .insert({
        agency_id: agencyId,
        client_id: project.clientId,
        name: project.name,
        type: project.type,
        status: project.status ?? 'active',
        start_date: project.startDate || null,
        due_date: project.dueDate || null,
        description: project.description,
        progress: project.progress ?? 0,
        team_ids: project.teamIds ?? [],
      })
      .select('*, clients(name)').single()
    orThrow('projectService.create', error)
    return mapProject(data as Row)
  },

  update: async (id: string, updates: Partial<Project>): Promise<void> => {
    const patch: Row = {}
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.progress !== undefined) patch.progress = updates.progress
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate || null
    if (updates.description !== undefined) patch.description = updates.description
    const { error } = await db().from('projects').update(patch).eq('id', id)
    orThrow('projectService.update', error)
  },
}
