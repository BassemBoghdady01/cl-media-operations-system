import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Film, Clock, CheckCircle, Eye, ExternalLink, Filter, RotateCcw, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { videoService } from '../../services/videoService'
import { db } from '../../services/serviceCore'
import { toastError, toastSuccess } from '../../lib/toast'
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
  const { user, profile } = useAuth()
  // Portal data is keyed by the linked client record, not the auth user id.
  const clientId = profile?.client_id ?? user?.id ?? ''
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<string>(params.get('status') ?? 'all')
  const [reviewing, setReviewing] = useState<{ video: Video; decision: 'approved' | 'revision' } | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submitReview = async () => {
    if (!reviewing || saving) return
    if (reviewing.decision === 'revision' && !comment.trim()) {
      toastError('Tell us what to change.')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().rpc('client_review_video', {
        p_video: reviewing.video.id, p_decision: reviewing.decision, p_comment: comment.trim() || null,
      })
      if (error) throw error
      toastSuccess(reviewing.decision === 'approved'
        ? 'Approved — thank you!'
        : 'Sent back to the team with your notes.')
      setVideos((list) => reviewing.decision === 'approved'
        ? list.map((v) => (v.id === reviewing.video.id ? { ...v, status: 'approved' } : v))
        : list.filter((v) => v.id !== reviewing.video.id))
      setReviewing(null)
      setComment('')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    videoService.getByClient(clientId).then((data) => {
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

  if (loadError) {
    return (
      <PageErrorState
        message={loadError}
        onRetry={() => {
          setLoadError(null)
          setLoading(true)
          window.location.reload()
        }}
      />
    )
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
            className={`px-3 py-1 min-h-[40px] lg:min-h-0 rounded-lg text-xs font-medium transition-all ${
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
                className="rounded-xl p-4 flex items-center gap-3 sm:gap-4 group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* Platform icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {PLATFORM_ICONS[video.platform] ?? '🎬'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{video.title}</div>
                  <div className="flex items-center gap-x-3 gap-y-0.5 mt-1 flex-wrap">
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

                {/* Review actions */}
                {video.status === 'client_review' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setComment(''); setReviewing({ video, decision: 'revision' }) }}
                      className="px-2.5 min-h-[40px] lg:min-h-0 lg:py-1.5 rounded-lg text-[11px] font-semibold text-orange-300 flex items-center gap-1"
                      style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
                      <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">Changes</span>
                    </button>
                    <button onClick={() => { setComment(''); setReviewing({ video, decision: 'approved' }) }}
                      className="px-2.5 min-h-[40px] lg:min-h-0 lg:py-1.5 rounded-lg text-[11px] font-semibold text-green-300 flex items-center gap-1"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>
                      <CheckCircle className="w-3 h-3" /> <span className="hidden sm:inline">Approve</span>
                    </button>
                  </div>
                )}

                {/* Action */}
                {(video.postedUrl || video.finalUrl) && (
                  <a href={video.postedUrl || video.finalUrl} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 lg:w-7 lg:h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setReviewing(null)}>
          <div className="w-full max-w-md rounded-2xl p-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
            style={{ background: '#0A1230', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-white">
                {reviewing.decision === 'approved' ? 'Approve this video' : 'Request changes'}
              </h2>
              <button aria-label="Close" onClick={() => setReviewing(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">{reviewing.video.title}</p>
            <textarea className="input py-2 text-xs min-h-[90px]" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={reviewing.decision === 'approved' ? 'Optional note for the team…' : 'What should we change? (required)'} />
            <button className="btn-primary w-full justify-center text-xs py-2.5 mt-3" disabled={saving} onClick={() => void submitReview()}>
              {saving ? 'Saving…' : reviewing.decision === 'approved' ? 'Approve' : 'Send to the team'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
