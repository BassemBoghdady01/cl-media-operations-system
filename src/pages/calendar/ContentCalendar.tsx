import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Clock, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { calendarService, type CalendarItem } from '../../services/calendarService'
import { videoService } from '../../services/videoService'
import { clientService } from '../../services/clientService'
import { toastSuccess, toastError } from '../../lib/toast'
import { statusColors, getInitials, formatDate, formatDateShort } from '../../lib/utils'
import type { Client, Video } from '../../types'

type CalView = 'month' | 'week'

const PLATFORMS: Record<string, { color: string; short: string }> = {
  instagram: { color: '#E1306C', short: 'IG' },
  tiktok: { color: '#69C9D0', short: 'TT' },
  youtube: { color: '#FF0000', short: 'YT' },
  facebook: { color: '#1877F2', short: 'FB' },
  linkedin: { color: '#0A66C2', short: 'LI' },
}

/** Unified calendar entry: content_calendar rows merged with scheduled videos. */
interface CalendarEntry {
  id: string
  title: string
  clientName: string
  clientColor: string
  platform: string
  status: string
  date: string // YYYY-MM-DD
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface ScheduleForm {
  clientId: string
  title: string
  platform: string
  scheduledAt: string // datetime-local value
  caption: string
  status: 'draft' | 'scheduled'
}

function SchedulePostModal({
  clients, initialDate, saving, error, onSubmit, onClose,
}: {
  clients: Client[]
  initialDate: string | null
  saving: boolean
  error: string | null
  onSubmit: (form: ScheduleForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ScheduleForm>({
    clientId: '', title: '', platform: 'instagram',
    scheduledAt: initialDate ? `${initialDate}T12:00` : '',
    caption: '', status: 'scheduled',
  })
  const set = (patch: Partial<ScheduleForm>) => setForm((f) => ({ ...f, ...patch }))
  const valid = form.clientId && form.title.trim() && form.platform && form.scheduledAt

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
        className="glass-blue rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">Schedule Post</h2>
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
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Title</label>
            <input className="input py-2 text-xs mt-1" placeholder="What's being posted?"
              value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Platform</label>
              <select className="input py-2 text-xs mt-1 capitalize" value={form.platform}
                onChange={(e) => set({ platform: e.target.value })}>
                {Object.keys(PLATFORMS).map((p) => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Status</label>
              <select className="input py-2 text-xs mt-1" value={form.status}
                onChange={(e) => set({ status: e.target.value as 'draft' | 'scheduled' })}>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Date & Time</label>
            <input type="datetime-local" className="input py-2 text-xs mt-1" value={form.scheduledAt}
              onChange={(e) => set({ scheduledAt: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Caption (optional)</label>
            <textarea className="input py-2 text-xs mt-1 min-h-[64px]" placeholder="Post caption…"
              value={form.caption} onChange={(e) => set({ caption: e.target.value })} />
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
            {saving ? 'Scheduling…' : 'Schedule Post'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function ContentCalendar() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('calendar.manage')

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view, setView] = useState<CalView>('month')
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [selectedClient, setSelectedClient] = useState('All')
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [clientRows, setClientRows] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      calendarService.getAll(agencyId),
      videoService.getAll(agencyId),
      clientService.getAll(agencyId),
    ])
      .then(([items, vids, cls]) => {
        if (cancelled) return
        setCalendarItems(items)
        setVideos(vids)
        setClientRows(cls)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[ContentCalendar] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load the content calendar.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [agencyId, reload])

  const retry = () => setReload((n) => n + 1)

  const createPost = async (form: ScheduleForm) => {
    setCreating(true)
    setCreateError(null)
    try {
      await calendarService.create(agencyId, {
        clientId: form.clientId,
        title: form.title.trim(),
        platform: form.platform,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        caption: form.caption.trim() || undefined,
        status: form.status,
      })
      toastSuccess(form.status === 'scheduled' ? 'Post scheduled.' : 'Draft post added to the calendar.')
      setShowCreate(false)
      setReload((n) => n + 1)
    } catch (err) {
      console.error('[ContentCalendar] create failed', err)
      const msg = err instanceof Error ? err.message : 'Could not schedule the post.'
      setCreateError(msg)
      toastError(msg)
    } finally {
      setCreating(false)
    }
  }

  // Merge: content_calendar rows are the primary source; scheduled videos that
  // are not already linked to a calendar entry (via videoId) are added on top.
  const entries = useMemo<CalendarEntry[]>(() => {
    const fromCalendar: CalendarEntry[] = calendarItems
      .filter((c) => c.status !== 'cancelled' && c.scheduledAt)
      .map((c) => ({
        id: c.id,
        title: c.title,
        clientName: c.clientName ?? 'Client',
        clientColor: c.clientColor ?? '#3B82F6',
        platform: c.platform,
        status: c.status,
        date: c.scheduledAt.slice(0, 10),
      }))
    const linkedVideoIds = new Set(
      calendarItems.map((c) => c.videoId).filter((id): id is string => !!id)
    )
    const fromVideos: CalendarEntry[] = videos
      .filter((v) => v.scheduledDate && !linkedVideoIds.has(v.id))
      .map((v) => ({
        id: `video-${v.id}`,
        title: v.title,
        clientName: v.clientName,
        clientColor: v.clientColor,
        platform: v.platform,
        status: v.status,
        date: (v.scheduledDate as string).slice(0, 10),
      }))
    return [...fromCalendar, ...fromVideos]
  }, [calendarItems, videos])

  const clientNames = useMemo(
    () => ['All', ...new Set(entries.map((e) => e.clientName))],
    [entries]
  )

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }
  const shiftWeek = (days: number) => {
    setWeekStart((d) => {
      const x = new Date(d)
      x.setDate(x.getDate() + days)
      return x
    })
  }
  const goPrev = () => {
    setSelectedDate(null)
    if (view === 'month') prevMonth()
    else shiftWeek(-7)
  }
  const goNext = () => {
    setSelectedDate(null)
    if (view === 'month') nextMonth()
    else shiftWeek(7)
  }

  const getEntriesForDate = (dateStr: string) =>
    entries.filter((e) => {
      const match = e.date === dateStr
      const matchClient = selectedClient === 'All' || e.clientName === selectedClient
      const matchPlatform = selectedPlatform === 'All' || e.platform === selectedPlatform
      return match && matchClient && matchPlatform
    })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = (Array.from({ length: firstDay }, () => null) as (number | null)[]).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  )
  while (cells.length % 7 !== 0) cells.push(null)

  const monthDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekStart]
  )

  const headerTitle = view === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : `${formatDateShort(toDateStr(weekDays[0]))} – ${formatDateShort(toDateStr(weekDays[6]))}, ${weekDays[6].getFullYear()}`

  const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : []

  // Upcoming posts for sidebar
  const todayStr = toDateStr(today)
  const upcoming = entries
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  const renderDayCell = (dateStr: string, dayNum: number, key: string | number, minH: string, maxPills: number) => {
    const dayEntries = getEntriesForDate(dateStr)
    const isToday = dateStr === todayStr
    const isSelected = selectedDate === dateStr
    return (
      <motion.button
        key={key}
        whileHover={{ scale: 1.05 }}
        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
        className={`${minH} rounded-xl p-1.5 text-left transition-all relative overflow-hidden`}
        style={{
          background: isSelected ? 'rgba(59,130,246,0.2)' : isToday ? 'rgba(59,130,246,0.08)' : dayEntries.length > 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          border: isSelected ? '1px solid rgba(59,130,246,0.5)' : isToday ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
        }}>
        <div className={`text-[11px] font-bold mb-1 ${isToday ? 'text-blue-400' : isSelected ? 'text-white' : 'text-slate-400'}`}>
          {dayNum}
        </div>
        <div className="flex flex-wrap gap-0.5">
          {dayEntries.slice(0, maxPills).map((e) => (
            <div key={e.id}
              className="w-full px-1 py-0.5 rounded text-[9px] font-medium truncate"
              style={{ background: `${PLATFORMS[e.platform]?.color ?? '#64748B'}20`, color: PLATFORMS[e.platform]?.color ?? '#94A3B8' }}>
              {PLATFORMS[e.platform]?.short ?? e.platform.slice(0, 2).toUpperCase()} · {e.title.slice(0, 10)}…
            </div>
          ))}
          {dayEntries.length > maxPills && (
            <span className="text-[9px] text-slate-600">+{dayEntries.length - maxPills} more</span>
          )}
        </div>
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Content Calendar</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading schedule…' : `${entries.length} items scheduled or ready to post`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['month', 'week'] as const).map((v) => (
              <button key={v}
                onClick={() => {
                  setView(v)
                  if (v === 'week') setWeekStart(startOfWeek(new Date()))
                }}
                className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => { setCreateError(null); setShowCreate(true) }}>
              <Plus className="w-4 h-4" /> Schedule Post
            </button>
          )}
        </div>
      </div>

      {error ? (
        <PageErrorState title="We couldn't load the calendar" message={error} onRetry={retry} />
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <select className="input py-2 text-xs w-auto" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              {clientNames.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input py-2 text-xs w-auto" value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)}>
              {['All', 'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'].map((p) => <option key={p}>{p}</option>)}
            </select>
            {/* Platform legend */}
            <div className="flex items-center gap-3 ml-2">
              {Object.entries(PLATFORMS).map(([k, { color, short }]) => (
                <div key={k} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />{short}
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-3">
              <div className="glass-blue rounded-2xl p-5">
                {/* Period nav */}
                <div className="flex items-center justify-between mb-5">
                  <button onClick={goPrev} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-base font-bold text-white">{headerTitle}</h2>
                  <button onClick={goNext} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-slate-600 py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                {view === 'month' ? (
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} className="aspect-square" />
                      return renderDayCell(monthDateStr(day), day, i, 'min-h-[64px]', 3)
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((d) => renderDayCell(toDateStr(d), d.getDate(), toDateStr(d), 'min-h-[160px]', 6))}
                  </div>
                )}
              </div>

              {/* Selected day detail */}
              {selectedDate && selectedEntries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 glass-blue rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4">
                    {formatDate(selectedDate)} — {selectedEntries.length} post{selectedEntries.length > 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-3">
                    {selectedEntries.map((e) => {
                      const sc = statusColors[e.status]
                      const pc = PLATFORMS[e.platform]
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-3.5 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                            style={{ background: e.clientColor }}>
                            {getInitials(e.clientName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{e.title}</p>
                            <p className="text-[10px] text-slate-500">{e.clientName} · {e.platform}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: pc?.color ?? '#64748B' }} />
                            <span className="badge text-[10px]" style={{ background: sc?.bg, color: sc?.text }}>
                              {e.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Upcoming sidebar */}
            <div className="space-y-4">
              <div className="glass-blue rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">Upcoming Posts</h3>
                <div className="space-y-3">
                  {upcoming.map((e, i) => {
                    const pc = PLATFORMS[e.platform]
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: `${pc?.color ?? '#64748B'}20`, color: pc?.color ?? '#94A3B8' }}>
                          {pc?.short ?? e.platform.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate leading-tight">{e.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{e.clientName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-2.5 h-2.5 text-slate-600" />
                            <span className="text-[10px] text-slate-500">{e.date}</span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                  {upcoming.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4">No upcoming posts.</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="glass-blue rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Overview</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Posts Scheduled', value: entries.filter((e) => e.status === 'scheduled').length, color: '#8B5CF6' },
                    { label: 'Approved & Ready', value: entries.filter((e) => e.status === 'approved').length, color: '#10B981' },
                    { label: 'Already Posted', value: entries.filter((e) => e.status === 'posted').length, color: '#3B82F6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs text-slate-400">{label}</span>
                      </div>
                      <span className="text-sm font-black text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <SchedulePostModal
            clients={clientRows}
            initialDate={selectedDate}
            saving={creating}
            error={createError}
            onSubmit={createPost}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
