import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { calendarService, type CalendarItem } from '../../services/calendarService'
import { format, parseISO, isSameMonth, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', youtube: '▶️', facebook: '👥', linkedin: '💼',
}

export default function ClientCalendar() {
  const { user } = useAuth()
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    calendarService.getByClient(user.id, false).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [user])

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const getItemsForDay = (date: Date) =>
    items.filter((item) => {
      const d = parseISO(item.scheduledAt)
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth() === date.getMonth() &&
             d.getDate() === date.getDate()
    })

  const selectedItems = selectedDay
    ? items.filter((item) => item.scheduledAt.startsWith(selectedDay))
    : []

  const firstDayOfWeek = getDay(startOfMonth(currentMonth))

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Content Calendar</h1>
        <p className="text-sm text-slate-400">Scheduled and published content for your brand</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
          ‹
        </button>
        <h2 className="text-base font-bold text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
          ›
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Calendar grid */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Day headers */}
            <div className="grid grid-cols-7">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="p-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16"
                  style={{ borderRight: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }} />
              ))}

              {monthDays.map((day) => {
                const dayItems = getItemsForDay(day)
                const dayStr = format(day, 'yyyy-MM-dd')
                const isSelected = selectedDay === dayStr
                const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr
                const isCurrentMonth = isSameMonth(day, currentMonth)

                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDay(isSelected ? null : dayStr)}
                    className="h-16 p-1.5 text-left transition-all hover:bg-white/[0.03] relative"
                    style={{
                      borderRight: '1px solid rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                    }}>
                    <span className={`text-xs font-medium block mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-blue-500 text-white' :
                      isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {dayItems.slice(0, 2).map((item) => (
                        <span key={item.id}
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: item.status === 'posted' ? '#10B981' : '#3B82F6' }} />
                      ))}
                      {dayItems.length > 2 && (
                        <span className="text-[8px] text-slate-600">+{dayItems.length - 2}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-3">
            {selectedItems.length > 0 ? (
              <>
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  {selectedDay && format(parseISO(selectedDay), 'EEEE, MMM d')}
                </div>
                {selectedItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{PLATFORM_ICONS[item.platform] ?? '📱'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 capitalize">{item.platform}</div>
                        {item.caption && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.caption}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.status === 'posted' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10'
                          }`}>
                            {item.status === 'posted' ? '✓ Posted' : '⏰ Scheduled'}
                          </span>
                          {item.publishedUrl && (
                            <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer"
                              className="text-slate-600 hover:text-blue-400 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            ) : (
              <div className="rounded-xl p-6 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <Calendar className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                <p className="text-xs text-slate-500">
                  {selectedDay ? 'No content scheduled for this day' : 'Click a day to see scheduled content'}
                </p>
              </div>
            )}

            {/* Upcoming */}
            <div className="pt-2">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Upcoming</div>
              {items
                .filter((i) => i.status === 'scheduled' && new Date(i.scheduledAt) >= new Date())
                .slice(0, 3)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-2 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <Clock className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-600">
                        {format(parseISO(item.scheduledAt), 'MMM d · h:mm a')}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
