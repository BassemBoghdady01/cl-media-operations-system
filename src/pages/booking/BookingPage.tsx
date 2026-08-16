import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Plus, Calendar, Clock, MapPin, Users, CheckCircle,
  ChevronLeft, ChevronRight, X, Check, DollarSign, FileText, Phone,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { bookingService } from '../../services/bookingService'
import { clientService } from '../../services/clientService'
import { userService, type ManagedUser } from '../../services/userService'
import { getInitials, formatCurrency } from '../../lib/utils'
import type { Booking, Client } from '../../types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  requested:    { label: 'Requested',    color: '#94A3B8', bg: 'rgba(100,116,139,0.15)' },
  confirmed:    { label: 'Confirmed',    color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  deposit_paid: { label: 'Deposit Paid', color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
  scheduled:    { label: 'Scheduled',    color: '#34D399', bg: 'rgba(16,185,129,0.15)' },
  completed:    { label: 'Completed',    color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  cancelled:    { label: 'Cancelled',    color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
  rescheduled:  { label: 'Rescheduled',  color: '#FBBF24', bg: 'rgba(245,158,11,0.15)' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

/** Minimal team-member shape resolved from real profiles. */
interface TeamLite {
  id: string
  name: string
  color: string
}

function BookingCard({ booking, team, onClick }: { booking: Booking; team: TeamLite[]; onClick: () => void }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.requested

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="glass-blue rounded-2xl p-5 cursor-pointer"
      style={{ border: `1px solid ${booking.clientColor}20` }}>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${booking.clientColor}, ${booking.clientColor}88)` }}>
            {getInitials(booking.clientName)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{booking.clientName}</h3>
            <p className="text-[11px] text-slate-500">{booking.studio ?? 'On Location'}</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5 text-slate-600" />
          {booking.date} · {booking.time}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          {booking.duration || '—'}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-slate-600" />
          <span className="truncate">{booking.location || '—'}</span>
        </div>
      </div>

      {booking.shotList && booking.shotList.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1.5">Shot List</p>
          <div className="flex flex-wrap gap-1">
            {booking.shotList.slice(0, 3).map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
                {s}
              </span>
            ))}
            {booking.shotList.length > 3 && (
              <span className="text-[10px] text-slate-600">+{booking.shotList.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex -space-x-1.5">
          {team.map((m) => (
            <div key={m.id} className="w-6 h-6 rounded-full border-2 border-[#04081A] flex items-center justify-center text-[8px] font-black text-white"
              style={{ background: m.color }}>
              {getInitials(m.name)}
            </div>
          ))}
        </div>
        {booking.depositAmount != null && booking.depositAmount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px]"
            style={{ color: booking.depositPaid ? '#34D399' : '#FBBF24' }}>
            <DollarSign className="w-3 h-3" />
            <span>{formatCurrency(booking.depositAmount)} deposit {booking.depositPaid ? '✓' : 'pending'}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function BookingDetailModal({
  booking, team, confirming, onConfirm, onClose,
}: {
  booking: Booking
  team: TeamLite[]
  confirming: boolean
  onConfirm: (booking: Booking) => void
  onClose: () => void
}) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.requested
  const canConfirm = booking.status === 'requested' || booking.status === 'rescheduled'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-lg"
        style={{ border: `1px solid ${booking.clientColor}30` }}>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white"
              style={{ background: `linear-gradient(135deg, ${booking.clientColor}, ${booking.clientColor}88)` }}>
              {getInitials(booking.clientName)}
            </div>
            <div>
              <h2 className="text-base font-black text-white">{booking.clientName}</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { icon: Calendar, label: 'Date', value: booking.date },
            { icon: Clock, label: 'Time', value: booking.duration ? `${booking.time} · ${booking.duration}` : booking.time },
            { icon: MapPin, label: 'Location', value: booking.location || '—' },
            { icon: Camera, label: 'Studio', value: booking.studio ?? 'On Location' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-xs text-white font-medium">{value}</p>
            </div>
          ))}
        </div>

        {booking.shotList && booking.shotList.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-white mb-2.5 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-400" /> Shot List
            </p>
            <div className="space-y-1.5">
              {booking.shotList.map((shot, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Check className="w-2.5 h-2.5 text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-300">{shot}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs font-bold text-white mb-2.5 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-purple-400" /> Assigned Team
          </p>
          {team.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: `${m.color}15`, border: `1px solid ${m.color}25` }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: m.color }}>
                    {getInitials(m.name)}
                  </div>
                  <span className="text-xs text-slate-300">{m.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No team assigned yet.</p>
          )}
        </div>

        {booking.depositAmount != null && booking.depositAmount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl mb-5"
            style={{ background: booking.depositPaid ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)' }}>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" style={{ color: booking.depositPaid ? '#34D399' : '#FBBF24' }} />
              <span className="text-xs" style={{ color: booking.depositPaid ? '#34D399' : '#FBBF24' }}>
                Deposit: {formatCurrency(booking.depositAmount)}
              </span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: booking.depositPaid ? '#34D399' : '#FBBF24' }}>
              {booking.depositPaid ? 'PAID' : 'PENDING'}
            </span>
          </div>
        )}

        {booking.notes && (
          <div className="p-3 rounded-xl mb-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-xs text-slate-400">{booking.notes}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1 text-xs py-2.5">
            <Phone className="w-3.5 h-3.5" /> Contact Client
          </button>
          {canConfirm && (
            <button
              className="btn-primary flex-1 text-xs py-2.5 disabled:opacity-50"
              disabled={confirming}
              onClick={() => onConfirm(booking)}>
              <CheckCircle className="w-3.5 h-3.5" /> {confirming ? 'Confirming…' : 'Confirm Booking'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

interface NewBookingForm {
  clientId: string
  date: string
  time: string
  endTime: string
  location: string
  studio: string
  notes: string
}

const EMPTY_FORM: NewBookingForm = {
  clientId: '', date: '', time: '', endTime: '', location: '', studio: '', notes: '',
}

function NewBookingModal({
  clients, saving, error, onSubmit, onClose,
}: {
  clients: Client[]
  saving: boolean
  error: string | null
  onSubmit: (form: NewBookingForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<NewBookingForm>(EMPTY_FORM)
  const set = (patch: Partial<NewBookingForm>) => setForm((f) => ({ ...f, ...patch }))
  const valid = form.clientId && form.date && form.time

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-md">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">New Booking</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Client</label>
            <select className="input py-2 text-xs mt-1" value={form.clientId}
              onChange={(e) => set({ clientId: e.target.value })}>
              <option value="">Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.brandName || c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Date</label>
              <input type="date" className="input py-2 text-xs mt-1" value={form.date}
                onChange={(e) => set({ date: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Start</label>
              <input type="time" className="input py-2 text-xs mt-1" value={form.time}
                onChange={(e) => set({ time: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">End</label>
              <input type="time" className="input py-2 text-xs mt-1" value={form.endTime}
                onChange={(e) => set({ endTime: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Location</label>
            <input className="input py-2 text-xs mt-1" placeholder="Address or venue"
              value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Studio (optional)</label>
            <input className="input py-2 text-xs mt-1" placeholder="Studio name"
              value={form.studio} onChange={(e) => set({ studio: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Notes (optional)</label>
            <textarea className="input py-2 text-xs mt-1 min-h-[64px]" placeholder="Anything the crew should know…"
              value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <button
            className="btn-primary w-full justify-center text-xs py-2.5 disabled:opacity-50"
            disabled={!valid || saving}
            onClick={() => onSubmit(form)}>
            {saving ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BookingPage() {
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [bookings, setBookings] = useState<Booking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bookingRows, clientRows, userRows] = await Promise.all([
          bookingService.getAll(agencyId),
          clientService.getAll(agencyId),
          userService.listUsers(agencyId),
        ])
        if (cancelled) return
        setBookings(bookingRows)
        setClients(clientRows)
        setMembers(userRows.filter((u) => u.role !== 'client'))
      } catch (err) {
        if (cancelled) return
        console.error('[BookingPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load bookings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  // Map assigned-team user ids to real member names/colors.
  const membersById = useMemo(() => {
    const map = new Map<string, TeamLite>()
    members.forEach((m) => map.set(m.id, { id: m.id, name: m.full_name || m.email, color: m.color }))
    return map
  }, [members])

  const resolveTeam = (b: Booking): TeamLite[] =>
    b.assignedTeam.map((id) => membersById.get(id)).filter((m): m is TeamLite => !!m)

  const confirmBooking = async (b: Booking) => {
    setConfirming(true)
    const previous = bookings
    setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: 'confirmed' } : x)))
    setSelectedBooking((s) => (s && s.id === b.id ? { ...s, status: 'confirmed' } : s))
    try {
      await bookingService.updateStatus(b.id, 'confirmed')
    } catch (err) {
      console.error('[BookingPage] confirm failed', err)
      setBookings(previous)
      setSelectedBooking((s) => (s && s.id === b.id ? { ...s, status: b.status } : s))
    } finally {
      setConfirming(false)
    }
  }

  const createBooking = async (form: NewBookingForm) => {
    setCreating(true)
    setCreateError(null)
    try {
      await bookingService.create(agencyId, {
        clientId: form.clientId,
        date: form.date,
        time: form.time,
        endTime: form.endTime || undefined,
        location: form.location,
        studio: form.studio || undefined,
        notes: form.notes || undefined,
      })
      setShowCreate(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[BookingPage] create failed', err)
      setCreateError(err instanceof Error ? err.message : 'Could not create the booking.')
    } finally {
      setCreating(false)
    }
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)
  const totalSlots = Math.ceil((daysInMonth + firstDay) / 7) * 7

  const bookingsByDate: Record<string, Booking[]> = {}
  bookings.forEach((b) => {
    const d = b.date
    if (!bookingsByDate[d]) bookingsByDate[d] = []
    bookingsByDate[d].push(b)
  })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const upcomingBookings = bookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))

  const thisMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const stats = [
    { label: 'This Month', value: bookings.filter((b) => b.date.startsWith(thisMonthPrefix)).length, color: '#3B82F6' },
    { label: 'Confirmed', value: bookings.filter((b) => b.status === 'confirmed' || b.status === 'deposit_paid').length, color: '#8B5CF6' },
    { label: 'Pending Deposit', value: bookings.filter((b) => (b.depositAmount ?? 0) > 0 && !b.depositPaid).length, color: '#F59E0B' },
    { label: 'Completed', value: bookings.filter((b) => b.status === 'completed').length, color: '#10B981' },
  ]

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load your bookings"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Shooting Bookings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage studio sessions and on-location shoots</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['calendar', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary text-sm" onClick={() => { setCreateError(null); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="glass-blue rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18` }}>
                  <Camera className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{value}</div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {view === 'calendar' ? (
            <div className="grid xl:grid-cols-[1fr_300px] gap-6">
              {/* Calendar */}
              <div className="glass-blue rounded-2xl overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between px-6 py-4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={prevMonth}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-sm font-bold text-white">{MONTHS[month]} {year}</h2>
                  <button onClick={nextMonth}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 px-4 pt-3 pb-1">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-bold text-slate-600 pb-2">{d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-px px-4 pb-4"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {Array.from({ length: totalSlots }).map((_, idx) => {
                    const dayNum = idx - firstDay + 1
                    const isValid = dayNum >= 1 && dayNum <= daysInMonth
                    const isToday = isValid && year === today.getFullYear() && month === today.getMonth() && dayNum === today.getDate()
                    const dateStr = isValid
                      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                      : ''
                    const dayBookings = dateStr ? (bookingsByDate[dateStr] ?? []) : []

                    return (
                      <div key={idx} className={`min-h-[80px] p-1.5 rounded-lg transition-colors ${isValid ? 'hover:bg-white/[0.02] cursor-pointer' : 'opacity-0 pointer-events-none'}`}
                        style={{ background: isToday ? 'rgba(59,130,246,0.08)' : 'rgba(13,22,47,0.6)' }}>
                        {isValid && (
                          <>
                            <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>
                              {dayNum}
                            </div>
                            <div className="space-y-0.5">
                              {dayBookings.map((b) => (
                                <button key={b.id}
                                  onClick={() => setSelectedBooking(b)}
                                  className="w-full text-left px-1.5 py-0.5 rounded-md text-[9px] font-medium truncate transition-opacity hover:opacity-80"
                                  style={{ background: `${b.clientColor}20`, color: b.clientColor }}>
                                  {b.time} {b.clientName.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Upcoming sidebar */}
              <div className="glass-blue rounded-2xl overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="text-sm font-bold text-white">Upcoming Shoots</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{upcomingBookings.length} scheduled</p>
                </div>
                <div className="p-4 space-y-3">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Camera className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-600">No upcoming bookings</p>
                    </div>
                  ) : upcomingBookings.map((b, i) => {
                    const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.requested
                    return (
                      <motion.button key={b.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.06, 0.6) }}
                        onClick={() => setSelectedBooking(b)}
                        className="w-full text-left p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.clientColor }} />
                          <span className="text-xs font-semibold text-white truncate">{b.clientName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{b.date} · {b.time}</div>
                        <div className="text-[10px] text-slate-600 truncate">{b.location}</div>
                        <span className="inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* List View */
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {bookings.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3 text-center py-10">
                  <Camera className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">No bookings yet</p>
                  <p className="text-slate-600 text-xs mt-1">Create your first shoot session below.</p>
                </div>
              )}
              {bookings.map((b, i) => (
                <motion.div key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.06, 0.6) }}>
                  <BookingCard booking={b} team={resolveTeam(b)} onClick={() => setSelectedBooking(b)} />
                </motion.div>
              ))}
              {/* New booking card */}
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(bookings.length * 0.06, 0.6) }}
                onClick={() => { setCreateError(null); setShowCreate(true) }}
                className="glass-blue rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[240px] hover:bg-white/[0.03] transition-colors"
                style={{ border: '2px dashed rgba(59,130,246,0.2)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.08)' }}>
                  <Plus className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">New Booking</p>
                  <p className="text-[11px] text-slate-600 mt-1">Schedule a shoot session</p>
                </div>
              </motion.button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            team={resolveTeam(selectedBooking)}
            confirming={confirming}
            onConfirm={confirmBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}
        {showCreate && (
          <NewBookingModal
            clients={clients}
            saving={creating}
            error={createError}
            onSubmit={createBooking}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
