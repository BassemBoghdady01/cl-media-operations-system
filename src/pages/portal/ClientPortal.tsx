import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, CheckCircle, Clock, MessageSquare, Download, Play,
  Eye, Star, RotateCcw, Send, ChevronRight, Zap,
  FileText, Image, Music, Package, Check, X, AlertCircle,
} from 'lucide-react'
import { mockClients, mockVideos, mockPackages, mockInvoices } from '../../data/mockData'
import { formatCurrency, formatDate, timeAgo } from '../../lib/utils'

const portalClient = mockClients[0]
const clientVideos = mockVideos.filter((v) => v.clientId === portalClient.id)
const clientPackage = mockPackages.find((p) => p.clientId === portalClient.id)
const clientInvoices = mockInvoices.filter((i) => i.clientId === portalClient.id)

const VIDEO_TABS = ['In Review', 'Approved', 'In Progress', 'Posted']

const STATUS_MAP: Record<string, string[]> = {
  'In Review': ['client_review'],
  'Approved': ['approved', 'scheduled'],
  'In Progress': ['idea', 'script', 'shooting', 'editing', 'internal_review'],
  'Posted': ['posted'],
}

const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea', script: 'Scripting', shooting: 'Shooting',
  editing: 'Editing', internal_review: 'Internal Review',
  client_review: 'Awaiting Your Review', revision: 'In Revision',
  approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted',
}

