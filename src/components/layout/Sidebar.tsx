import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Film, Calendar, Sparkles, FolderOpen,
  UserCheck, CheckSquare, Package, CreditCard, BarChart3, Settings,
  Bell, LogOut, ChevronRight, Zap, Play, Camera,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../lib/utils'
import { mockNotifications } from '../../data/mockData'

const navGroups = [
  {
    label: 'Operations',
    items: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/app/clients', icon: Users, label: 'Clients' },
      { to: '/app/pipeline', icon: Film, label: 'Video Pipeline' },
      { to: '/app/calendar', icon: Calendar, label: 'Content Calendar' },
      { to: '/app/booking', icon: Camera, label: 'Shooting Bookings' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/app/ai', icon: Sparkles, label: 'AI Studio' },
      { to: '/app/assets', icon: FolderOpen, label: 'Asset Library' },
    ],
  },
  {
    label: 'Team & Work',
    items: [
      { to: '/app/team', icon: UserCheck, label: 'Team' },
      { to: '/app/tasks', icon: CheckSquare, label: 'Tasks' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/app/packages', icon: Package, label: 'Packages' },
      { to: '/app/billing', icon: CreditCard, label: 'Billing' },
      { to: '/app/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const unread = mockNotifications.filter((n) => !n.isRead).length

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: 'rgba(4,8,26,0.97)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            EZ
          </div>
          <div>
            <div className="text-[15px] font-bold text-white leading-tight">EZ Marketing</div>
            <div className="text-[10px] text-slate-500 leading-tight">Agency · Media Ops</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-6 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-2">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }>
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                      <span className="truncate">{label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-indicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 space-y-1">
        <NavLink to="/app/notifications"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Bell className="w-4 h-4 flex-shrink-0" />
          <span>Notifications</span>
          {unread > 0 && (
            <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', minWidth: 18, textAlign: 'center' }}>
              {unread}
            </span>
          )}
        </NavLink>

        <NavLink to="/app/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span>Settings</span>
        </NavLink>

        {/* User */}
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              {getInitials(user?.name ?? 'BM')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-500 truncate">Admin</div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }}
              className="text-slate-600 hover:text-red-400 transition-colors p-1">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
