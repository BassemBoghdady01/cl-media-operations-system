import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Plus, Filter, Instagram,
  Youtube, Linkedin, Calendar as CalIcon, Clock, CheckCircle,
} from 'lucide-react'
import { mockVideos } from '../../data/mockData'
import { statusColors, getInitials } from '../../lib/utils'

type CalView = 'month' | 'week'

const PLATFORMS: Record<string, { color: string; short: string }> = {
  instagram: { color: '#E1306C', short: 'IG' },
  tiktok: { color: '#69C9D0', short: 'TT' },
  youtube: { color: '#FF0000', short: 'YT' },
  facebook: { color: '#1877F2', short: 'FB' },
  linkedin: { color: '#0A66C2', short: 'LI' },
}

const STATUS_DOT: Record<string, string> = {
  approved: '#10B981',
  scheduled: '#8B5CF6',
  posted: '#10B981',
  client_review: '#EAB308',
  editing: '#3B82F6',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const scheduledVideos = mockVideos.filter((v) => v.scheduledDate || v.status === 'approved' || v.status === 'scheduled')

export default function ContentCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view, setView] = useState<CalView>('month')
  const [selectedClient, setSelectedClient] = useState('All')
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const clients = ['All', ...new Set(mockVideos.map((v) => v.clientName))]

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  const getVideosForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return scheduledVideos.filter((v) => {
      const date = v.scheduledDate ?? v.dueDate
      const match = date === dateStr
      const matchClient = selectedClient === 'All' || v.clientName === selectedClient
      const matchPlatform = selectedPlatform === 'All' || v.platform === selectedPlatform
      return match && matchClient && matchPlatform
    })
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = (Array.from({ length: firstDay }, () => null) as (number | null)[]).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  )
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedVideos = selectedDay ? getVideosForDay(selectedDay) : []

  // Upcoming posts for sidebar
  const upcoming = scheduledVideos
    .filter((v) => {
      const d = new Date(v.scheduledDate ?? v.dueDate)
      return d >= today
    })
    .sort((a, b) => {
      const da = new Date(a.scheduledDate ?? a.dueDate)
      const db = new Date(b.scheduledDate ?? b.dueDate)
      return da.getTime() - db.getTime()
    })
    .slice(0, 6)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Content Calendar</h1>
          <p className="text-slate-400 text-sm mt-1">{scheduledVideos.length} items scheduled or ready to post</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['month', 'week'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Schedule Post
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input py-2 text-xs w-auto" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
          {clients.map((c) => <option key={c}>{c}</option>)}
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
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-white">{MONTH_NAMES[month]} {year}</h2>
              <button onClick={nextMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all">
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
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />
                const videos = getVideosForDay(day)
                const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
                const isSelected = selectedDay === day
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className="min-h-[64px] rounded-xl p-1.5 text-left transition-all relative overflow-hidden"
                    style={{
                      background: isSelected ? 'rgba(59,130,246,0.2)' : isToday ? 'rgba(59,130,246,0.08)' : videos.length > 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      border: isSelected ? '1px solid rgba(59,130,246,0.5)' : isToday ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                    }}>
                    <div className={`text-[11px] font-bold mb-1 ${isToday ? 'text-blue-400' : isSelected ? 'text-white' : 'text-slate-400'}`}>
                      {day}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {videos.slice(0, 3).map((v) => (
                        <div key={v.id}
                          className="w-full px-1 py-0.5 rounded text-[9px] font-medium truncate"
                          style={{ background: `${PLATFORMS[v.platform]?.color}20`, color: PLATFORMS[v.platform]?.color }}>
                          {PLATFORMS[v.platform]?.short} · {v.title.slice(0, 10)}…
                        </div>
                      ))}
                      {videos.length > 3 && (
                        <span className="text-[9px] text-slate-600">+{videos.length - 3} more</span>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && selectedVideos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 glass-blue rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">
                {MONTH_NAMES[month]} {selectedDay} — {selectedVideos.length} post{selectedVideos.length > 1 ? 's' : ''}
              </h3>
              <div className="space-y-3">
                {selectedVideos.map((v) => {
                  const sc = statusColors[v.status]
                  const pc = PLATFORMS[v.platform]
                  return (
                    <div key={v.id} className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                        style={{ background: v.clientColor }}>
                        {getInitials(v.clientName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{v.title}</p>
                        <p className="text-[10px] text-slate-500">{v.clientName} · {v.platform}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: pc?.color }} />
                        <span className="badge text-[10px]" style={{ background: sc?.bg, color: sc?.text }}>
                          {v.status.replace('_', ' ')}
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
              {upcoming.map((v, i) => {
                const date = v.scheduledDate ?? v.dueDate
                const sc = statusColors[v.status]
                const pc = PLATFORMS[v.platform]
                return (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: `${pc?.color}20`, color: pc?.color }}>
                      {pc?.short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate leading-tight">{v.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{v.clientName}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-2.5 h-2.5 text-slate-600" />
                        <span className="text-[10px] text-slate-500">{date}</span>
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
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">This Month</h3>
            <div className="space-y-3">
              {[
                { label: 'Posts Scheduled', value: scheduledVideos.filter((v) => v.status === 'scheduled').length, color: '#8B5CF6' },
                { label: 'Approved & Ready', value: scheduledVideos.filter((v) => v.status === 'approved').length, color: '#10B981' },
                { label: 'Already Posted', value: mockVideos.filter((v) => v.status === 'posted').length, color: '#3B82F6' },
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
    </motion.div>
  )
}
