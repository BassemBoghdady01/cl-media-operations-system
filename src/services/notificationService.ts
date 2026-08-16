/**
 * Notifications — production service. Real Supabase rows only.
 *
 * The cron endpoint and app events insert rows here; this service reads them
 * for the bell, the notifications page and the client portal header.
 */
import { db, orThrow, type Row } from './serviceCore'
import type { Notification } from '../types'

function mapNotification(r: Row): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type ?? 'task',
    title: r.title ?? '',
    message: r.message ?? '',
    isRead: !!r.read_at,
    createdAt: String(r.created_at ?? ''),
    link: r.action_url ?? undefined,
  }
}

export const notificationService = {
  getAll: async (userId: string): Promise<Notification[]> => {
    const { data, error } = await db()
      .from('notifications').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    orThrow('notificationService.getAll', error)
    return (data ?? []).map(mapNotification)
  },

  unreadCount: async (userId: string): Promise<number> => {
    const { count, error } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    orThrow('notificationService.unreadCount', error)
    return count ?? 0
  },

  markRead: async (id: string): Promise<void> => {
    const { error } = await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    orThrow('notificationService.markRead', error)
  },

  markAllRead: async (userId: string): Promise<void> => {
    const { error } = await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    orThrow('notificationService.markAllRead', error)
  },

  /** Create an in-app notification for a specific user. */
  notify: async (params: {
    agencyId: string
    userId: string
    type: Notification['type']
    title: string
    message: string
    link?: string
  }): Promise<void> => {
    const { error } = await db().from('notifications').insert({
      agency_id: params.agencyId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.link ?? null,
    })
    orThrow('notificationService.notify', error)
  },
}
