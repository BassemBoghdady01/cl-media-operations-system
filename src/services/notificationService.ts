import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedNotifications } from '../data/seed'
import type { Notification } from '../types'

export const notificationService = {
  getAll: async (userId: string): Promise<Notification[]> => {
    if (!isSupabaseReady || !supabase) return seedNotifications.filter((n) => n.userId === userId)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) { console.error('[notificationService.getAll]', error); return [] }
    return (data ?? []) as unknown as Notification[]
  },

  markRead: async (id: string): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] notificationService.markRead', id)
      return
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  markAllRead: async (userId: string): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] notificationService.markAllRead', userId)
      return
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)

    if (error) throw error
  },
}
