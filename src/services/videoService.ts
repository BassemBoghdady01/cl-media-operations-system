import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedVideos, seedComments } from '../data/seed'
import type { Video, Comment } from '../types'

export const videoService = {
  getAll: async (agencyId: string): Promise<Video[]> => {
    if (!isSupabaseReady || !supabase) return seedVideos

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[videoService.getAll]', error); return seedVideos }
    return (data ?? []) as unknown as Video[]
  },

  getById: async (id: string): Promise<Video | undefined> => {
    if (!isSupabaseReady || !supabase) return seedVideos.find((v) => v.id === id)

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) { console.error('[videoService.getById]', error); return undefined }
    return data as unknown as Video
  },

  getByClient: async (clientId: string): Promise<Video[]> => {
    if (!isSupabaseReady || !supabase) return seedVideos.filter((v) => v.clientId === clientId)

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[videoService.getByClient]', error); return [] }
    return (data ?? []) as unknown as Video[]
  },

  updateStatus: async (id: string, status: Video['status']): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] videoService.updateStatus', id, status)
      return
    }

    const { error } = await supabase
      .from('videos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  create: async (agencyId: string, video: Partial<Video>): Promise<Video> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create videos')

    const { data, error } = await supabase
      .from('videos')
      .insert({ agency_id: agencyId, ...video })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Video
  },

  update: async (id: string, updates: Partial<Video>): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] videoService.update', id, updates)
      return
    }

    const { error } = await supabase
      .from('videos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  getComments: async (videoId: string): Promise<Comment[]> => {
    if (!isSupabaseReady || !supabase) return seedComments.filter((c) => c.videoId === videoId)

    const { data, error } = await supabase
      .from('review_comments')
      .select('*, profiles(full_name, role)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })

    if (error) { console.error('[videoService.getComments]', error); return [] }
    return (data ?? []) as unknown as Comment[]
  },

  addComment: async (comment: Partial<Comment>): Promise<Comment> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to add comments')

    const { data, error } = await supabase
      .from('review_comments')
      .insert(comment)
      .select()
      .single()

    if (error) throw error
    return data as unknown as Comment
  },
}
