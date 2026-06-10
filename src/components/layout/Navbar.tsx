import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, ChevronDown, Plus, Sparkles, Film, Users } from 'lucide-react'
import { mockNotifications } from '../../data/mockData'
import { useAuth } from '../../contexts/AuthContext'
import { timeAgo, getInitials } from '../../lib/utils'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/app/dashboard': { title: 'Dashboard', subtitle: 'CL — Your media operations command center' },
  '/app/clients': { title: 'Clients', subtitle: 'Manage client relationships and portfolios' },
  '/app/pipeline': { title: 'Video Pipeline', subtitle: 'Track every video from idea to posted' },
  '/app/calendar': { title: 'Content Calendar', subtitle: 'Schedule and plan content delivery' },
  '/app/ai': { title: 'AI Studio', subtitle: 'AI-powered content and script tools' },
  '/app/assets': { title: 'Asset Library', subtitle: 'Brand assets, files, and media' },
  '/app/team': { title: 'Team', subtitle: 'Team members, workload, and performance' },
  '/app/tasks': { title: 'Tasks', subtitle: 'All tasks across clients and projects' },
  '/app/packages': { title: 'Packages', subtitle: 'Client subscriptions and package tracking' },
  '/app/billing': { title: 'Billing', subtitle: 'Invoices and payment management' },
  '/app/analytics': { title: 'Analytics', subtitle: 'Performance metrics and insights' },
  '/app/notifications': { title: 'Notifications', subtitle: 'Alerts and activity updates' },
  '/app/settings': { title: 'Settings', subtitle: 'Agency profile and configuration' },
  '/app/booking': { title: 'Shooting Bookings', subtitle: 'Studio sessions and on-location schedules' },
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const pathKey = Object.keys(pageTitles).find((k) => location.pathname.startsWith(k)) ?? '/app/dashboard'
  const { title, subtitle } = pageTitles[pathKey] ?? { title: 'CL', subtitle: '' }
  const unread = mockNotifications.filter((n) => !n.isRead)

  const notifIcons: Record<string, string> = {
    video_review: '🎬',
    revision_request: '🔄',
    approval: '✅',
    invoice: '💰',
    package_limit: '📦',
    task: '✅',
    comment: '💬',
    scheduled: '📅',
    posted: '🚀',
  }

  return (
    <header className="h-16 flex items-center px-6 gap-4 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(4,8,26,0.85)', backdropFilter: 'blur(12px)' }}>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-white leading-tight truncate">{title}</h1>
        <p className="text-[11px] text-slate-500 leading-tight truncate hidden sm:block">{subtitle}</p>
      </div>

      {/* Search */}
      <div className={`relative hidden md:flex items-center transition-all duration-300 ${searchFocused ? 'w-72' : 'w-52'}`}>
        <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          className="input pl-9 pr-4 py-2 text-xs h-9"
          placeholder="Search clients, videos, tasks…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Quick add */}
      <button className="btn-primary text-xs py-2 px-4 hidden sm:flex">
        <Plus className="w-3.5 h-3.5" />
        New Video
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.06]"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <Bell className="w-4 h-4 text-slate-400" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
              {unread.length}
            </span>
          )}
        </button>

        <AnimatePresence>
          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-12 z-50 w-96 glass-blue rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-blue-400"
                    style={{ background: 'rgba(59,130,246,0.15)' }}>
                    {unread.length} new
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {mockNotifications.slice(0, 6).map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => { navigate(n.link ?? '/app/notifications'); setShowNotifs(false) }}
                      className={`px-4 py-3.5 cursor-pointer flex gap-3 items-start transition-colors hover:bg-white/[0.03] ${!n.isRead ? 'bg-blue-500/[0.04]' : ''}`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: 'rgba(59,130,246,0.12)' }}>
                        {notifIcons[n.type] ?? '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white leading-snug">{n.title}</p>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5 truncate">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={() => { navigate('/app/notifications'); setShowNotifs(false) }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    View all notifications →
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
        {getInitials(user?.name ?? 'BM')}
      </div>
    </header>
  )
}
