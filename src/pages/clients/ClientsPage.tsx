import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, Filter, Users, Film, Package, MoreHorizontal, TrendingUp } from 'lucide-react'
import { mockClients, mockPackages, mockVideos } from '../../data/mockData'
import { statusColors, getInitials, formatCurrency } from '../../lib/utils'
import type { Client } from '../../types'

const industries = ['All', 'Fashion & Lifestyle', 'Food & Beverage', 'Technology', 'Hospitality', 'Health & Fitness', 'Fashion & Retail']
const statuses = ['All', 'active', 'paused', 'inactive']

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('All')
  const [status, setStatus] = useState('All')

  const filtered = mockClients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.brandName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactName.toLowerCase().includes(search.toLowerCase())
    const matchIndustry = industry === 'All' || c.industry === industry
    const matchStatus = status === 'All' || c.status === status
    return matchSearch && matchIndustry && matchStatus
  })

  const getClientVideos = (id: string) => mockVideos.filter((v) => v.clientId === id).length
  const getClientPackage = (id: string) => mockPackages.find((p) => p.clientId === id)

  const activeCount = mockClients.filter((c) => c.status === 'active').length
  const totalRevenue = mockPackages.reduce((s, p) => s + p.monthlyPrice, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCount} active · {mockClients.length} total</p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Clients', value: activeCount, icon: Users, color: '#3B82F6' },
          { label: 'Total Videos This Month', value: mockVideos.length, icon: Film, color: '#8B5CF6' },
          { label: 'Monthly Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: '#10B981' },
          { label: 'Active Packages', value: mockPackages.filter((p) => p.status === 'active').length, icon: Package, color: '#F59E0B' },
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

      {/* Client grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client, i) => {
          const pkg = getClientPackage(client.id)
          const videoCount = getClientVideos(client.id)
          const pct = pkg ? Math.round((pkg.consumedVideos / pkg.includedVideos) * 100) : 0
          const sc = statusColors[client.status]
          const needsAttention = pct >= 90

          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -2 }}
              className="glass glass-hover rounded-2xl p-5 cursor-pointer group">
              <Link to={`/app/clients/${client.id}`} className="block">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${client.color}, ${client.color}88)` }}>
                      {getInitials(client.brandName)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">{client.brandName}</h3>
                      <p className="text-[11px] text-slate-500">{client.industry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {needsAttention && (
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Package limit approaching" />
                    )}
                    <span className="badge" style={{ background: sc.bg, color: sc.text }}>
                      {client.status}
                    </span>
                  </div>
                </div>

                {/* Contact */}
                <div className="text-[11px] text-slate-500 mb-4">
                  {client.contactName} · {client.email}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
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
                        style={{ width: `${pct}%`, background: pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : client.color }} />
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
              </Link>
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No clients match your filters.</p>
        </div>
      )}
    </motion.div>
  )
}
