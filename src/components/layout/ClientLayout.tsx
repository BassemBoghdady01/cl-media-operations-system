import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Calendar, Package, CreditCard, FolderOpen, Camera,
  Bell, LogOut, Menu, X, Eye, Wallet,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../lib/utils'
import { useNotifications } from '../../hooks/useNotifications'
import BrandLogo from '../brand/BrandLogo'

const clientNav = [
  { to: '/client', label: 'My Dashboard', icon: Eye, exact: true },
  { to: '/client/videos', label: 'Videos', icon: Film },
  { to: '/client/calendar', label: 'Content Calendar', icon: Calendar },
  { to: '/client/bookings', label: 'Shooting Bookings', icon: Camera },
  { to: '/client/assets', label: 'Brand Assets', icon: FolderOpen },
  { to: '/client/package', label: 'My Package', icon: Package },
  { to: '/client/finance', label: 'Billing & Payments', icon: Wallet },
  { to: '/client/invoices', label: 'Invoices', icon: CreditCard },
]

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { unread } = useNotifications()

  const NavItems = () => (
    <>
      {clientNav.map(({ to, label, icon: Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'text-white bg-white/[0.08]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`
          }>
          {({ isActive }) => (
            <>
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #04081A 0%, #06102E 50%, #04081A 100%)' }}>

      {/* Top nav */}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-5"
        style={{ background: 'rgba(4,8,26,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Left: Logo + Client tag */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} radius={12} />
            <div className="hidden sm:block">
              <div className="text-[13px] font-bold text-white leading-tight whitespace-nowrap">EZ Marketing Agency</div>
              <div className="text-[9px] text-slate-600 leading-tight">Client Portal</div>
            </div>
          </div>
          <div className="h-5 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="hidden sm:block text-xs font-semibold text-slate-300">{user?.name}</span>
        </div>

        {/* Center: Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {clientNav.slice(0, 5).map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'text-white bg-white/[0.08]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`
              }>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Notif + User */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/client/finance')}
            className="relative w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <Bell className="w-4 h-4 text-slate-400" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ background: '#EF4444' }}>{unread}</span>
            )}
          </button>

          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              {getInitials(user?.name ?? 'EZ')}
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="text-slate-600 hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.06] transition-colors">
            {mobileOpen ? <X className="w-4 h-4 text-slate-400" /> : <Menu className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden px-4 py-3 space-y-1 overflow-hidden"
            style={{ background: 'rgba(4,8,26,0.96)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <NavItems />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[10px] text-slate-700">
          Powered by <span className="text-slate-500 font-semibold">EZ Marketing Agency — Media Operations System</span>
        </p>
      </footer>
    </div>
  )
}
