import { supabase, isSupabaseReady } from '../lib/supabase'

export interface CalendarItem {
  id: string
  agencyId: string
  clientId: string
  clientName?: string
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

// Seed data for calendar (static sample items)
const seedCalendarItems: CalendarItem[] = [
  {
    id: 'cal1', agencyId: 'a1', clientId: 'c1', clientName: 'Nile Brands Co.',
    title: 'Summer Collection Launch Reel', platform: 'instagram',
    caption: 'Introducing our Summer 2024 Collection ☀️',
    hashtags: ['#NileBrands', '#SummerCollection'],
    scheduledAt: '2024-05-12T10:00:00', status: 'scheduled',
    createdAt: '2024-05-01', updatedAt: '2024-05-01',
  },
  {
    id: 'cal2', agencyId: 'a1', clientId: 'c3', clientName: 'TechVision Egypt',
    title: 'AI Product Explainer', platform: 'youtube',
    caption: 'Meet TechVision Pro — the AI-powered platform.',
    scheduledAt: '2024-05-12T14:00:00', status: 'scheduled',
    createdAt: '2024-05-01', updatedAt: '2024-05-01',
  },
  {
    id: 'cal3', agencyId: 'a1', clientId: 'c5', clientName: 'FitZone Gym',
    title: 'April Transformation Stories', platform: 'tiktok',
    caption: '💪 Real people. Real results.',
    hashtags: ['#FitZone', '#Transformation'],
    scheduledAt: '2024-05-09T12:00:00', status: 'posted',
    publishedUrl: 'https://tiktok.com/@fitzone/123',
    createdAt: '2024-04-25', updatedAt: '2024-05-09',
  },
  {
    id: 'cal4', agencyId: 'a1', clientId: 'c4', clientName: 'Desert Palm Hotel',
    title: 'Pool & Spa Weekend Package', platform: 'instagram',
    scheduledAt: '2024-05-13T11:00:00', status: 'scheduled',
    createdAt: '2024-05-02', updatedAt: '2024-05-02',
  },
  {
    id: 'cal5', agencyId: 'a1', clientId: 'c2', clientName: 'Cairo Eats',
    title: 'New Branch Opening Announcement', platform: 'instagram',
    scheduledAt: '2024-05-18T10:00:00', status: 'draft',
    createdAt: '2024-05-05', updatedAt: '2024-05-05',
  },
]

export const calendarService = {
  getAll: async (agencyId: string): Promise<CalendarItem[]> => {
    if (!isSupabaseReady || !supabase) return seedCalendarItems

    const { data, error } = await supabase
      .from('content_calendar')
      .select('*, clients(name, color)')
      .eq('agency_id', agencyId)
      .order('scheduled_at', { ascending: true })

    if (error) { console.error('[calendarService.getAll]', error); return seedCalendarItems }
    return (data ?? []) as unknown as CalendarItem[]
  },

  getByClient: async (clientId: string, internalOnly = false): Promise<CalendarItem[]> => {
    if (!isSupabaseReady || !supabase) {
      const items = seedCalendarItems.filter((i) => i.clientId === clientId)
      if (!internalOnly) return items.filter((i) => ['scheduled', 'posted'].includes(i.status))
      return items
    }

    let query = supabase
      .from('content_calendar')
      .select('*')
      .eq('client_id', clientId)

    if (!internalOnly) {
      query = query.in('status', ['scheduled', 'posted'])
    }

    const { data, error } = await query.order('scheduled_at', { ascending: true })
    if (error) { console.error('[calendarService.getByClient]', error); return [] }
    return (data ?? []) as unknown as CalendarItem[]
  },

  create: async (agencyId: string, item: Partial<CalendarItem>): Promise<CalendarItem> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create calendar items')

    const { data, error } = await supabase
      .from('content_calendar')
      .insert({ agency_id: agencyId, ...item })
      .select()
      .single()

    if (error) throw error
    return data as unknown as CalendarItem
  },

  update: async (id: string, updates: Partial<CalendarItem>): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] calendarService.update', id)
      return
    }

    const { error } = await supabase
      .from('content_calendar')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] calendarService.delete', id)
      return
    }

    const { error } = await supabase.from('content_calendar').delete().eq('id', id)
    if (error) throw error
  },
}
