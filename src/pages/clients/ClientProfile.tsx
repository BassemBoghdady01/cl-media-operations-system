import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Film, Package, CreditCard, FolderOpen, MessageSquare,
  CheckCircle, Clock, ExternalLink, Mail, Phone, Globe, Plus, Edit,
} from 'lucide-react'
import { mockClients, mockVideos, mockPackages, mockInvoices, mockAssets } from '../../data/mockData'
import { statusColors, formatCurrency, formatDate, getInitials } from '../../lib/utils'

const tabs = ['Overview', 'Videos', 'Package', 'Invoices', 'Assets', 'Notes']

export default function ClientProfile() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('Overview')

  const client = mockClients.find((c) => c.id === id) ?? mockClients[0]
  const pkg = mockPackages.find((p) => p.clientId === client.id)
  const videos = mockVideos.filter((v) => v.clientId === client.id)
  const invoices = mockInvoices.filter((i) => i.clientId === client.id)
  const assets = mockAssets.filter((a) => a.clientId === client.id)

  const pct = pkg ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100) : 0
  const progressColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Back */}
      <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> All Clients
      </Link>

      {/* Client header */}
      <div className="glass-blue rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${client.color}, ${client.color}88)` }}>
              {getInitials(client.brandName)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-black text-white">{client.brandName}</h1>
                <span className="badge" style={{ background: statusColors[client.status]?.bg, color: statusColors[client.status]?.text }}>
                  {client.status}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{client.industry} · {client.name}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{client.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{client.phone}</span>
                {client.socialLinks?.instagram && (
                  <span className="flex items-center gap-1.5 text-pink-400">
                    <Globe className="w-3 h-3" />{client.socialLinks.instagram}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary text-xs py-2 px-4">
              <ExternalLink className="w-3.5 h-3.5" /> Client Portal
            </button>
            <button className="btn-primary text-xs py-2 px-4">
              <Plus className="w-3.5 h-3.5" /> New Video
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-center">
            <div className="text-xl font-black text-white">{videos.length}</div>
            <div className="text-[11px] text-slate-500">Total Videos</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-white">{videos.filter((v) => v.status === 'posted').length}</div>
            <div className="text-[11px] text-slate-500">Posted</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-white">{pkg ? formatCurrency(pkg.monthlyPrice) : '—'}</div>
            <div className="text-[11px] text-slate-500">Monthly Package</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: progressColor }}>
              {pkg ? `${pkg.includedVideos - pkg.consumedVideos}` : '—'}
            </div>
            <div className="text-[11px] text-slate-500">Videos Remaining</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto no-scrollbar"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map((tab) => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Recent videos */}
            <div className="glass-blue rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Recent Videos</h3>
                <button onClick={() => setActiveTab('Videos')} className="text-xs text-blue-400">See all</button>
              </div>
              <div className="space-y-2">
                {videos.slice(0, 4).map((v) => {
                  const sc = statusColors[v.status]
                  return (
                    <Link key={v.id} to={`/app/pipeline/${v.id}`}
                      className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc?.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{v.title}</p>
                        <p className="text-[10px] text-slate-500">{v.platform} · {v.format} · Due {v.dueDate}</p>
                      </div>
                      <span className="badge text-[10px]" style={{ background: sc?.bg, color: sc?.text }}>
                        {v.status.replace('_', ' ')}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Package usage */}
            {pkg && (
              <div className="glass-blue rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">Package Usage — {pkg.name}</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Videos', used: pkg.consumedVideos, total: pkg.includedVideos },
                    { label: 'Revisions', used: pkg.consumedRevisions, total: pkg.includedRevisions },
                    { label: 'Shoot Days', used: pkg.consumedShootingDays, total: pkg.includedShootingDays },
                  ].map(({ label, used, total }) => {
                    const p = Math.round((used / total) * 100)
                    const col = p >= 90 ? '#EF4444' : p >= 70 ? '#F59E0B' : '#10B981'
                    return (
                      <div key={label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-base font-black" style={{ color: col }}>{used}/{total}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${p}%`, background: col }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Renews {formatDate(pkg.renewalDate)}</span>
                  <span>{formatCurrency(pkg.monthlyPrice)}/month</span>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Account Manager</h3>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>BM</div>
                <div>
                  <p className="text-sm font-semibold text-white">Bassem Mahmoud</p>
                  <p className="text-[11px] text-slate-500">bassem@ezmarketing.com</p>
                </div>
              </div>
            </div>

            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Client Portal</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${client.portalAccess ? 'bg-green-500' : 'bg-slate-600'}`} />
                <span className="text-xs text-slate-300">{client.portalAccess ? 'Portal Active' : 'Portal Disabled'}</span>
              </div>
              {client.portalAccess ? (
                <button className="btn-secondary text-xs py-2 w-full justify-center">
                  <ExternalLink className="w-3 h-3" /> Open Portal
                </button>
              ) : (
                <button className="btn-primary text-xs py-2 w-full justify-center">Enable Portal</button>
              )}
            </div>

            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Internal Notes</h3>
              <p className="text-xs text-slate-500 italic leading-relaxed">
                Client prefers quick responses via WhatsApp. Has 2 upcoming campaigns in Q3. Strong potential for upsell to 20-video package.
              </p>
              <p className="text-[10px] text-slate-600 mt-2">🔒 Visible to team only</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Videos' && (
        <div className="space-y-2">
          {videos.map((v) => {
            const sc = statusColors[v.status]
            return (
              <Link key={v.id} to={`/app/pipeline/${v.id}`}
                className="flex items-center gap-4 glass-blue rounded-xl px-4 py-3.5 hover:border-blue-500/30 transition-all">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${sc?.dot}20` }}>
                  <Film className="w-4 h-4" style={{ color: sc?.dot }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{v.title}</p>
                  <p className="text-xs text-slate-500">{v.platform} · {v.format} · v{v.version} · Due {v.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  {v.revisionCount > 0 && (
                    <span className="text-[10px] text-amber-400">{v.revisionCount} revisions</span>
                  )}
                  <span className="badge" style={{ background: sc?.bg, color: sc?.text }}>
                    {v.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {activeTab === 'Invoices' && (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const sc = statusColors[inv.status]
            return (
              <div key={inv.id} className="flex items-center gap-4 glass-blue rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-white">{inv.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                </div>
                <div className="flex-1" />
                <span className="text-sm font-black text-white">{formatCurrency(inv.total)}</span>
                <span className="badge" style={{ background: sc?.bg, color: sc?.text }}>{inv.status}</span>
              </div>
            )
          })}
          {invoices.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">No invoices yet.</p>
          )}
        </div>
      )}

      {activeTab === 'Assets' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="glass-blue rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg"
                style={{ background: 'rgba(59,130,246,0.1)' }}>
                {a.type === 'logo' ? '🎨' : a.type === 'video' ? '🎬' : a.type === 'music' ? '🎵' : a.type === 'document' ? '📄' : '📁'}
              </div>
              <p className="text-xs font-semibold text-white truncate mb-0.5">{a.name}</p>
              <p className="text-[10px] text-slate-500">{a.folder} · {a.format} · {a.size}</p>
              {a.isApproved && <span className="text-[10px] text-green-400 mt-1 block">✓ Approved</span>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Notes' && (
        <div className="glass-blue rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
              <span className="text-[10px]">🔒</span>
            </div>
            <span className="text-xs text-amber-400 font-medium">Internal notes — not visible to client</span>
          </div>
          <textarea
            className="input resize-none h-40 text-sm leading-relaxed"
            defaultValue="Client prefers quick responses via WhatsApp. Has 2 upcoming campaigns in Q3. Strong potential for upsell to 20-video package. Contact person Farida is very responsive, usually replies within 1 hour."
          />
          <button className="btn-primary text-xs py-2 mt-3">Save Notes</button>
        </div>
      )}
    </motion.div>
  )
}
