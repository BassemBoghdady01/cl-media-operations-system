import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Film, ExternalLink, Mail, Phone, Globe, Plus, Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { clientService } from '../../services/clientService'
import { videoService } from '../../services/videoService'
import { packageService } from '../../services/packageService'
import { invoiceService } from '../../services/invoiceService'
import { assetService } from '../../services/assetService'
import { userService, type ManagedUser } from '../../services/userService'
import { statusColors, formatCurrency, formatDate, getInitials } from '../../lib/utils'
import type { Client, Video, Package, Invoice, Asset } from '../../types'

const tabs = ['Overview', 'Videos', 'Package', 'Invoices', 'Assets', 'Notes']

export default function ClientProfile() {
  const { id } = useParams()
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [activeTab, setActiveTab] = useState('Overview')

  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [pkg, setPkg] = useState<Package | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [manager, setManager] = useState<ManagedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const [clientData, videoData, pkgData, invoiceData, assetData] = await Promise.all([
          clientService.getById(id),
          videoService.getByClient(id),
          packageService.getByClient(id),
          invoiceService.getByClient(id),
          assetService.getByClient(id),
        ])
        if (cancelled) return

        if (!clientData) {
          setClient(null)
          setNotFound(true)
          return
        }

        setClient(clientData)
        setVideos(videoData)
        setPkg(pkgData ?? null)
        setInvoices(invoiceData)
        setAssets(assetData)

        // Account manager lookup is best-effort — the profile still renders without it.
        if (clientData.accountManagerId) {
          try {
            const mgr = await userService.getUser(clientData.accountManagerId)
            if (!cancelled) setManager(mgr ?? null)
          } catch (mgrErr) {
            console.error('[ClientProfile] account manager load failed', mgrErr)
            if (!cancelled) setManager(null)
          }
        } else {
          setManager(null)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[ClientProfile] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load this client.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, agencyId, reloadKey])

  // "Enable Portal" — optimistic update, reverted if the write fails.
  const setPortalAccess = async (enabled: boolean) => {
    if (!client) return
    const previous = client
    setClient({ ...client, portalAccess: enabled })
    try {
      await clientService.update(client.id, { portalAccess: enabled })
    } catch (err) {
      console.error('[ClientProfile] portal toggle failed', err)
      setClient(previous)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All Clients
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
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All Clients
        </Link>
        <PageErrorState
          title="We couldn't load this client"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div className="p-6 lg:p-8">
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All Clients
        </Link>
        <div className="flex flex-col items-center justify-center text-center py-20">
          <Users className="w-12 h-12 text-slate-700 mb-4" />
          <h2 className="text-lg font-black text-white mb-2">Client not found</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            This client doesn't exist or may have been removed.
          </p>
          <Link to="/app/clients" className="btn-primary text-sm py-2.5 px-5">
            <ArrowLeft className="w-4 h-4" /> Back to Clients
          </Link>
        </div>
      </div>
    )
  }

  const pct = pkg && pkg.includedVideos > 0
    ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100)
    : 0
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
              <p className="text-slate-400 text-sm">{[client.industry, client.name].filter(Boolean).join(' · ')}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                {client.email && (
                  <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{client.email}</span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{client.phone}</span>
                )}
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
                {videos.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">No videos yet for this client.</p>
                )}
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
                    const p = total > 0 ? Math.round((used / total) * 100) : 0
                    const col = p >= 90 ? '#EF4444' : p >= 70 ? '#F59E0B' : '#10B981'
                    return (
                      <div key={label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-base font-black" style={{ color: col }}>{used}/{total}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: col }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Renews {pkg.renewalDate ? formatDate(pkg.renewalDate) : '—'}</span>
                  <span>{formatCurrency(pkg.monthlyPrice)}/month</span>
                </div>
              </div>
            )}
            {!pkg && (
              <div className="glass-blue rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-2">Package Usage</h3>
                <p className="text-xs text-slate-500">No active package for this client.</p>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Account Manager</h3>
              {manager ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${manager.color}, ${manager.color}88)` }}>
                    {getInitials(manager.full_name || manager.email)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{manager.full_name || manager.email}</p>
                    <p className="text-[11px] text-slate-500">{manager.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No account manager assigned.</p>
              )}
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
                <button className="btn-primary text-xs py-2 w-full justify-center"
                  onClick={() => void setPortalAccess(true)}>
                  Enable Portal
                </button>
              )}
            </div>

            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Internal Notes</h3>
              <p className="text-xs text-slate-500 italic leading-relaxed">No internal notes yet.</p>
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
          {videos.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">No videos yet for this client.</p>
          )}
        </div>
      )}

      {activeTab === 'Package' && (
        <div className="max-w-2xl">
          {pkg ? (
            <div className="glass-blue rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-white">{pkg.name}</h3>
                <span className="badge" style={{ background: statusColors[pkg.status]?.bg, color: statusColors[pkg.status]?.text }}>
                  {pkg.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Videos', used: pkg.consumedVideos, total: pkg.includedVideos },
                  { label: 'Revisions', used: pkg.consumedRevisions, total: pkg.includedRevisions },
                  { label: 'Shoot Days', used: pkg.consumedShootingDays, total: pkg.includedShootingDays },
                ].map(({ label, used, total }) => {
                  const p = total > 0 ? Math.round((used / total) * 100) : 0
                  const col = p >= 90 ? '#EF4444' : p >= 70 ? '#F59E0B' : '#10B981'
                  return (
                    <div key={label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-base font-black" style={{ color: col }}>{used}/{total}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Renews {pkg.renewalDate ? formatDate(pkg.renewalDate) : '—'}</span>
                <span>{formatCurrency(pkg.monthlyPrice)}/month</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">No active package for this client.</p>
          )}
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {assets.map((a) => (
              <div key={a.id} className="glass-blue rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>
                  {a.type === 'logo' ? '🎨' : a.type === 'video' ? '🎬' : a.type === 'music' ? '🎵' : a.type === 'document' ? '📄' : '📁'}
                </div>
                <p className="text-xs font-semibold text-white truncate mb-0.5">{a.name}</p>
                <p className="text-[10px] text-slate-500">{[a.folder, a.format, a.size].filter(Boolean).join(' · ')}</p>
                {a.isApproved && <span className="text-[10px] text-green-400 mt-1 block">✓ Approved</span>}
              </div>
            ))}
          </div>
          {assets.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">No assets uploaded for this client yet.</p>
          )}
        </>
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
            placeholder="Add internal notes about this client…"
            disabled
          />
          <button className="btn-primary text-xs py-2 mt-3 opacity-50 cursor-not-allowed" disabled
            title="Notes storage is not available yet">
            Save Notes
          </button>
        </div>
      )}
    </motion.div>
  )
}
