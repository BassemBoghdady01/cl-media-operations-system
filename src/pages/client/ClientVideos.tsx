import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Film, Clock, CheckCircle, Eye, ExternalLink, Filter } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { videoService } from '../../services/videoService'
import type { Video } from '../../types'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  client_review: { label: 'Awaiting Your Review', color: '#EAB308', bg: 'rgba(234,179,8,0.1)' },
  approved:      { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  scheduled:     { label: 'Scheduled', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  posted:        { label: 'Posted', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  revision:      { label: 'In Revision', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', youtube: '▶️', facebook: '👥', linkedin: '💼',
}

export default function ClientVideos() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    videoService.getByClient(user.id).then((data) => {
      setVideos(data)
      setLoading(false)
    })
      .catch((err) => {
        console.error('[ClientVideos] data load failed', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
        setLoading(false)
      })
  }, [user])

  const filtered = filter === 'all' ? videos : videos.filter((v) => v.status === filter)

  const statusCounts = {
    client_review: videos.filter((v) => v.status === 'client_review').length,
    approved: videos.filter((v) => v.status === 'approved').length,
    scheduled: videos.filter((v) => v.status === 'scheduled').length,
    posted: videos.filter((v) => v.status === 'posted').length,
  }

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Your Videos</h1>
        <p className="text-sm text-slate-400">Track your content from production to publishing</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Awaiting Review', count: statusCounts.client_review, color: '#EAB308', icon: Eye },
          { label: 'Approved', count: statusCounts.approved, color: '#10B981', icon: CheckCircle },
          { label: 'Scheduled', count: statusCounts.scheduled, color: '#3B82F6', icon: Clock },
          { label: 'Posted', count: statusCounts.posted, color: '#8B5CF6', icon: Film },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Icon className="w-4 h-4 mb-2" style={{ color }} />
            <div className="text-xl font-black text-white">{count}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        {['all', 'client_review', 'approved', 'scheduled', 'posted'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filter === s
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}>
            {s === 'all' ? 'All Videos' : STATUS_LABELS[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Film className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No videos found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((video, i) => {
            const statusInfo = STATUS_LABELS[video.status] ?? { label: video.status, color: '#64748B', bg: 'rgba(100,116,139,0.1)' }
            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl p-4 flex items-center gap-4 group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* Platform icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {PLATFORM_ICONS[video.platform] ?? '🎬'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{video.title}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-slate-500 capitalize">{video.platform}</span>
                    {video.dueDate && (
                      <span className="text-[11px] text-slate-600">
                        Due {new Date(video.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {video.version > 1 && (
                      <span className="text-[11px] text-slate-600">v{video.version}</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
                  style={{ background: statusInfo.bg, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>

                {/* Action */}
                {video.postedUrl && (
                  <a href={video.postedUrl} target="_blank" rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
