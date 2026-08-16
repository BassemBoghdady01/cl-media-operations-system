import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { TeamRoute, ClientRoute } from './components/auth/RoleGuard'
import AppLayout from './components/layout/AppLayout'
import ClientLayout from './components/layout/ClientLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import Dashboard from './pages/dashboard/Dashboard'
import ClientsPage from './pages/clients/ClientsPage'
import ClientProfile from './pages/clients/ClientProfile'
import VideoPipeline from './pages/pipeline/VideoPipeline'
import VideoDetail from './pages/pipeline/VideoDetail'
import ContentCalendar from './pages/calendar/ContentCalendar'
import AIStudio from './pages/ai/AIStudio'
import AssetLibrary from './pages/assets/AssetLibrary'
import PackagesPage from './pages/packages/PackagesPage'
import BillingPage from './pages/billing/BillingPage'
import TeamPage from './pages/team/TeamPage'
import TasksPage from './pages/tasks/TasksPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import SettingsPage from './pages/settings/SettingsPage'
import NotificationsPage from './pages/notifications/NotificationsPage'
import BookingPage from './pages/booking/BookingPage'
import ClientDashboard from './pages/client/ClientDashboard'
import ClientVideos from './pages/client/ClientVideos'
import ClientCalendar from './pages/client/ClientCalendar'
import ClientBookings from './pages/client/ClientBookings'
import ClientAssets from './pages/client/ClientAssets'
import ClientPackage from './pages/client/ClientPackage'
import ClientInvoices from './pages/client/ClientInvoices'
import ClientFinance from './pages/client/ClientFinance'
import DebugAuthPage from './pages/debug/DebugAuthPage'
import SetupRequiredPage from './pages/system/SetupRequiredPage'
import AppErrorBoundary from './components/system/AppErrorBoundary'
import PermissionGuard from './components/auth/PermissionGuard'
import FinanceOverview from './pages/finance/FinanceOverview'
import TransactionsPage from './pages/finance/TransactionsPage'
import ReceivablesPage from './pages/finance/ReceivablesPage'
import ProfitabilityPage from './pages/finance/ProfitabilityPage'
import SubscriptionsPage from './pages/finance/SubscriptionsPage'
import SubscriptionDetail from './pages/finance/SubscriptionDetail'
import PayrollPage from './pages/finance/PayrollPage'
import CashFlowPage from './pages/finance/CashFlowPage'
import ReportsPage from './pages/finance/ReportsPage'
import MonthClosePage from './pages/finance/MonthClosePage'
import FinanceSettingsPage from './pages/finance/FinanceSettingsPage'
import ApprovalsPage from './pages/finance/ApprovalsPage'
import AuditLogPage from './pages/audit/AuditLogPage'
import UsersPage from './pages/users/UsersPage'
import RolesPage from './pages/users/RolesPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppErrorBoundary>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ── Setup / access states ───────────────────────────────────
              Authenticated but not `ready` (no profile, no agency, unknown
              role, or a resolution error). Sits INSIDE ProtectedRoute but
              OUTSIDE every role guard, so it can never join a redirect loop. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app/setup" element={<SetupRequiredPage />} />
          </Route>

          {/* ── Internal App (requires auth + internal role) ────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<TeamRoute />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientProfile />} />
                <Route path="pipeline" element={<VideoPipeline />} />
                <Route path="pipeline/:id" element={<VideoDetail />} />
                <Route path="calendar" element={<ContentCalendar />} />
                <Route path="ai" element={<AIStudio />} />
                <Route path="assets" element={<AssetLibrary />} />
                <Route path="packages" element={<PackagesPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="booking" element={<BookingPage />} />

                {/* ── Setup / onboarding ── */}
                <Route element={<PermissionGuard permission="settings.view" areaLabel="workspace setup" />}>
                  <Route path="onboarding" element={<OnboardingPage />} />
                </Route>

                {/* ── Finance — each screen gated by its own permission ── */}
                <Route element={<PermissionGuard permission="finance.view" areaLabel="finance" />}>
                  <Route path="finance" element={<FinanceOverview />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.view_revenue" areaLabel="revenue" />}>
                  <Route path="finance/revenue" element={<TransactionsPage type="income" />} />
                  <Route path="finance/receivables" element={<ReceivablesPage />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.view_expenses" areaLabel="expenses" />}>
                  <Route path="finance/expenses" element={<TransactionsPage type="expense" />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.view_profit" areaLabel="profitability" />}>
                  <Route path="finance/profitability" element={<ProfitabilityPage />} />
                  <Route path="finance/reports" element={<ReportsPage />} />
                </Route>
                <Route element={<PermissionGuard permission="subscriptions.view" areaLabel="subscriptions" />}>
                  <Route path="finance/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="finance/subscriptions/:id" element={<SubscriptionDetail />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.view_payroll" areaLabel="payroll" />}>
                  <Route path="finance/payroll" element={<PayrollPage />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.view_cashflow" areaLabel="cash flow" />}>
                  <Route path="finance/cashflow" element={<CashFlowPage />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.close_period" areaLabel="month close" />}>
                  <Route path="finance/reports/month-close" element={<MonthClosePage />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.approve_expenses" areaLabel="expense approvals" />}>
                  <Route path="finance/approvals" element={<ApprovalsPage />} />
                </Route>
                <Route element={<PermissionGuard permission="finance.manage" areaLabel="finance settings" />}>
                  <Route path="finance/settings" element={<FinanceSettingsPage />} />
                </Route>

                {/* ── Administration ── */}
                <Route element={<PermissionGuard permission="users.view" areaLabel="user management" />}>
                  <Route path="users" element={<UsersPage />} />
                </Route>
                <Route element={<PermissionGuard permission="users.manage_roles" areaLabel="roles and permissions" />}>
                  <Route path="roles" element={<RolesPage />} />
                </Route>
                <Route element={<PermissionGuard permission="audit.view" areaLabel="the audit log" />}>
                  <Route path="audit" element={<AuditLogPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* ── Client Portal (requires auth + client role) ─────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<ClientRoute />}>
              <Route path="/client" element={<ClientLayout />}>
                <Route index element={<ClientDashboard />} />
                <Route path="videos" element={<ClientVideos />} />
                <Route path="calendar" element={<ClientCalendar />} />
                <Route path="bookings" element={<ClientBookings />} />
                <Route path="assets" element={<ClientAssets />} />
                <Route path="package" element={<ClientPackage />} />
                <Route path="finance" element={<ClientFinance />} />
                <Route path="invoices" element={<ClientInvoices />} />
              </Route>
            </Route>
          </Route>

          {/* ── Debug / diagnostics (public — remove in production) ── */}
          <Route path="/debug/auth" element={<DebugAuthPage />} />

          {/* ── Legacy redirects ────────────────────────────────────── */}
          <Route path="/portal" element={<Navigate to="/client" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AppErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
