import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Film, Calendar, Sparkles, FolderOpen,
  UserCheck, CheckSquare, Package, CreditCard, BarChart3, Settings,
  Bell, LogOut, Camera, Wallet, TrendingUp, Receipt, PieChart,
  Banknote, ShieldCheck, FileText, ArrowLeftRight, RefreshCw,
  ClipboardCheck, ScrollText, SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Permission } from '../../config/roles'
import { ROLE_LABELS } from '../../config/roles'
import { getInitials } from '../../lib/utils'
import { useNotifications } from '../../hooks/useNotifications'
import BrandLogo from '../brand/BrandLogo'

// Every item declares the permission it requires. Groups with no visible items
// are not rendered at all — a user never sees a module they cannot open.
// This is presentation only; RLS is what actually enforces access.
const navGroups: {
  label: string
  items: { to: string; icon: typeof LayoutDashboard; label: string; permission: Permission; end?: boolean }[]
}[] = [
  {
    label: 'Operations',
    items: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard.view' },
      { to: '/app/clients', icon: Users, label: 'Clients', permission: 'clients.view' },
      { to: '/app/pipeline', icon: Film, label: 'Video Pipeline', permission: 'videos.view' },
      { to: '/app/calendar', icon: Calendar, label: 'Content Calendar', permission: 'calendar.view' },
      { to: '/app/booking', icon: Camera, label: 'Shooting Bookings', permission: 'bookings.view' },
      { to: '/app/tasks', icon: CheckSquare, label: 'Tasks', permission: 'tasks.view' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/app/ai', icon: Sparkles, label: 'AI Studio', permission: 'ai.use' },
      { to: '/app/assets', icon: FolderOpen, label: 'Asset Library', permission: 'assets.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/app/finance', icon: Wallet, label: 'Overview', permission: 'finance.view', end: true },
      { to: '/app/finance/revenue', icon: TrendingUp, label: 'Revenue', permission: 'finance.view_revenue' },
      { to: '/app/finance/expenses', icon: Receipt, label: 'Expenses', permission: 'finance.view_expenses' },
      { to: '/app/finance/subscriptions', icon: RefreshCw, label: 'Subscriptions', permission: 'subscriptions.view' },
      { to: '/app/billing', icon: CreditCard, label: 'Invoices', permission: 'invoices.view' },
      { to: '/app/finance/payroll', icon: Banknote, label: 'Payroll', permission: 'finance.view_payroll' },
      { to: '/app/finance/receivables', icon: ArrowLeftRight, label: 'Receivables', permission: 'finance.view_revenue' },
      { to: '/app/finance/cashflow', icon: Wallet, label: 'Cash Flow', permission: 'finance.view_cashflow' },
      { to: '/app/finance/profitability', icon: PieChart, label: 'Profitability', permission: 'finance.view_profit' },
      { to: '/app/finance/reports', icon: FileText, label: 'Reports', permission: 'finance.view_profit' },
      { to: '/app/finance/approvals', icon: ClipboardCheck, label: 'Approvals', permission: 'finance.approve_expenses' },
      { to: '/app/finance/settings', icon: SlidersHorizontal, label: 'Finance Settings', permission: 'finance.manage' },
    ],
  },
  {
    label: 'Team',
    items: [
      { to: '/app/team', icon: UserCheck, label: 'Team', permission: 'users.view' },
      { to: '/app/users', icon: Users, label: 'Users', permission: 'users.view' },
      { to: '/app/roles', icon: ShieldCheck, label: 'Roles & Permissions', permission: 'users.manage_roles' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/app/packages', icon: Package, label: 'Packages', permission: 'packages.view' },
      { to: '/app/analytics', icon: BarChart3, label: 'Analytics', permission: 'analytics.view' },
      { to: '/app/audit', icon: ScrollText, label: 'Audit Log', permission: 'audit.view' },
    ],
  },
]

export default function Sidebar() {
  const { user, role, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { unread } = useNotifications()

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(i.permission)) }))
    .filter((g) => g.items.length > 0)

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: 'rgba(4,8,26,0.97)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} radius={12} />
          <div>
            <div className="text-[15px] font-bold text-white leading-tight">EZ Marketing</div>
            <div className="text-[10px] text-slate-500 leading-tight">Agency · Media Ops</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-6 pb-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-2">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end}
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
              {getInitials(user?.name ?? 'EZ')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {role ? ROLE_LABELS[role] : '—'}
              </div>
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
