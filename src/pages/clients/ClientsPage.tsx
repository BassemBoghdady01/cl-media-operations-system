import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, Users, Film, Package as PackageIcon, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { clientService } from '../../services/clientService'
import { packageService } from '../../services/packageService'
import { videoService } from '../../services/videoService'
import { statusColors, getInitials, formatCurrency } from '../../lib/utils'
import { toastSuccess, toastError } from '../../lib/toast'
import type { Client, Package, Video } from '../../types'

const statuses = ['All', 'active', 'paused', 'inactive']
const CLIENT_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316']

export default function ClientsPage() {
  const { user, agency, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const agencyId = user?.agencyId || agency?.id || ''

  const [clients, setClients] = useState<Client[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [industry, setIndustry] = useState('All')
  const [status, setStatus] = useState('All')
  const [showCreate, setShowCreate] = useState(false)

  // Navbar global search lands here as ?q=…
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [clientData, packageData, videoData] = await Promise.all([
          clientService.getAll(agencyId),
          packageService.getAll(agencyId),
          videoService.getAll(agencyId),
        ])
        if (cancelled) return
        setClients(clientData)
        setPackages(packageData)
        setVideos(videoData)
      } catch (err) {
        if (cancelled) return
        console.error('[ClientsPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load clients.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const industries = ['All', ...new Set(clients.map((c) => c.industry).filter(Boolean))]

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.brandName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactName.toLowerCase().includes(search.toLowerCase())
    const matchIndustry = industry === 'All' || c.industry === industry
    const matchStatus = status === 'All' || c.status === status
    return matchSearch && matchIndustry && matchStatus
  })

  const getClientVideos = (id: string) => videos.filter((v) => v.clientId === id).length
  const getClientPackage = (id: string) =>
    packages.find((p) => p.clientId === id && p.status === 'active') ??
    packages.find((p) => p.clientId === id)

  const activeCount = clients.filter((c) => c.status === 'active').length
  const activePackages = packages.filter((p) => p.status === 'active')
  const totalRevenue = activePackages.reduce((s, p) => s + p.monthlyPrice, 0)

  const now = new Date()
  const videosThisMonth = videos.filter((v) => {
    const d = new Date(v.createdAt)
    return !Number.isNaN(d.getTime()) &&
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load your clients"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCount} active · {clients.length} total</p>
        </div>
        {hasPermission('clients.create') && (
          <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Clients', value: activeCount, icon: Users, color: '#3B82F6' },
          { label: 'Total Videos This Month', value: videosThisMonth, icon: Film, color: '#8B5CF6' },
          { label: 'Monthly Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: '#10B981' },
          { label: 'Active Packages', value: activePackages.length, icon: PackageIcon, color: '#F59E0B' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-blue rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
              <div className="text-base font-black text-white">{value}</div>
              <div className="text-[10px] text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input className="input pl-9 py-2.5 text-xs" placeholder="Search clients…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input py-2.5 text-xs w-auto" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {industries.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select className="input py-2.5 text-xs w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && clients.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No clients yet</p>
          <p className="text-slate-600 text-xs mt-1">Clients you add will appear here.</p>
        </div>
      )}

      {/* Client grid */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client, i) => {
            const pkg = getClientPackage(client.id)
            const videoCount = getClientVideos(client.id)
            const pct = pkg && pkg.includedVideos > 0
              ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100)
              : 0
            const sc = statusColors[client.status]
            const needsAttention = !!pkg && pct >= 90

            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate(`/app/clients/${client.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/app/clients/${client.id}`) }}
                role="link"
                tabIndex={0}
                className="glass glass-hover rounded-2xl p-5 cursor-pointer group">
                <div className="block">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${client.color}, ${client.color}88)` }}>
                        {getInitials(client.brandName)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight">{client.brandName}</h3>
                        <p className="text-[11px] text-slate-500">{client.industry || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsAttention && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Package limit approaching" />
                      )}
                      <span className="badge" style={{ background: sc?.bg, color: sc?.text }}>
                        {client.status}
                      </span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="text-[11px] text-slate-500 mb-4">
                    {[client.contactName, client.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-base font-black text-white">{videoCount}</div>
                      <div className="text-[10px] text-slate-500">Videos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-black text-white">{pkg?.includedVideos ?? '—'}</div>
                      <div className="text-[10px] text-slate-500">Package</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-black" style={{ color: pkg ? (pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981') : '#64748B' }}>
                        {pkg ? `${pkg.includedVideos - pkg.consumedVideos}` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">Remaining</div>
                    </div>
                  </div>

                  {/* Package bar */}
                  {pkg && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>{pkg.name}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : client.color }} />
                      </div>
                    </div>
                  )}

                  {/* Portal badge */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: client.portalAccess ? '#10B981' : '#64748B' }}>
                      {client.portalAccess ? '✓ Portal Active' : '○ Portal Inactive'}
                    </span>
                    <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View profile →
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {!loading && clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No clients match your filters.</p>
        </div>
      )}

      {showCreate && (
        <ClientFormModal
          agencyId={agencyId}
          onClose={() => setShowCreate(false)}
          onSaved={(id) => {
            setShowCreate(false)
            setReloadKey((k) => k + 1)
            navigate(`/app/clients/${id}`)
          }}
        />
      )}
    </motion.div>
  )
}

/** Create/edit client form. Exported so ClientProfile reuses it for editing. */
export function ClientFormModal({
  agencyId,
  existing,
  onClose,
  onSaved,
}: {
  agencyId: string
  existing?: Client
  onClose: () => void
  onSaved: (clientId: string) => void
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    brandName: existing?.brandName ?? '',
    industry: existing?.industry ?? '',
    contactName: existing?.contactName ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    color: existing?.color ?? CLIENT_COLORS[0],
    status: existing?.status ?? ('active' as Client['status']),
    portalAccess: existing?.portalAccess ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Company name is required.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        brandName: form.brandName.trim() || form.name.trim(),
      }
      if (existing) {
        await clientService.update(existing.id, payload)
        toastSuccess('Client updated.')
        onSaved(existing.id)
      } else {
        const created = await clientService.create(agencyId, payload)
        toastSuccess(`${created.brandName} added.`)
        onSaved(created.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save the client.'
      setFormError(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-lg my-8 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-white">{existing ? 'Edit client' : 'Add client'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Company name *</label>
              <input className="input text-xs py-2" value={form.name}
                onChange={(e) => set('name', e.target.value)} placeholder="e.g. Horizon Foods" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Brand name</label>
              <input className="input text-xs py-2" value={form.brandName}
                onChange={(e) => set('brandName', e.target.value)} placeholder="Shown on cards" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Industry</label>
              <input className="input text-xs py-2" value={form.industry}
                onChange={(e) => set('industry', e.target.value)} placeholder="e.g. Food & Beverage" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Contact person</label>
              <input className="input text-xs py-2" value={form.contactName}
                onChange={(e) => set('contactName', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Email</label>
              <input className="input text-xs py-2" type="email" value={form.email}
                onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Phone</label>
              <input className="input text-xs py-2" value={form.phone}
                onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Status</label>
              <select className="input text-xs py-2" value={form.status}
                onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-slate-400 block mb-1">Colour</label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {CLIENT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set('color', c)}
                    className="w-6 h-6 rounded-lg transition-transform"
                    style={{
                      background: c,
                      transform: form.color === c ? 'scale(1.2)' : undefined,
                      outline: form.color === c ? '2px solid white' : 'none',
                      outlineOffset: 1,
                    }} />
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input type="checkbox" checked={form.portalAccess}
              onChange={(e) => set('portalAccess', e.target.checked)} />
            <span className="text-xs text-slate-300">Enable client portal access</span>
          </label>

          {formError && (
            <div className="rounded-xl p-2.5 text-[11px] text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {formError}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn-secondary text-xs py-2 px-4" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary text-xs py-2 px-4" disabled={saving}>
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