function VideoReviewCard({ video, onApprove, onRevise }: {
  video: typeof mockVideos[0]
  onApprove: () => void
  onRevise: () => void
}) {
  const [comment, setComment] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const isForReview = video.status === 'client_review'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-blue rounded-2xl overflow-hidden"
      style={{ border: isForReview ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>

      {isForReview && (
        <div className="flex items-center gap-2 px-5 py-2.5"
          style={{ background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
          <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-blue-300 font-medium">Awaiting your review & approval</span>
        </div>
      )}

      <div className="p-5">
        {/* Video player placeholder */}
        <div className="relative w-full rounded-xl overflow-hidden mb-4 cursor-pointer group"
          style={{ background: 'rgba(0,0,0,0.5)', aspectRatio: '16/9' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: 'rgba(59,130,246,0.2)', border: '2px solid rgba(59,130,246,0.4)' }}>
              <Play className="w-6 h-6 text-blue-400" fill="#60A5FA" />
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="text-[10px] text-white/60">{video.duration ?? '0:30'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md text-white/80"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              v{video.version}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-bold text-white mb-1">{video.title}</h3>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[10px] px-2 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
            {video.platform}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
            {video.format}
          </span>
          {video.revisionCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#FBBF24' }}>
              {video.revisionCount} revision{video.revisionCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {video.hook && (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Hook</p>
            <p className="text-xs text-slate-300 italic">"{video.hook}"</p>
          </div>
        )}

        {isForReview && (
          <>
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe what needs to be changed..."
                    className="input w-full text-xs resize-none"
                    rows={3}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowFeedback(!showFeedback) }}
                className="btn-secondary flex-1 text-xs py-2.5"
                style={showFeedback ? { background: 'rgba(245,158,11,0.15)', color: '#FBBF24', borderColor: 'rgba(245,158,11,0.3)' } : {}}>
                <RotateCcw className="w-3.5 h-3.5" />
                {showFeedback ? 'Cancel' : 'Request Changes'}
              </button>
              <button onClick={onApprove}
                className="btn-primary flex-1 text-xs py-2.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Approve ✓
              </button>
            </div>
            {showFeedback && comment && (
              <button onClick={onRevise}
                className="w-full mt-2 text-xs py-2.5 rounded-xl font-semibold transition-all"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Send className="w-3.5 h-3.5 inline mr-1.5" />
                Send Revision Request
              </button>
            )}
          </>
        )}

        {video.status === 'approved' && (
          <div className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)' }}>
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-300 font-medium">You approved this video</span>
          </div>
        )}

        {video.status === 'posted' && video.finalUrl && (
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Eye className="w-3.5 h-3.5" /> View Live Post
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState('In Review')
  const [section, setSection] = useState<'videos' | 'package' | 'invoices'>('videos')

  const filteredVideos = clientVideos.filter((v) =>
    STATUS_MAP[activeTab]?.includes(v.status)
  )

  const packagePct = clientPackage
    ? Math.round((clientPackage.consumedVideos / clientPackage.includedVideos) * 100)
    : 0

  const pendingReviews = clientVideos.filter((v) => v.status === 'client_review').length

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #04081A 0%, #07102B 50%, #04081A 100%)' }}>

      {/* Portal Header */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-white whitespace-nowrap">EZ Marketing Agency</div>
                <div className="text-[10px] text-slate-600">Client Portal</div>
              </div>
            </div>
            <div className="h-5 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: portalClient.color }}>
                NB
              </div>
              <span className="text-sm font-semibold text-white">{portalClient.brandName}</span>
            </div>
          </div>
          {pendingReviews > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-300 font-medium">{pendingReviews} video{pendingReviews > 1 ? 's' : ''} awaiting review</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8">
          <h1 className="text-2xl font-black text-white mb-1">Welcome back, {portalClient.contactName} 👋</h1>
          <p className="text-slate-400 text-sm">Here's everything happening with your content this month.</p>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Videos This Month', value: clientVideos.length, icon: Film, color: '#3B82F6' },
            { label: 'Awaiting Review', value: pendingReviews, icon: Eye, color: '#F59E0B' },
            { label: 'Approved', value: clientVideos.filter((v) => ['approved','scheduled','posted'].includes(v.status)).length, icon: CheckCircle, color: '#10B981' },
            { label: 'Videos Remaining', value: clientPackage ? clientPackage.includedVideos - clientPackage.consumedVideos : 0, icon: Package, color: '#8B5CF6' },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-blue rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <div className="text-xl font-black text-white">{value}</div>
                <div className="text-[10px] text-slate-500">{label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Section nav */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'videos', label: 'My Videos' },
            { key: 'package', label: 'My Package' },
            { key: 'invoices', label: 'Invoices' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setSection(key)}
              className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: section === key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: section === key ? '#60A5FA' : '#64748B',
                border: `1px solid ${section === key ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {label}
              {key === 'videos' && pendingReviews > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                  {pendingReviews}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Videos Section */}
          {section === 'videos' && (
            <motion.div
              key="videos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}>

              {/* Video filter tabs */}
              <div className="flex flex-wrap gap-2 mb-5">
                {VIDEO_TABS.map((tab) => {
                  const count = clientVideos.filter((v) => STATUS_MAP[tab]?.includes(v.status)).length
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className="px-4 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: activeTab === tab ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                        color: activeTab === tab ? '#60A5FA' : '#64748B',
                        border: `1px solid ${activeTab === tab ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      {tab}
                      {count > 0 && (
                        <span className="ml-1.5 text-[9px]">({count})</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {filteredVideos.length === 0 ? (
                <div className="glass-blue rounded-2xl flex flex-col items-center justify-center py-20">
                  <Film className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No videos in this category</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredVideos.map((video) => (
                    <VideoReviewCard
                      key={video.id}
                      video={video}
                      onApprove={() => {}}
                      onRevise={() => {}}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Package Section */}
          {section === 'package' && clientPackage && (
            <motion.div
              key="package"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid md:grid-cols-2 gap-6">

              <div className="glass-blue rounded-2xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-black text-white">{clientPackage.name}</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{formatCurrency(clientPackage.monthlyPrice)}/month</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>
                    Active
                  </span>
                </div>

                {[
                  { label: 'Videos', consumed: clientPackage.consumedVideos, total: clientPackage.includedVideos, color: '#3B82F6' },
                  { label: 'Revisions', consumed: clientPackage.consumedRevisions, total: clientPackage.includedRevisions, color: '#8B5CF6' },
                  { label: 'Shooting Days', consumed: clientPackage.consumedShootingDays, total: clientPackage.includedShootingDays, color: '#10B981' },
                ].map(({ label, consumed, total, color }) => {
                  const pct = Math.round((consumed / total) * 100)
                  return (
                    <div key={label} className="mb-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-bold" style={{ color: pct >= 85 ? '#F87171' : 'white' }}>
                          {consumed}/{total}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full rounded-full"
                          style={{ background: pct >= 85 ? '#EF4444' : color }}
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Renewal Date</span>
                    <span className="text-white font-medium">{formatDate(clientPackage.renewalDate)}</span>
                  </div>
                </div>
              </div>

              <div className="glass-blue rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4">Platforms Included</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {clientPackage.platforms.map((p) => (
                    <span key={p} className="px-3 py-1.5 rounded-xl text-xs font-medium capitalize"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}>
                      {p}
                    </span>
                  ))}
                </div>
                <h3 className="text-sm font-bold text-white mb-4">Add-ons</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Extra Video</span>
                    <span className="text-white">{formatCurrency(clientPackage.extraVideoPrice)}/video</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Extra Revision</span>
                    <span className="text-white">{formatCurrency(clientPackage.extraRevisionPrice)}/revision</span>
                  </div>
                </div>
                {clientPackage.notes && (
                  <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-xs text-slate-400">{clientPackage.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Invoices Section */}
          {section === 'invoices' && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-blue rounded-2xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex-1">Invoice</span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-24 text-right">Amount</span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-20">Status</span>
                <span className="w-8" />
              </div>
              {clientInvoices.map((inv, i) => {
                const statusStyle = {
                  paid: { bg: 'rgba(16,185,129,0.12)', color: '#34D399', label: 'Paid' },
                  sent: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA', label: 'Due' },
                  overdue: { bg: 'rgba(239,68,68,0.12)', color: '#F87171', label: 'Overdue' },
                  draft: { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', label: 'Draft' },
                  cancelled: { bg: 'rgba(71,85,105,0.12)', color: '#64748B', label: 'Cancelled' },
                }[inv.status] ?? { bg: '', color: '#94A3B8', label: inv.status }

                return (
                  <motion.div key={inv.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: i < clientInvoices.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{inv.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-sm font-black text-white">{formatCurrency(inv.total)}</p>
                    </div>
                    <div className="w-20">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {statusStyle.label}
                      </span>
                    </div>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/[0.08] transition-all">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
