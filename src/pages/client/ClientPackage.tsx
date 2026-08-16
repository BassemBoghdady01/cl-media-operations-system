import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Film, RefreshCw, Camera, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { packageService } from '../../services/packageService'
import type { Package as PackageType } from '../../types'
import { format, parseISO, differenceInDays } from 'date-fns'

function UsageBar({ consumed, included, label, color }: {
  consumed: number; included: number; label: string; color: string
}) {
  const pct = included > 0 ? Math.min((consumed / included) * 100, 100) : 0
  const isNearLimit = pct >= 80
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-xs font-bold ${isNearLimit ? 'text-yellow-400' : 'text-white'}`}>
          {consumed} / {included}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: isNearLimit ? '#EAB308' : color }}
        />
      </div>
    </div>
  )
}

export default function ClientPackage() {
  const { user, profile } = useAuth()
  // Portal data is keyed by the linked client record, not the auth user id.
  const clientId = profile?.client_id ?? user?.id ?? ''
  const [pkg, setPkg] = useState<PackageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    packageService.getByClient(clientId).then((data) => {
      setPkg(data ?? null)
      setLoading(false)
    })
      .catch((err) => {
        console.error('[ClientPackage] data load failed', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
        setLoading(false)
      })
  }, [user])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!pkg) {
    return (
      <div className="px-5 py-6 max-w-2xl mx-auto text-center">
        <Package className="w-10 h-10 mx-auto mb-4 text-slate-600" />
        <h2 className="text-lg font-bold text-white mb-2">No Active Package</h2>
        <p className="text-sm text-slate-400">Contact your account manager to set up your content package.</p>
      </div>
    )
  }

  const daysUntilRenewal = pkg.renewalDate
    ? differenceInDays(parseISO(pkg.renewalDate), new Date())
    : null

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">My Package</h1>
        <p className="text-sm text-slate-400">Current content package and usage</p>
      </div>

      {/* Package header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-lg font-black text-white">{pkg.name}</div>
            <div className="text-sm text-blue-300 mt-0.5 font-semibold">
              ${pkg.monthlyPrice.toLocaleString()} / month
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold text-emerald-400 bg-emerald-400/10">
            Active
          </span>
        </div>

        {daysUntilRenewal !== null && (
          <div className={`flex items-center gap-2 text-xs ${daysUntilRenewal <= 7 ? 'text-yellow-400' : 'text-slate-400'}`}>
            {daysUntilRenewal <= 7 && <AlertTriangle className="w-3.5 h-3.5" />}
            <span>
              Renews {pkg.renewalDate && format(parseISO(pkg.renewalDate), 'MMMM d, yyyy')}
              {daysUntilRenewal !== null && ` · ${daysUntilRenewal > 0 ? `${daysUntilRenewal} days left` : 'Renewing today'}`}
            </span>
          </div>
        )}

        {pkg.platforms && pkg.platforms.length > 0 && (
          <div className="flex gap-2 mt-3">
            {pkg.platforms.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-400 capitalize"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Usage */}
      <div className="rounded-2xl p-6 space-y-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-sm font-bold text-white mb-4">This Month's Usage</div>

        <UsageBar
          label="Videos"
          consumed={pkg.consumedVideos}
          included={pkg.includedVideos}
          color="#3B82F6"
        />
        <UsageBar
          label="Revisions"
          consumed={pkg.consumedRevisions}
          included={pkg.includedRevisions}
          color="#8B5CF6"
        />
        <UsageBar
          label="Shooting Days"
          consumed={pkg.consumedShootingDays}
          included={pkg.includedShootingDays}
          color="#10B981"
        />
      </div>

      {/* Extras info */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Extra Video</div>
          <div className="text-base font-bold text-white">${pkg.extraVideoPrice}</div>
          <div className="text-[10px] text-slate-600">per additional video</div>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Extra Revision</div>
          <div className="text-base font-bold text-white">${pkg.extraRevisionPrice}</div>
          <div className="text-[10px] text-slate-600">per additional revision</div>
        </div>
      </div>
    </div>
  )
}
