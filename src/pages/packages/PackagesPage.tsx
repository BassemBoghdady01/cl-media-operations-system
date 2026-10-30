import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, TrendingUp, Film, AlertTriangle, X, Pencil } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { packageService } from '../../services/packageService'
import { clientService } from '../../services/clientService'
import { toastSuccess, toastError } from '../../lib/toast'
import { formatCurrency, formatDate, getInitials } from '../../lib/utils'
import type { Client, Package as PkgType } from '../../types'

function UsageBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : color
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-[11px] font-bold" style={{ color: barColor }}>{used}/{total}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ background: barColor }} />
      </div>
    </div>
  )
}

function PackageCard({ pkg, clientColor, onEdit }: { pkg: PkgType; clientColor: string; onEdit?: () => void }) {
  const videoPct = pkg.includedVideos > 0 ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100) : 0
  const isAlmostFull = videoPct >= 85
  const isFull = videoPct >= 100

  return (
    <motion.div
      whileHover={onEdit ? { y: -3 } : undefined}
      onClick={onEdit}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      title={onEdit ? 'Edit package' : undefined}
      onKeyDown={onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() } } : undefined}
      className={`glass-blue rounded-2xl p-6 relative overflow-hidden ${onEdit ? 'cursor-pointer' : ''}`}>
      {/* Glow for alerts */}
      {isAlmostFull && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 1px ${isFull ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}` }} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: clientColor }}>
            {getInitials(pkg.clientName || pkg.name)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{pkg.clientName || '—'}</h3>
            <p className="text-[11px] text-slate-500">
              {pkg.name}
              {pkg.status !== 'active' && <span className="ml-1.5 capitalize text-amber-400">· {pkg.status}</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-black text-white">{formatCurrency(pkg.monthlyPrice)}</div>
          <div className="text-[10px] text-slate-500">/month</div>
        </div>
      </div>

      {/* Alert banner */}
      {isAlmostFull && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs"
          style={{ background: isFull ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: isFull ? '#FCA5A5' : '#FCD34D' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {isFull ? 'Package limit reached! Extra videos will be charged.' : `${pkg.includedVideos - pkg.consumedVideos} video${pkg.includedVideos - pkg.consumedVideos !== 1 ? 's' : ''} remaining this month.`}
        </motion.div>
      )}

      {/* Usage bars */}
      <div className="space-y-3 mb-5">
        <UsageBar label="Videos" used={pkg.consumedVideos} total={pkg.includedVideos} color="#3B82F6" />
        <UsageBar label="Revisions" used={pkg.consumedRevisions} total={pkg.includedRevisions} color="#8B5CF6" />
        <UsageBar label="Shooting Days" used={pkg.consumedShootingDays} total={pkg.includedShootingDays} color="#10B981" />
      </div>

      {/* Platforms */}
      {pkg.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {pkg.platforms.map((p) => (
            <span key={p} className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span>{pkg.renewalDate ? `Renews ${formatDate(pkg.renewalDate)}` : 'No renewal date set'}</span>
        <div className="flex items-center gap-3">
          <span>+{formatCurrency(pkg.extraVideoPrice)}/extra video</span>
          {onEdit && (
            <span className="inline-flex items-center gap-1 text-blue-400 font-semibold">
              <Pencil className="w-3 h-3" /> Edit
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

interface EditPackageForm {
  name: string
  status: PkgType['status']
  monthlyPrice: string
  includedVideos: string
  consumedVideos: string
  includedRevisions: string
  consumedRevisions: string
  includedShootingDays: string
  consumedShootingDays: string
  extraVideoPrice: string
  extraRevisionPrice: string
  renewalDate: string
  notes: string
}

const isNonNegNumber = (v: string) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0

function EditPackageModal({
  pkg, saving, error, onSubmit, onClose,
}: {
  pkg: PkgType
  saving: boolean
  error: string | null
  onSubmit: (form: EditPackageForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<EditPackageForm>({
    name: pkg.name,
    status: pkg.status,
    monthlyPrice: String(pkg.monthlyPrice),
    includedVideos: String(pkg.includedVideos),
    consumedVideos: String(pkg.consumedVideos),
    includedRevisions: String(pkg.includedRevisions),
    consumedRevisions: String(pkg.consumedRevisions),
    includedShootingDays: String(pkg.includedShootingDays),
    consumedShootingDays: String(pkg.consumedShootingDays),
    extraVideoPrice: String(pkg.extraVideoPrice),
    extraRevisionPrice: String(pkg.extraRevisionPrice),
    renewalDate: pkg.renewalDate ?? '',
    notes: pkg.notes ?? '',
  })
  const set = (patch: Partial<EditPackageForm>) => setForm((f) => ({ ...f, ...patch }))
  const numericKeys: (keyof EditPackageForm)[] = [
    'monthlyPrice', 'includedVideos', 'consumedVideos', 'includedRevisions', 'consumedRevisions',
    'includedShootingDays', 'consumedShootingDays', 'extraVideoPrice', 'extraRevisionPrice',
  ]
  const valid = form.name.trim().length > 0 && numericKeys.every((k) => isNonNegNumber(form[k]))

  const numInput = (key: keyof EditPackageForm, label: string, step = '1') => (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</label>
      <input type="number" min="0" step={step} className="input py-2 text-xs mt-1"
        value={form[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<EditPackageForm>)} />
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={() => { if (!saving) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h2 className="text-base font-black text-white">Edit Package</h2>
            <p className="text-[11px] text-slate-500 truncate">{pkg.clientName || '—'}</p>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Package Name</label>
              <input className="input py-2 text-xs mt-1" value={form.name}
                onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Status</label>
              <select className="input py-2 text-xs mt-1 capitalize" value={form.status}
                onChange={(e) => set({ status: e.target.value as PkgType['status'] })}>
                {(['active', 'expired', 'cancelled'] as const).map((st) => (
                  <option key={st} value={st} className="capitalize">{st}</option>
                ))}
              </select>
            </div>
          </div>
          {numInput('monthlyPrice', 'Monthly Price (USD)', '0.01')}

          <p className="text-[10px] text-slate-500 uppercase tracking-wide pt-1">Usage — used / included</p>
          <div className="grid grid-cols-2 gap-2">
            {numInput('consumedVideos', 'Videos used')}
            {numInput('includedVideos', 'Videos included')}
            {numInput('consumedRevisions', 'Revisions used')}
            {numInput('includedRevisions', 'Revisions included')}
            {numInput('consumedShootingDays', 'Shoot days used')}
            {numInput('includedShootingDays', 'Shoot days included')}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {numInput('extraVideoPrice', 'Extra video price', '0.01')}
            {numInput('extraRevisionPrice', 'Extra revision price', '0.01')}
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Renewal Date</label>
            <input type="date" className="input py-2 text-xs mt-1" value={form.renewalDate}
              onChange={(e) => set({ renewalDate: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Notes</label>
            <textarea className="input py-2 text-xs mt-1 min-h-[64px]" value={form.notes}
              onChange={(e) => set({ notes: e.target.value })} />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <button
            className="btn-primary w-full justify-center text-xs py-2.5 disabled:opacity-50"
            disabled={!valid || saving}
            onClick={() => onSubmit(form)}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

interface NewPackageForm {
  clientId: string
  name: string
  monthlyPrice: string
  includedVideos: string
  includedRevisions: string
  includedShootingDays: string
  renewalDate: string
  notes: string
}

const EMPTY_FORM: NewPackageForm = {
  clientId: '', name: '', monthlyPrice: '', includedVideos: '',
  includedRevisions: '', includedShootingDays: '', renewalDate: '', notes: '',
}

function NewPackageModal({
  clients, saving, error, onSubmit, onClose,
}: {
  clients: Client[]
  saving: boolean
  error: string | null
  onSubmit: (form: NewPackageForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<NewPackageForm>(EMPTY_FORM)
  const set = (patch: Partial<NewPackageForm>) => setForm((f) => ({ ...f, ...patch }))
  const valid = form.clientId && form.name.trim() && form.monthlyPrice !== '' && Number.isFinite(Number(form.monthlyPrice))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">New Package</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Client</label>
            <select className="input py-2 text-xs mt-1" value={form.clientId}
              onChange={(e) => set({ clientId: e.target.value })}>
              <option value="">Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.brandName || c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Package Name</label>
            <input className="input py-2 text-xs mt-1" placeholder="e.g. Growth — 8 videos/month"
              value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Price (USD)</label>
            <input type="number" min="0" step="1" className="input py-2 text-xs mt-1" placeholder="0"
              value={form.monthlyPrice} onChange={(e) => set({ monthlyPrice: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Videos</label>
              <input type="number" min="0" step="1" className="input py-2 text-xs mt-1" placeholder="0"
                value={form.includedVideos} onChange={(e) => set({ includedVideos: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Revisions</label>
              <input type="number" min="0" step="1" className="input py-2 text-xs mt-1" placeholder="0"
                value={form.includedRevisions} onChange={(e) => set({ includedRevisions: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Shoot Days</label>
              <input type="number" min="0" step="1" className="input py-2 text-xs mt-1" placeholder="0"
                value={form.includedShootingDays} onChange={(e) => set({ includedShootingDays: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Renewal Date (optional)</label>
            <input type="date" className="input py-2 text-xs mt-1" value={form.renewalDate}
              onChange={(e) => set({ renewalDate: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Notes (optional)</label>
            <textarea className="input py-2 text-xs mt-1 min-h-[64px]" placeholder="Anything worth remembering about this deal…"
              value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <button
            className="btn-primary w-full justify-center text-xs py-2.5 disabled:opacity-50"
            disabled={!valid || saving}
            onClick={() => onSubmit(form)}>
            {saving ? 'Creating…' : 'Create Package'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function PackagesPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('packages.manage')

  const [packages, setPackages] = useState<PkgType[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editing, setEditing] = useState<PkgType | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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
        const [pkgRows, clientRows] = await Promise.all([
          packageService.getAll(agencyId),
          clientService.getAll(agencyId),
        ])
        if (cancelled) return
        setPackages(pkgRows)
        setClients(clientRows)
      } catch (err) {
        if (cancelled) return
        console.error('[PackagesPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load packages.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const openCreate = () => { setCreateError(null); setShowCreate(true) }

  const createPackage = async (form: NewPackageForm) => {
    setCreating(true)
    setCreateError(null)
    try {
      await packageService.create(agencyId, {
        clientId: form.clientId,
        name: form.name.trim(),
        monthlyPrice: Number(form.monthlyPrice) || 0,
        includedVideos: Number(form.includedVideos) || 0,
        includedRevisions: Number(form.includedRevisions) || 0,
        includedShootingDays: Number(form.includedShootingDays) || 0,
        renewalDate: form.renewalDate || undefined,
        notes: form.notes.trim() || undefined,
      })
      toastSuccess('Package created.')
      setShowCreate(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[PackagesPage] create failed', err)
      const msg = err instanceof Error ? err.message : 'Could not create the package.'
      setCreateError(msg)
      toastError(msg)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (pkg: PkgType) => {
    if (!canManage) return
    setEditError(null)
    setEditing(pkg)
  }

  const saveEdit = async (form: EditPackageForm) => {
    if (!editing) return
    setSavingEdit(true)
    setEditError(null)
    const updates: Partial<PkgType> = {
      name: form.name.trim(),
      status: form.status,
      monthlyPrice: Number(form.monthlyPrice),
      includedVideos: Number(form.includedVideos),
      consumedVideos: Number(form.consumedVideos),
      includedRevisions: Number(form.includedRevisions),
      consumedRevisions: Number(form.consumedRevisions),
      includedShootingDays: Number(form.includedShootingDays),
      consumedShootingDays: Number(form.consumedShootingDays),
      extraVideoPrice: Number(form.extraVideoPrice),
      extraRevisionPrice: Number(form.extraRevisionPrice),
      renewalDate: form.renewalDate,
      notes: form.notes.trim(),
    }
    try {
      await packageService.update(editing.id, updates)
      setPackages((prev) => prev.map((p) => (p.id === editing.id
        ? { ...p, ...updates, notes: updates.notes || undefined }
        : p)))
      toastSuccess('Package updated.')
      setEditing(null)
    } catch (err) {
      console.error('[PackagesPage] update failed', err)
      const msg = err instanceof Error ? err.message : 'Could not update the package.'
      setEditError(msg)
      toastError(msg)
    } finally {
      setSavingEdit(false)
    }
  }

  const clientColorById = useMemo(() => {
    const map = new Map<string, string>()
    clients.forEach((c) => map.set(c.id, c.color))
    return map
  }, [clients])

  const activePackages = packages.filter((p) => p.status === 'active')
  const totalMRR = activePackages.reduce((s, p) => s + p.monthlyPrice, 0)
  const alertPackages = packages.filter((p) => {
    const pct = p.includedVideos > 0 ? (p.consumedVideos / p.includedVideos) : 0
    return pct >= 0.85
  }).length
  const totalDelivered = packages.reduce((s, p) => s + p.consumedVideos, 0)

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load your packages"
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
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Packages</h1>
          <p className="text-slate-400 text-sm mt-1">Client subscription tracking & usage management</p>
        </div>
        {canManage && (
          <button className="btn-primary text-sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> New Package
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: TrendingUp, label: 'Monthly Recurring Revenue', value: formatCurrency(totalMRR), color: '#10B981' },
              { icon: Package, label: 'Active Packages', value: activePackages.length, color: '#3B82F6' },
              { icon: AlertTriangle, label: 'Packages Near Limit', value: alertPackages, color: '#F59E0B' },
              { icon: Film, label: 'Total Videos Delivered', value: totalDelivered, color: '#8B5CF6' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label}
                className="glass-blue rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty */}
          {packages.length === 0 && (
            <div className="text-center py-14 mb-8">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No packages yet</p>
              <p className="text-slate-600 text-xs mt-1">Client subscription packages you create will appear here.</p>
            </div>
          )}

          {/* Package cards */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.08, 0.6) }}>
                <PackageCard pkg={pkg} clientColor={clientColorById.get(pkg.clientId) ?? '#3B82F6'}
                  onEdit={canManage ? () => openEdit(pkg) : undefined} />
              </motion.div>
            ))}

            {/* Add package CTA */}
            {canManage && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={openCreate}
                className="rounded-2xl flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-all"
                style={{ border: '2px dashed rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.02)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <Plus className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">Add Package</p>
                  <p className="text-xs text-slate-600 mt-0.5">Create a new client package</p>
                </div>
              </motion.button>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <NewPackageModal
            clients={clients}
            saving={creating}
            error={createError}
            onSubmit={createPackage}
            onClose={() => setShowCreate(false)}
          />
        )}
        {editing && (
          <EditPackageModal
            key={editing.id}
            pkg={editing}
            saving={savingEdit}
            error={editError}
            onSubmit={saveEdit}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
