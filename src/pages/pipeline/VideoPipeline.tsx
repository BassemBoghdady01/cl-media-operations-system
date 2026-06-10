import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Search, Filter, Plus, ChevronDown, Calendar, User,
  AlertTriangle, Clock, Instagram, Youtube, Linkedin,
} from 'lucide-react'
import { mockVideos } from '../../data/mockData'
import { statusColors, priorityColors, platformLabels, getInitials } from '../../lib/utils'
import type { VideoStatus, Video } from '../../types'

const columns: { id: VideoStatus; label: string; color: string }[] = [
  { id: 'idea', label: 'Idea', color: '#64748B' },
  { id: 'script', label: 'Script', color: '#8B5CF6' },
  { id: 'shooting', label: 'Shooting', color: '#F59E0B' },
  { id: 'editing', label: 'Editing', color: '#3B82F6' },
  { id: 'internal_review', label: 'Internal Review', color: '#06B6D4' },
  { id: 'client_review', label: 'Client Review', color: '#EAB308' },
  { id: 'revision', label: 'Revision', color: '#EF4444' },
  { id: 'approved', label: 'Approved', color: '#10B981' },
  { id: 'scheduled', label: 'Scheduled', color: '#8B5CF6' },
  { id: 'posted', label: 'Posted', color: '#10B981' },
]

const platformIcon: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-3 h-3" style={{ color: '#E1306C' }} />,
  tiktok: <span className="text-[10px] font-black" style={{ color: '#69C9D0' }}>TT</span>,
  youtube: <Youtube className="w-3 h-3" style={{ color: '#FF0000' }} />,
  linkedin: <Linkedin className="w-3 h-3" style={{ color: '#0A66C2' }} />,
  facebook: <span className="text-[10px] font-black" style={{ color: '#1877F2' }}>f</span>,
}

function VideoCard({ video }: { video: Video }) {
  const pc = priorityColors[video.priority]
  const sc = statusColors[video.status]
  const isOverdue = new Date(video.dueDate) < new Date()

  return (
    <Link to={`/app/pipeline/${video.id}`}>
      <motion.div
        layout
        whileHover={{ scale: 1.02, y: -1 }}
        className="rounded-xl p-3.5 mb-2.5 cursor-pointer group transition-all"
        style={{ background: 'rgba(13,22,47,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
        onHoverStart={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(59,130,246,0.35)' }}
        onHoverEnd={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>

        {/* Priority + Platform */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="badge text-[10px] px-1.5 py-0.5" style={{ background: pc.bg, color: pc.text }}>
            {video.priority}
          </span>
          <div className="flex items-center gap-1.5">
            {platformIcon[video.platform]}
            <span className="text-[9px] text-slate-500 uppercase">{video.format}</span>
          </div>
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-white leading-snug mb-1.5 line-clamp-2">{video.title}</p>

        {/* Client */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
            style={{ background: video.clientColor }}>
            {getInitials(video.clientName)[0]}
          </div>
          <span className="text-[10px] text-slate-500 truncate">{video.clientName}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1" style={{ color: isOverdue ? '#EF4444' : '#64748B' }}>
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{video.dueDate}</span>
          </div>
          <div className="flex items-center gap-2">
            {video.revisionCount > 0 && (
              <span className="text-[10px] text-amber-400">{video.revisionCount}↻</span>
            )}
            {video.assignedEditorName && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ background: '#06B6D4' }}>
                {getInitials(video.assignedEditorName)}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function VideoPipeline() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState('All')
  const [view, setView] = useState<'board' | 'list'>('board')

  const clients = ['All', ...new Set(mockVideos.map((v) => v.clientName))]

  const filtered = mockVideos.filter((v) => {
    const matchSearch = v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.clientName.toLowerCase().includes(search.toLowerCase())
    const matchClient = selectedClient === 'All' || v.clientName === selectedClient
    return matchSearch && matchClient
  })

  const getColumnVideos = (status: VideoStatus) => filtered.filter((v) => v.status === status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Video Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">{mockVideos.length} videos · {mockVideos.filter((v) => v.priority === 'urgent').length} urgent</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['board', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-medium transition-all capitalize"
                style={{ background: view === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: view === v ? '#60A5FA' : '#64748B' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Video
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input className="input pl-9 py-2 text-xs w-56" placeholder="Search videos…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input py-2 text-xs w-auto" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Film className="w-3.5 h-3.5" />
          <span>{filtered.length} results</span>
        </div>
      </div>

      {/* Board view */}
      {view === 'board' && (
        <div className="overflow-x-auto no-scrollbar pb-4">
          <div className="flex gap-3 min-w-max">
            {columns.map(({ id, label, color }) => {
              const colVideos = getColumnVideos(id)
              return (
                <div key={id} className="w-60 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}>
                      {colVideos.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div className="min-h-24 rounded-xl p-2"
                    style={{ background: `${color}06`, border: `1px solid ${color}15` }}>
                    <AnimatePresence>
                      {colVideos.map((v) => (
                        <VideoCard key={v.id} video={v} />
                      ))}
                    </AnimatePresence>
                    {colVideos.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-[10px] text-slate-700">
                        No videos
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2">
          {filtered.map((v) => {
            const sc = statusColors[v.status]
            const pc = priorityColors[v.priority]
            return (
              <Link key={v.id} to={`/app/pipeline/${v.id}`}
                className="flex items-center gap-4 glass-blue rounded-xl px-4 py-3.5 hover:border-blue-500/30 transition-all">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${sc?.dot}15` }}>
                  <Film className="w-4 h-4" style={{ color: sc?.dot }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{v.title}</p>
                  <p className="text-xs text-slate-500">{v.clientName} · {platformLabels[v.platform]} · Due {v.dueDate}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="badge text-[10px]" style={{ background: pc.bg, color: pc.text }}>{v.priority}</span>
                  <span className="badge text-[10px]" style={{ background: sc?.bg, color: sc?.text }}>
                    {v.status.replace('_', ' ')}
                  </span>
                  {v.assignedEditorName && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: '#06B6D4' }}>
                      {getInitials(v.assignedEditorName)}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
