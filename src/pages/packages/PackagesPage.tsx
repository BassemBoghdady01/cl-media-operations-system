import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, TrendingUp, Film, RotateCcw, Camera, AlertTriangle, CheckCircle } from 'lucide-react'
import { mockPackages, mockClients } from '../../data/mockData'
import { formatCurrency, formatDate, getInitials } from '../../lib/utils'
import type { Package as PkgType } from '../../types'

function UsageBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
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

function PackageCard({ pkg }: { pkg: PkgType }) {
  const client = mockClients.find((c) => c.id === pkg.clientId)
  const videoPct = pkg.includedVideos > 0 ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100) : 0
  const isAlmostFull = videoPct >= 85
  const isFull = videoPct >= 100

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-blue rounded-2xl p-6 relative overflow-hidden">
      {/* Glow for alerts */}
      {isAlmostFull && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 1px ${isFull ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}` }} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: client?.color ?? '#3B82F6' }}>
            {getInitials(pkg.clientName)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{pkg.clientName}</h3>
            <p className="text-[11px] text-slate-500">{pkg.name}</p>
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
      <div className="flex flex-wrap gap-1.5 mb-4">
        {pkg.platforms.map((p) => (
          <span key={p} className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}>
            {p}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span>Renews {formatDate(pkg.renewalDate)}</span>
        <div className="flex items-center gap-3">
          <span>+{formatCurrency(pkg.extraVideoPrice)}/extra video</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function PackagesPage() {
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const totalMRR = mockPackages.filter((p) => p.status === 'active').reduce((s, p) => s + p.monthlyPrice, 0)
  const alertPackages = mockPackages.filter((p) => {
    const pct = p.includedVideos > 0 ? (p.consumedVideos / p.includedVideos) : 0
    return pct >= 0.85
  }).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Packages</h1>
          <p className="text-slate-400 text-sm mt-1">Client subscription tracking & usage management</p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New Package
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: TrendingUp, label: 'Monthly Recurring Revenue', value: formatCurrency(totalMRR), color: '#10B981' },
          { icon: Package, label: 'Active Packages', value: mockPackages.filter((p) => p.status === 'active').length, color: '#3B82F6' },
          { icon: AlertTriangle, label: 'Packages Near Limit', value: alertPackages, color: '#F59E0B' },
          { icon: Film, label: 'Total Videos Delivered', value: mockPackages.reduce((s, p) => s + p.consumedVideos, 0), color: '#8B5CF6' },
        ].map(({ icon: Icon, label, value, color }) => (
          <motion.div key={label} whileHover={{ y: -2 }}
            className="glass-blue rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-lg font-black text-white">{value}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Package cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {mockPackages.map((pkg, i) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}>
            <PackageCard pkg={pkg} />
          </motion.div>
        ))}

        {/* Add package CTA */}
        <motion.div
          whileHover={{ scale: 1.02 }}
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
        </motion.div>
      </div>

      {/* Package templates */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-white mb-4">Package Templates</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: 'Starter', price: 2800, videos: 8, revisions: 16, shootDays: 1, highlight: false },
            { name: 'Content Machine', price: 4500, videos: 12, revisions: 24, shootDays: 2, highlight: true },
            { name: 'Enterprise', price: 7200, videos: 20, revisions: 40, shootDays: 3, highlight: false },
          ].map(({ name, price, videos, revisions, shootDays, highlight }) => (
            <div key={name}
              className={`glass-blue rounded-2xl p-5 relative ${highlight ? 'glow-border' : ''}`}>
              {highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                  Most Popular
                </div>
              )}
              <h3 className="text-sm font-bold text-white mb-1">{name}</h3>
              <div className="text-xl font-black gradient-text-blue mb-4">{formatCurrency(price)}<span className="text-sm text-slate-500 font-normal">/mo</span></div>
              <ul className="space-y-2 mb-4">
                {[`${videos} videos/month`, `${revisions} revisions included`, `${shootDays} shooting day${shootDays > 1 ? 's' : ''}`, 'Multi-platform delivery', 'Client portal access'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full justify-center text-xs py-2.5 ${highlight ? 'btn-primary' : 'btn-secondary'}`}>
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
