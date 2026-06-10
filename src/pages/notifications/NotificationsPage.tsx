import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Check, CheckCheck, Filter, Film, Package, CreditCard, MessageSquare, Calendar } from 'lucide-react'
import { mockNotifications } from '../../data/mockData'
import { timeAgo } from '../../lib/utils'
import type { Notification } from '../../types'

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  video_review: { icon: '🎬', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  revision_request: { icon: '🔄', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approval: { icon: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  invoice: { icon: '💰', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  package_limit: { icon: '📦', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  task: { icon: '✅', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  comment: { icon: '💬', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  scheduled: { icon: '📅', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  posted: { icon: '🚀', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  shooting: { icon: '🎥', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  file: { icon: '📎', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
}

function NotifRow({ notif, i, onRead }: { notif: Notification; i: number; onRead: (id: string) => void }) {
  const cfg = TYPE_CONFIG[notif.type] ?? { icon: '🔔', color: '#64748B', bg: 'rgba(100,116,139,0.12)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className={`flex items-start gap-4 px-5 py-4 transition-all cursor-pointer hover:bg-white/[0.02] ${!notif.isRead ? 'bg-blue-500/[0.03]' : ''}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: cfg.bg }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug ${notif.isRead ? 'text-slate-300' : 'text-white'}`}>
            {notif.title}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-slate-600">{timeAgo(notif.createdAt)}</span>
            {!notif.isRead && (
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{notif.message}</p>
        {notif.clientName && (
          <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>
            {notif.clientName}
          </span>
        )}
      </div>

      {/* Mark read */}
      {!notif.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onRead(notif.id) }}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-green-400 hover:bg-green-500/10 transition-all">
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState('All')

  const unread = notifications.filter((n) => !n.isRead).length

  const markRead = (id: string) => {
    setNotifications((ns) => ns.map((n) => n.id === id ? { ...n, isRead: true } : n))
  }

  const markAllRead = () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })))
  }

  const typeFilters = ['All', 'Approvals', 'Reviews', 'Invoices', 'Packages', 'Tasks']

  const filtered = notifications.filter((n) => {
    if (filter === 'Approvals') return n.type === 'approval'
    if (filter === 'Reviews') return n.type === 'video_review' || n.type === 'revision_request'
    if (filter === 'Invoices') return n.type === 'invoice'
    if (filter === 'Packages') return n.type === 'package_limit'
    if (filter === 'Tasks') return n.type === 'task'
    return true
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Notifications</h1>
            <p className="text-slate-400 text-sm mt-1">{unread} unread · {notifications.length} total</p>
          </div>
          {unread > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-xs py-2 px-4">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {typeFilters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: filter === f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: filter === f ? '#60A5FA' : '#64748B',
              border: `1px solid ${filter === f ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="glass-blue rounded-2xl overflow-hidden">
        {filtered.length > 0 ? (
          filtered.map((n, i) => (
            <NotifRow key={n.id} notif={n} i={i} onRead={markRead} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(59,130,246,0.08)' }}>
              <Bell className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm mb-1">You're all caught up!</p>
            <p className="text-xs text-slate-600">No {filter !== 'All' ? filter.toLowerCase() : ''} notifications</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
