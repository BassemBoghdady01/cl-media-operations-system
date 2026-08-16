/**
 * Real notification state for the shell (sidebar badge, navbar bell, portal
 * header). Loads from Supabase and refreshes on a slow poll — no fake counts.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notificationService } from '../services/notificationService'
import type { Notification } from '../types'

const POLL_MS = 90_000

export function useNotifications(limit = 8) {
  const { user, status } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const reload = useCallback(async () => {
    if (!user?.id) return
    try {
      const all = await notificationService.getAll(user.id)
      setItems(all.slice(0, limit))
      setUnread(all.filter((n) => !n.isRead).length)
    } catch {
      // Shell badges must never take the app down; leave last known state.
    }
  }, [user?.id, limit])

  useEffect(() => {
    if (status !== 'ready') return
    reload()
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
  }, [status, reload])

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try { await notificationService.markRead(id) } catch { /* non-fatal */ }
  }, [])

  return { items, unread, reload, markRead }
}
