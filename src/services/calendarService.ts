/**
 * Content calendar — production service. No seed fallback.
 */
import { db, orThrow, type Row } from './serviceCore'

export interface CalendarItem {
  id: string
  agencyId: string
  clientId: string
  clientName?: string
  clientColor?: string
  projectId?: string
  videoId?: string
  title: string
  platform: string
  caption?: string
  hashtags?: string[]
  scheduledAt: string
  status: 'draft' | 'scheduled' | 'posted' | 'cancelled'
  publishedUrl?: string
  assignedTo?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

function mapItem(r: Row): CalendarItem {
  return {
    id: r.id,
    agencyId: r.agency_id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? undefined,
    clientColor: r.clients?.color ?? undefined,
    projectId: r.project_id ?? undefined,
    videoId: r.video_id ?? undefined,
    title: r.title ?? '',
    platform: r.platform ?? 'instagram',
    caption: r.caption ?? undefined,
    hashtags: r.hashtags ?? undefined,
    scheduledAt: r.scheduled_at ? String(r.scheduled_at) : '',
    status: r.status ?? 'scheduled',
    publishedUrl: r.published_url ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export const calendarService = {
  getAll: async (agencyId: string): Promise<CalendarItem[]> => {
    const { data, error } = await db()
      .from('content_calendar').select('*, clients(name, color)')
      .eq('agency_id', agencyId)
      .order('scheduled_at', { ascending: true })
    orThrow('calendarService.getAll', error)
    return (data ?? []).map(mapItem)
  },

  getByClient: async (clientId: string, internalOnly = false): Promise<CalendarItem[]> => {
    let q = db().from('content_calendar').select('*, clients(name, color)').eq('client_id', clientId)
    if (!internalOnly) q = q.in('status', ['scheduled', 'posted'])
    const { data, error } = await q.order('scheduled_at', { ascending: true })
    orThrow('calendarService.getByClient', error)
    return (data ?? []).map(mapItem)
  },

  create: async (agencyId: string, item: Partial<CalendarItem>): Promise<CalendarItem> => {
    const { data, error } = await db()
      .from('content_calendar')
      .insert({
        agency_id: agencyId,
        client_id: item.clientId,
        project_id: item.projectId ?? null,
        video_id: item.videoId ?? null,
        title: item.title,
        platform: item.platform,
        caption: item.caption,
        hashtags: item.hashtags ?? [],
        scheduled_at: item.scheduledAt || null,
        status: item.status ?? 'scheduled',
        assigned_to: item.assignedTo ?? null,
        notes: item.notes,
      })
      .select('*, clients(name, color)').single()
    orThrow('calendarService.create', error)
    return mapItem(data as Row)
  },

  update: async (id: string, updates: Partial<CalendarItem>): Promise<void> => {
    const patch: Row = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.platform !== undefined) patch.platform = updates.platform
    if (updates.caption !== undefined) patch.caption = updates.caption
    if (updates.hashtags !== undefined) patch.hashtags = updates.hashtags
    if (updates.scheduledAt !== undefined) patch.scheduled_at = updates.scheduledAt || null
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.publishedUrl !== undefined) patch.published_url = updates.publishedUrl
    if (updates.notes !== undefined) patch.notes = updates.notes
    const { error } = await db().from('content_calendar').update(patch).eq('id', id)
    orThrow('calendarService.update', error)
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await db().from('content_calendar').delete().eq('id', id)
    orThrow('calendarService.delete', error)
  },
}
