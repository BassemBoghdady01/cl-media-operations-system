import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Film, CheckCircle, Clock, AlertCircle, Eye,
  Package, CreditCard, Camera, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { videoService } from '../../services/videoService'
import { packageService } from '../../services/packageService'
import { invoiceService } from '../../services/invoiceService'
import { bookingService } from '../../services/bookingService'
import type { Video, Package as PackageType, Invoice, Booking } from '../../types'
import { formatCurrency, formatDate, timeAgo, getInitials } from '../../lib/utils'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  client_review:  { label: 'Awaiting Your Review', color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  revision:       { label: 'In Revision', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  approved:       { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  scheduled:      { label: 'Scheduled', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  posted:         { label: 'Posted Live', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  editing:        { label: 'In Editing', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  internal_review:{ label: 'Final QC', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  shooting:       { label: 'Shooting', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  script:         { label: 'Scripting', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  idea:           { label: 'Concept Stage', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [pkg, setPkg] = useState<PackageType | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      videoService.getByClient(user.id),
      packageService.getByClient(user.id),
      invoiceService.getByClient(user.id),
      bookingService.getByClient(user.id),
    ]).then(([v, p, inv, b]) => {
      setVideos(v)
      setPkg(p ?? null)
      setInvoices(inv)
      setBookings(b)
      setLoading(false)
    })
  }, [user])

  const forReview = videos.filter((v) => v.status === 'client_review')
  const inProgress = videos.filter((v) =>
    ['idea', 'script', 'shooting', 'editing', 'internal_review'].includes(v.status)
  )
  const posted = videos.filter((v) => v.status === 'posted')
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
  const nextBooking = bookings.find((b) =>
    !['completed', 'cancelled'].includes(b.status) && new Date(b.date) >= new Date()
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            {getInitials(user?.name ?? 'EZ')}
          </div>
          <div>
            <div className="text-base font-black text-white">
              Welcome back, {user?.name?.split(' ')[0] ?? 'there'} 👋
            </div>
            <div className="text-xs text-slate-500">Here's what's happening with your content</div>
          </div>
        </div>
      </motion.div>

      {/* Alert: Videos pending review */}
      {forReview.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-white">
              {forReview.length} video{forReview.length > 1 ? 's' : ''} waiting for your review
            </span>
            <span className="text-xs text-blue-400 ml-2">Action required</span>
          </div>
          <Link to="/client/videos" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Review now <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* Alert: Overdue invoices */}
      {overdueInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-white flex-1">
            Invoice{overdueInvoices.length > 1 ? 's' : ''} overdue — please contact your account manager
          </span>
          <Link to="/client/invoices" className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
            View <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pending Review', value: forReview.length, color: '#EAB308', icon: Eye, to: '/client/videos' },
          { label: 'In Production', value: inProgress.length, color: '#3B82F6', icon: Clock, to: '/client/videos' },
          { label: 'Posted This Month', value: posted.length, color: '#10B981', icon: CheckCircle, to: '/client/videos' },
          { label: 'Videos Total', value: videos.length, color: '#8B5CF6', icon: Film, to: '/client/videos' },
        ].map(({ label, value, color, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-xl p-4 cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Icon className="w-4 h-4 mb-2" style={{ color }} />
              <div className="text-2xl font-black text-white">{value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">

        {/* Videos needing review */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Your Videos</h2>
            <Link to="/client/videos" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              See all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {videos.slice(0, 5).map((video, i) => {
              const st = STATUS_LABELS[video.status] ?? { label: video.status, color: '#64748B', bg: 'rgba(100,116,139,0.12)' }
              return (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-3.5 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    🎬
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{video.title}</div>
                    <div className="text-[10px] text-slate-600 capitalize mt-0.5">
                      {video.platform} · Due {formatDate(video.dueDate)}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </motion.div>
              )
            })}
            {videos.length === 0 && (
              <div className="text-center py-8 text-slate-600 text-sm">No videos yet</div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Package usage */}
          {pkg && (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-white">Package</span>
                </div>
                <Link to="/client/package" className="text-[10px] text-blue-400 hover:text-blue-300">
                  Details
                </Link>
              </div>
              <div className="text-sm font-bold text-white mb-3">{pkg.name}</div>

              {[
                { label: 'Videos', used: pkg.consumedVideos, total: pkg.includedVideos },
                { label: 'Revisions', used: pkg.consumedRevisions, total: pkg.includedRevisions },
              ].map(({ label, used, total }) => {
                const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
                return (
                  <div key={label} className="mb-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-semibold ${pct >= 80 ? 'text-yellow-400' : 'text-white'}`}>
                        {used}/{total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#EAB308' : '#3B82F6' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Next booking */}
          {nextBooking && (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-bold text-white">Next Shoot</span>
              </div>
              <div className="text-sm font-semibold text-white">{nextBooking.studio ?? 'Studio Session'}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                📅 {formatDate(nextBooking.date)} · {nextBooking.time}
              </div>
              {nextBooking.location && (
                <div className="text-[11px] text-slate-500 mt-0.5">📍 {nextBooking.location}</div>
              )}
            </div>
          )}

          {/* Recent invoices */}
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white">Invoices</span>
              </div>
              <Link to="/client/invoices" className="text-[10px] text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>
            {invoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div className="text-xs text-white">{inv.invoiceNumber}</div>
                  <div className="text-[10px] text-slate-600">{formatDate(inv.issuedDate)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-white">{formatCurrency(inv.total)}</div>
                  <span className={`text-[9px] font-bold ${
                    inv.status === 'paid' ? 'text-emerald-400' :
                    inv.status === 'overdue' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {inv.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
            {invoices.length === 0 && (
              <div className="text-xs text-slate-600">No invoices yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
