import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Film, Mail, Phone, Globe, Plus, Users, Pencil, Archive,
  FolderKanban, CheckSquare, Camera, RefreshCw, CreditCard, Wallet,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { clientService } from '../../services/clientService'
import { videoService } from '../../services/videoService'
import { packageService } from '../../services/packageService'
import { invoiceService } from '../../services/invoiceService'
import { assetService } from '../../services/assetService'
import { projectService } from '../../services/projectService'
import { taskService } from '../../services/taskService'
import { bookingService } from '../../services/bookingService'
import { subscriptionService, type ClientSubscription } from '../../services/subscriptionService'
import { financeService, type FinanceTransaction } from '../../services/financeService'
import { userService, type ManagedUser } from '../../services/userService'
import { statusColors, formatCurrency, formatDate, getInitials } from '../../lib/utils'
import { formatMoney, formatDateShort } from '../../lib/finance'
import { toastSuccess, toastError } from '../../lib/toast'
import { ClientFormModal } from './ClientsPage'
import type { Client, Video, Package, Invoice, Asset, Project, Task, Booking } from '../../types'

const tabs = ['Overview', 'Videos', 'Projects', 'Billing', 'Package', 'Invoices', 'Assets', 'Notes']

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [activeTab, setActiveTab] = useState('Overview')

  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [pkg, setPkg] = useState<Package | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [subs, setSubs] = useState<ClientSubscription[]>([])
  const [payments, setPayments] = useState<FinanceTransaction[]>([])
  const [manager, setManager] = useState<ManagedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [showEdit, setShowEdit] = useState(false)
  const [modal, setModal] = useState<null | 'project' | 'task' | 'invoice' | 'package'>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const canBilling = hasPermission('subscriptions.view')
  const canPayments = hasPermission('finance.view') && hasPermission('finance.view_revenue')

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
        setNotesDraft(clientData.notes ?? '')

        // Secondary data — permission-dependent, must never blank the page.
        const [proj, tsk, bkg, sub, pay] = await Promise.allSettled([
          projectService.getByClient(id),
          taskService.getAll(agencyId),
          bookingService.getByClient(id),
          canBilling ? subscriptionService.list(agencyId, { clientId: id }) : Promise.resolve([]),
          canPayments
            ? financeService.listTransactions(agencyId, { clientId: id, type: 'income', limit: 50 })
            : Promise.resolve({ rows: [], total: 0 }),
        ])
        if (cancelled) return
        if (proj.status === 'fulfilled') setProjects(proj.value)
        if (tsk.status === 'fulfilled') setTasks(tsk.value.filter((t) => t.clientId === id))
        if (bkg.status === 'fulfilled') setBookings(bkg.value)
        if (sub.status === 'fulfilled') setSubs(sub.value)
        if (pay.status === 'fulfilled') setPayments(pay.value.rows)

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
      toastSuccess(enabled ? 'Client portal enabled.' : 'Client portal disabled.')
    } catch (err) {
      setClient(previous)
      toastError(err instanceof Error ? err.message : 'Could not update portal access.')
    }
  }

  const setClientStatus = async (status: Client['status']) => {
    if (!client) return
    const label = status === 'inactive' ? 'archive' : 'reactivate'
    if (status === 'inactive' &&
        !window.confirm(`Archive ${client.brandName}? They keep their history and can be reactivated any time.`)) {
      return
    }
    const previous = client
    setClient({ ...client, status })
    try {
      await clientService.update(client.id, { status })
      toastSuccess(status === 'inactive' ? 'Client archived.' : 'Client reactivated.')
    } catch (err) {
      setClient(previous)
      toastError(err instanceof Error ? err.message : `Could not ${label} this client.`)
    }
  }

  const saveNotes = async () => {
    if (!client) return
    setSavingNotes(true)
    try {
      await clientService.update(client.id, { notes: notesDraft })
      setClient({ ...client, notes: notesDraft })
      toastSuccess('Notes saved.')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not save notes.')
    } finally {
      setSavingNotes(false)
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

          <div className="flex flex-wrap gap-2">
            {hasPermission('clients.edit') && (
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setShowEdit(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {hasPermission('clients.edit') && (
              client.status !== 'inactive' ? (
                <button className="btn-secondary text-xs py-2 px-4" onClick={() => void setClientStatus('inactive')}>
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              ) : (
                <button className="btn-secondary text-xs py-2 px-4" onClick={() => void setClientStatus('active')}>
                  <RefreshCw className="w-3.5 h-3.5" /> Reactivate
                </button>
              )
            )}
            {hasPermission('videos.manage') && (
              <button className="btn-primary text-xs py-2 px-4" onClick={() => navigate('/app/pipeline')}>
                <Plus className="w-3.5 h-3.5" /> New Video
              </button>
            )}
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
                <>
                  <p className="text-[10px] text-slate-600 mb-2">
                    The client signs in at /login with a portal account linked to this record
                    (create one in User Management with the Client role).
                  </p>
                  <button className="btn-secondary text-xs py-2 w-full justify-center"
                    onClick={() => void setPortalAccess(false)}>
                    Disable Portal
                  </button>
                </>
              ) : (
                <button className="btn-primary text-xs py-2 w-full justify-center"
                  onClick={() => void setPortalAccess(true)}>
                  Enable Portal
                </button>
              )}
            </div>

            {/* Quick actions — every one performs a real operation */}
            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-1.5">
                {hasPermission('projects.create') && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2" onClick={() => setModal('project')}>
                    <FolderKanban className="w-3.5 h-3.5" /> Add project
                  </button>
                )}
                {hasPermission('tasks.manage') && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2" onClick={() => setModal('task')}>
                    <CheckSquare className="w-3.5 h-3.5" /> Add task
                  </button>
                )}
                {hasPermission('packages.manage') && !pkg && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2" onClick={() => setModal('package')}>
                    <Wallet className="w-3.5 h-3.5" /> Assign package
                  </button>
                )}
                {hasPermission('invoices.manage') && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2" onClick={() => setModal('invoice')}>
                    <CreditCard className="w-3.5 h-3.5" /> Create invoice
                  </button>
                )}
                {hasPermission('subscriptions.manage') && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2"
                    onClick={() => navigate('/app/finance/subscriptions')}>
                    <RefreshCw className="w-3.5 h-3.5" /> Create subscription →
                  </button>
                )}
                {hasPermission('finance.manage') && (
                  <button className="btn-secondary text-xs py-2 w-full justify-start gap-2"
                    onClick={() => navigate('/app/finance/revenue')}>
                    <Wallet className="w-3.5 h-3.5" /> Record payment →
                  </button>
                )}
              </div>
            </div>

            <div className="glass-blue rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Internal Notes</h3>
              {client.notes ? (
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-5">{client.notes}</p>
              ) : (
                <p className="text-xs text-slate-500 italic leading-relaxed">No internal notes yet.</p>
              )}
              <button className="text-[11px] text-blue-400 hover:text-blue-300 mt-2"
                onClick={() => setActiveTab('Notes')}>
                {client.notes ? 'Edit notes →' : 'Add notes →'}
              </button>
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
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!hasPermission('clients.edit')}
          />
          {hasPermission('clients.edit') ? (
            <button className="btn-primary text-xs py-2 mt-3"
              onClick={() => void saveNotes()}
              disabled={savingNotes || notesDraft === (client.notes ?? '')}>
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          ) : (
            <p className="text-[10px] text-slate-600 mt-2">Editing notes requires the clients.edit permission.</p>
          )}
        </div>
      )}

      {activeTab === 'Projects' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Projects */}
          <div className="glass-blue rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Projects</h3>
              {hasPermission('projects.create') && (
                <button className="btn-secondary text-[11px] py-1.5 px-3" onClick={() => setModal('project')}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-white">{p.name}</p>
                    <span className="badge text-[10px]"
                      style={{ background: statusColors[p.status]?.bg, color: statusColors[p.status]?.text }}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {[p.type, p.dueDate && `due ${formatDateShort(p.dueDate)}`, `${p.progress}%`].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">No projects for this client yet.</p>
              )}
            </div>
          </div>

          {/* Tasks + bookings */}
          <div className="space-y-6">
            <div className="glass-blue rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Open Tasks</h3>
                {hasPermission('tasks.manage') && (
                  <button className="btn-secondary text-[11px] py-1.5 px-3" onClick={() => setModal('task')}>
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {tasks.filter((t) => t.status !== 'done').slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-500">
                        {[t.assignedToName || 'Unassigned', t.dueDate && `due ${formatDateShort(t.dueDate)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold ${t.priority === 'urgent' ? 'text-red-400' : 'text-slate-500'}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
                {tasks.filter((t) => t.status !== 'done').length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No open tasks.</p>
                )}
              </div>
            </div>

            <div className="glass-blue rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Shoots</h3>
                {hasPermission('bookings.manage') && (
                  <Link to="/app/booking" className="text-[11px] text-blue-400 hover:text-blue-300">Book →</Link>
                )}
              </div>
              <div className="space-y-1.5">
                {bookings.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <Camera className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{formatDateShort(b.date)}{b.time ? ` · ${b.time}` : ''}</p>
                      <p className="text-[10px] text-slate-500 truncate">{b.location || b.studio || '—'}</p>
                    </div>
                    <span className="badge text-[10px]"
                      style={{ background: statusColors[b.status]?.bg, color: statusColors[b.status]?.text }}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No shoots booked.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Billing' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-blue rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Subscriptions</h3>
              {hasPermission('subscriptions.manage') && (
                <button className="btn-secondary text-[11px] py-1.5 px-3"
                  onClick={() => navigate('/app/finance/subscriptions')}>
                  Manage →
                </button>
              )}
            </div>
            {!canBilling ? (
              <p className="text-xs text-slate-500">Your role does not include subscription visibility.</p>
            ) : subs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No subscriptions for this client yet.</p>
            ) : (
              <div className="space-y-2">
                {subs.map((s) => (
                  <button key={s.id}
                    onClick={() => navigate(`/app/finance/subscriptions/${s.id}`)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-white">{s.name}</p>
                      <span className="badge text-[10px] capitalize"
                        style={{ background: 'rgba(255,255,255,0.05)', color: s.status === 'active' ? '#10B981' : s.status === 'overdue' ? '#EF4444' : '#94A3B8' }}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatMoney(s.amount, s.currency)} · {s.billing_frequency.replace('_', ' ')} · next {formatDateShort(s.next_billing_date)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass-blue rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Payment History</h3>
              {hasPermission('finance.manage') && (
                <button className="btn-secondary text-[11px] py-1.5 px-3"
                  onClick={() => navigate('/app/finance/revenue')}>
                  Record →
                </button>
              )}
            </div>
            {!canPayments ? (
              <p className="text-xs text-slate-500">Your role does not include revenue visibility.</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No payments recorded for this client yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{p.title}</p>
                      <p className="text-[10px] text-slate-500">{formatDateShort(p.transaction_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-white">{formatMoney(Number(p.amount_paid), p.currency)}</p>
                      <p className="text-[10px]" style={{ color: p.status === 'paid' ? '#10B981' : p.status === 'overdue' ? '#EF4444' : '#94A3B8' }}>
                        {p.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showEdit && (
        <ClientFormModal
          agencyId={agencyId}
          existing={client}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); setReloadKey((k) => k + 1) }}
        />
      )}
      {modal && (
        <QuickCreateModal
          kind={modal}
          agencyId={agencyId}
          client={client}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setReloadKey((k) => k + 1) }}
        />
      )}
    </motion.div>
  )
}

/**
 * Small create forms scoped to this client. Each performs a REAL insert via
 * the corresponding service and reports the outcome — never a silent no-op.
 */
function QuickCreateModal({
  kind, agencyId, client, onClose, onSaved,
}: {
  kind: 'project' | 'task' | 'invoice' | 'package'
  agencyId: string
  client: Client
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Shared fields — each kind uses the subset it needs.
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [priority, setPriority] = useState('medium')
  const [includedVideos, setIncludedVideos] = useState('8')
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Date.now() / 1000) % 1000).padStart(3, '0')}`
  )

  const titles: Record<typeof kind, string> = {
    project: 'Add project',
    task: 'Add task',
    invoice: 'Create invoice',
    package: 'Assign package',
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() && kind !== 'invoice') { setErr('Name is required.'); return }
    setSaving(true)
    setErr(null)
    try {
      if (kind === 'project') {
        await projectService.create(agencyId, {
          clientId: client.id, name: name.trim(), status: 'active',
          dueDate: dueDate || undefined,
        })
        toastSuccess('Project created.')
      } else if (kind === 'task') {
        await taskService.create(agencyId, {
          clientId: client.id, title: name.trim(), status: 'todo',
          priority: priority as 'low' | 'medium' | 'high' | 'urgent',
          dueDate: dueDate || undefined,
        })
        toastSuccess('Task created.')
      } else if (kind === 'invoice') {
        const value = Number(amount)
        if (!Number.isFinite(value) || value <= 0) throw new Error('A valid amount is required.')
        await invoiceService.create(agencyId, {
          clientId: client.id,
          invoiceNumber: invoiceNumber.trim(),
          amount: value, total: value, status: 'sent',
          dueDate: dueDate || undefined,
          notes: name.trim() || undefined,
        })
        toastSuccess('Invoice created.')
      } else {
        const price = Number(amount)
        if (!Number.isFinite(price) || price <= 0) throw new Error('A valid monthly price is required.')
        await packageService.create(agencyId, {
          clientId: client.id, name: name.trim(),
          monthlyPrice: price,
          includedVideos: Number(includedVideos) || 0,
          renewalDate: dueDate || undefined,
          status: 'active',
        })
        toastSuccess('Package assigned.')
      }
      onSaved()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not save.'
      setErr(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-1">{titles[kind]}</h3>
        <p className="text-xs text-slate-500 mb-4">for {client.brandName}</p>

        <form onSubmit={submit} className="space-y-3">
          {kind === 'invoice' ? (
            <>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Invoice number</label>
                <input className="input text-xs py-2" value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Amount</label>
                <input className="input text-xs py-2" type="number" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Description (optional)</label>
                <input className="input text-xs py-2" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="What is this invoice for?" />
              </div>
            </>
          ) : (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                {kind === 'task' ? 'Task title' : kind === 'package' ? 'Package name' : 'Project name'} *
              </label>
              <input className="input text-xs py-2" value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          {kind === 'package' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Monthly price *</label>
                <input className="input text-xs py-2" type="number" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Included videos</label>
                <input className="input text-xs py-2" type="number" min="0" value={includedVideos}
                  onChange={(e) => setIncludedVideos(e.target.value)} />
              </div>
            </div>
          )}

          {kind === 'task' && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Priority</label>
              <select className="input text-xs py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              {kind === 'package' ? 'Renewal date' : 'Due date'} (optional)
            </label>
            <input className="input text-xs py-2" type="date" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {err && (
            <div className="rounded-xl p-2.5 text-[11px] text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {err}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn-secondary text-xs py-2 px-4" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary text-xs py-2 px-4" disabled={saving}>
              {saving ? 'Saving…' : titles[kind]}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
