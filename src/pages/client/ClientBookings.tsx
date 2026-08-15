import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, MapPin, Clock, Users, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { bookingService } from '../../services/bookingService'
import type { Booking } from '../../types'
import { format, parseISO } from 'date-fns'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:    { label: 'Confirmed', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  deposit_paid: { label: 'Deposit Paid', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  scheduled:    { label: 'Scheduled', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  completed:    { label: 'Completed', color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
  requested:    { label: 'Pending Confirmation', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  cancelled:    { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
}

export default function ClientBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    bookingService.getByClient(user.id).then((data) => {
      setBookings(data)
      setLoading(false)
    })
      .catch((err) => {
        console.error('[ClientBookings] data load failed', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
        setLoading(false)
      })
  }, [user])

  const upcoming = bookings.filter(
    (b) => !['completed', 'cancelled'].includes(b.status)
  )
  const past = bookings.filter((b) => ['completed', 'cancelled'].includes(b.status))

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Shooting Bookings</h1>
        <p className="text-sm text-slate-400">Your scheduled and upcoming shoot sessions</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16 }}>
          <Camera className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">No bookings yet</p>
          <p className="text-xs text-slate-600 mt-1">Contact your account manager to schedule a shoot</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((booking, i) => (
                  <BookingCard key={booking.id} booking={booking} index={i} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Past</h2>
              <div className="space-y-3 opacity-60">
                {past.map((booking, i) => (
                  <BookingCard key={booking.id} booking={booking} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  const status = STATUS_CONFIG[booking.status] ?? { label: booking.status, color: '#64748B', bg: 'rgba(100,116,139,0.1)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-base font-bold text-white">{booking.studio ?? 'Shoot Session'}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Camera className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-400">
              {format(parseISO(booking.date), 'EEEE, MMMM d, yyyy')} · {booking.time}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
          style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-slate-400">
        {booking.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-600" />
            {booking.location}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-600" />
          {booking.duration}
        </div>
      </div>

      {booking.shotList && booking.shotList.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Shot List</div>
          <div className="space-y-1">
            {booking.shotList.map((shot, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
                {shot}
              </div>
            ))}
          </div>
        </div>
      )}

      {booking.notes && (
        <p className="text-xs text-slate-500 mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {booking.notes}
        </p>
      )}
    </motion.div>
  )
}
