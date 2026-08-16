import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Film, CheckCircle, XCircle, MessageSquare,
  Download, Send, Lock, Play, FileText, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { videoService } from '../../services/videoService'
import { notificationService } from '../../services/notificationService'
import { statusColors, priorityColors, platformLabels, timeAgo, getInitials } from '../../lib/utils'
import type { Video, Comment } from '../../types'

const pipeline = [
  'idea', 'script', 'shooting', 'editing', 'internal_review',
  'client_review', 'revision', 'approved', 'scheduled', 'posted',
]

const pipelineLabels: Record<string, string> = {
  idea: 'Idea', script: 'Script', shooting: 'Shooting', editing: 'Editing',
  internal_review: 'Internal', client_review: 'Client Review',
  revision: 'Revision', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted',
}

export default function VideoDetail() {
  const { id } = useParams()
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [acting, setActing] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'script' | 'delivery'>('comments')

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [v, cs] = await Promise.all([
          videoService.getById(id),
          videoService.getComments(id),
        ])
        if (cancelled) return
        setVideo(v ?? null)
        setComments(cs)
      } catch (err) {
        if (cancelled) return
        console.error('[VideoDetail] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load this video.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, reloadKey])

  const handleAddComment = async () => {
    const raw = newComment.trim()
    if (!raw || !video || !user || posting) return

    // Optional leading timestamp like "0:12 fix the color here"
    let timestamp: number | undefined
    let text = raw
    const m = /^(\d{1,3}):([0-5]\d)\s+(.+)$/s.exec(raw)
    if (m) {
      timestamp = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
      text = m[3]
    }

    setPosting(true)
    try {
      const created = await videoService.addComment({
        agencyId: video.agencyId || agencyId,
        videoId: video.id,
        userId: user.id,
        text,
        timestamp,
      })
      setComments((prev) => [...prev, created])
      setNewComment('')
    } catch (err) {
      console.error('[VideoDetail] add comment failed', err)
    } finally {
      setPosting(false)
    }
  }

  const handleDecision = async (decision: 'approve' | 'revision') => {
    if (!video || acting) return
    setActing(true)
    try {
      const patch: Partial<Video> =
        decision === 'approve'
          ? { status: 'approved', approvalStatus: 'approved' }
          : { status: 'revision', approvalStatus: 'rejected', revisionCount: video.revisionCount + 1 }

      await videoService.update(video.id, patch)
      setVideo({ ...video, ...patch })

      // Notify the assigned editor about the review decision — non-fatal.
      if (video.assignedEditor) {
        try {
          await notificationService.notify({
            agencyId: video.agencyId || agencyId,
            userId: video.assignedEditor,
            type: decision === 'approve' ? 'approval' : 'revision_request',
            title: decision === 'approve' ? 'Video approved' : 'Revision requested',
            message:
              decision === 'approve'
                ? `"${video.title}" was approved.`
                : `A revision was requested on "${video.title}".`,
            link: `/app/pipeline/${video.id}`,
          })
        } catch (notifyErr) {
          console.warn('[VideoDetail] notification failed', notifyErr)
        }
      }
    } catch (err) {
      console.error('[VideoDetail] review action failed', err)
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Link to="/app/pipeline" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Video Pipeline
        </Link>
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <Link to="/app/pipeline" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Video Pipeline
        </Link>
        <PageErrorState
          title="We couldn't load this video"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="p-6 lg:p-8">
        <Link to="/app/pipeline" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Video Pipeline
        </Link>
        <div className="text-center py-20">
          <Film className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-300 text-sm font-semibold mb-1">Video not found</p>
          <p className="text-slate-500 text-xs mb-5">
            This video may have been removed, or the link is incorrect.
          </p>
          <Link to="/app/pipeline" className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to pipeline
          </Link>
        </div>
      </div>
    )
  }

  const currentStageIndex = pipeline.indexOf(video.status)
  const sc = statusColors[video.status]
  const pc = priorityColors[video.priority]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Back */}
      <Link to="/app/pipeline" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Video Pipeline
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Video preview + Comments */}
        <div className="lg:col-span-2 space-y-5">

          {/* Video player placeholder */}
          <div className="glass-blue rounded-2xl overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-20"
                style={{ background: `radial-gradient(circle at 50% 50%, ${video.clientColor}, transparent)` }} />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                style={{ background: 'rgba(59,130,246,0.9)', boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}>
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </motion.button>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{video.title}</p>
                  <p className="text-slate-400 text-xs">{video.clientName} · {video.duration ?? '—'} · {video.aspectRatio}</p>
                </div>
                <span className="badge" style={{ background: sc?.bg, color: sc?.text }}>
                  v{video.version} · {video.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {(video.status === 'client_review' || video.status === 'internal_review') && (
                <>
                  <button
                    className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 disabled:opacity-50"
                    disabled={acting}
                    onClick={() => handleDecision('approve')}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approve Video
                  </button>
                  <button
                    className="btn-secondary text-xs py-2 px-5 flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}
                    disabled={acting}
                    onClick={() => handleDecision('revision')}>
                    <XCircle className="w-3.5 h-3.5" /> Request Revision
                  </button>
                </>
              )}
              {video.finalUrl && (
                <a href={video.finalUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs inline-flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download Final
                </a>
              )}
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                <span>{video.revisionCount} revisions</span>
              </div>
            </div>
          </div>

          {/* Pipeline progress */}
          <div className="glass-blue rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Production Pipeline</h3>
            <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
              {pipeline.map((stage, i) => {
                const isDone = i < currentStageIndex
                const isCurrent = i === currentStageIndex
                const stageColor = statusColors[stage]
                return (
                  <div key={stage} className="flex items-center flex-shrink-0">
                    <div className={`flex flex-col items-center gap-1 px-1.5 py-1 rounded-lg transition-all ${isCurrent ? 'scale-105' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isDone ? 'bg-green-500 text-white' : isCurrent ? '' : 'bg-slate-800 text-slate-600'
                      }`}
                        style={isCurrent ? { background: stageColor?.dot, color: 'white' } : {}}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-[9px] font-medium whitespace-nowrap ${isCurrent ? 'text-white' : isDone ? 'text-green-400' : 'text-slate-600'}`}>
                        {pipelineLabels[stage]}
                      </span>
                    </div>
                    {i < pipeline.length - 1 && (
                      <div className={`w-6 h-px flex-shrink-0 transition-all ${isDone ? 'bg-green-500' : 'bg-slate-800'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabs: Comments / Script / Delivery */}
          <div className="glass-blue rounded-2xl overflow-hidden">
            <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {(['comments', 'script', 'delivery'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-xs font-semibold capitalize transition-all border-b-2 -mb-px ${
                    activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  {tab} {tab === 'comments' && comments.length > 0 && `(${comments.length})`}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'comments' && (
                <div>
                  {/* New comment */}
                  <div className="flex gap-3 mb-5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                      {getInitials(user?.name ?? '?')}
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <input className="input py-2 text-xs flex-1" placeholder="Add a comment… (or type a timestamp like 0:12)"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComment() }} />
                        <button
                          className="btn-primary text-xs py-2 px-4 disabled:opacity-50"
                          disabled={posting || !newComment.trim()}
                          onClick={() => handleAddComment()}>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Comments list */}
                  <div className="space-y-3">
                    {comments.map((c, i) => (
                      <motion.div key={c.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`flex gap-3 p-3.5 rounded-xl ${c.isInternal ? 'border border-dashed border-amber-500/20 bg-amber-500/[0.03]' : 'bg-white/[0.02]'}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: c.userRole === 'client' ? '#3B82F6' : c.userRole === 'video_editor' ? '#06B6D4' : '#8B5CF6' }}>
                          {getInitials(c.userName)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-white">{c.userName}</span>
                            {c.timestamp !== undefined && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-blue-400"
                                style={{ background: 'rgba(59,130,246,0.15)' }}>
                                {`${Math.floor(c.timestamp / 60)}:${String(c.timestamp % 60).padStart(2, '0')}`}
                              </span>
                            )}
                            {c.isInternal && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                                <Lock className="w-2.5 h-2.5" /> Internal
                              </span>
                            )}
                            <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(c.createdAt)}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                          {c.status === 'resolved' && (
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-green-400">✓ Resolved</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {comments.length === 0 && (
                      <div className="text-center py-8">
                        <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No comments yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'script' && (
                <div className="space-y-4">
                  {video.hook && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-1.5">Hook</div>
                      <p className="text-sm text-white leading-relaxed">{video.hook}</p>
                    </div>
                  )}
                  {video.script && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1.5">Script</div>
                      <p className="text-sm text-slate-300 leading-relaxed">{video.script}</p>
                    </div>
                  )}
                  {video.cta && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <div className="text-[10px] font-bold text-green-400 uppercase tracking-wide mb-1.5">CTA</div>
                      <p className="text-sm text-white leading-relaxed">{video.cta}</p>
                    </div>
                  )}
                  {!video.script && !video.hook && (
                    <div className="text-center py-8">
                      <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 mb-3">No script yet.</p>
                      <button className="btn-primary text-xs py-2 px-4">
                        <Sparkles className="w-3.5 h-3.5" /> Generate with AI
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'delivery' && (
                <div className="space-y-4">
                  {video.caption && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Caption</div>
                      <div className="p-4 rounded-xl text-sm text-slate-300 leading-relaxed"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {video.caption}
                      </div>
                    </div>
                  )}
                  {video.hashtags && video.hashtags.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Hashtags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {video.hashtags.map((h) => (
                          <span key={h} className="px-2 py-1 rounded-lg text-[11px] text-blue-400"
                            style={{ background: 'rgba(59,130,246,0.12)' }}>{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {video.scheduledDate && (
                    <div className="p-4 rounded-xl flex items-center gap-3"
                      style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">📅</div>
                      <div>
                        <p className="text-xs font-semibold text-white">Scheduled for {video.scheduledDate}</p>
                        <p className="text-[10px] text-slate-400">{platformLabels[video.platform]}</p>
                      </div>
                    </div>
                  )}
                  {!video.caption && !video.scheduledDate && (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-500 mb-3">No delivery info yet.</p>
                      <button className="btn-primary text-xs py-2 px-4">
                        <Sparkles className="w-3.5 h-3.5" /> Generate Caption
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Video info */}
        <div className="space-y-4">
          <div className="glass-blue rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Video Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Client', value: video.clientName },
                { label: 'Platform', value: platformLabels[video.platform] },
                { label: 'Format', value: video.format },
                { label: 'Aspect Ratio', value: video.aspectRatio ?? '—' },
                { label: 'Duration', value: video.duration ?? '—' },
                { label: 'Due Date', value: video.dueDate || '—' },
                { label: 'Version', value: `v${video.version}` },
                { label: 'Revisions', value: String(video.revisionCount) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{label}</span>
                  <span className="text-[11px] font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-blue rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Team</h3>
            <div className="space-y-3">
              {video.assignedEditorName ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: '#06B6D4' }}>
                    {getInitials(video.assignedEditorName)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{video.assignedEditorName}</p>
                    <p className="text-[10px] text-slate-500">Video Editor</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">No editor assigned yet.</p>
              )}
            </div>
          </div>

          {/* Priority + Status */}
          <div className="glass-blue rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-slate-500">Priority</span>
              <span className="badge" style={{ background: pc.bg, color: pc.text }}>{video.priority}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Status</span>
              <span className="badge" style={{ background: sc?.bg, color: sc?.text }}>
                {video.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {video.notes && (
            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Notes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{video.notes}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
