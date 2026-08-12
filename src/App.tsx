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
import DebugAuthPage from './pages/debug/DebugAuthPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

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
      </AuthProvider>
    </BrowserRouter>
  )
}
