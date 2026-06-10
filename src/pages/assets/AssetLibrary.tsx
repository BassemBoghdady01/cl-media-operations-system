import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Upload, FolderOpen, Folder, Image, Film, Music,
  FileText, Download, Copy, Check, ExternalLink, Plus, Filter,
} from 'lucide-react'
import { mockAssets, mockClients } from '../../data/mockData'
import { getInitials, formatDate } from '../../lib/utils'
import type { Asset } from '../../types'

const typeIcons: Record<string, { icon: any; color: string; emoji: string }> = {
  logo: { icon: Image, color: '#3B82F6', emoji: '🎨' },
  video: { icon: Film, color: '#8B5CF6', emoji: '🎬' },
  music: { icon: Music, color: '#10B981', emoji: '🎵' },
  document: { icon: FileText, color: '#F59E0B', emoji: '📄' },
  image: { icon: Image, color: '#EC4899', emoji: '🖼️' },
  font: { icon: FileText, color: '#06B6D4', emoji: '🔡' },
  intro: { icon: Film, color: '#EF4444', emoji: '▶️' },
  other: { icon: FolderOpen, color: '#64748B', emoji: '📁' },
  color: { icon: Image, color: '#F59E0B', emoji: '🎨' },
}

// Build folder tree from assets
const allFolders = [...new Set(mockAssets.map((a) => a.folder))]
const clientFolders = mockClients.map((c) => ({
  client: c,
  folders: [...new Set(mockAssets.filter((a) => a.clientId === c.id).map((a) => a.folder))],
}))

function AssetCard({ asset, onCopy }: { asset: Asset; onCopy: (id: string) => void }) {
  const ti = typeIcons[asset.type] ?? typeIcons.other
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className="glass-blue rounded-xl p-4 cursor-pointer group relative overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-video rounded-lg mb-3 flex items-center justify-center text-4xl relative overflow-hidden"
        style={{ background: `${ti.color}10` }}>
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <span>{ti.emoji}</span>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all"
          style={{ background: 'rgba(4,8,26,0.8)' }}>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110"
            style={{ background: 'rgba(59,130,246,0.3)' }}
            onClick={(e) => { e.stopPropagation(); onCopy(asset.id) }}>
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110"
            style={{ background: 'rgba(16,185,129,0.3)' }}>
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Info */}
      <p className="text-xs font-semibold text-white truncate mb-0.5">{asset.name}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{asset.format} · {asset.size}</span>
        {asset.isApproved && (
          <span className="flex items-center gap-0.5 text-[10px] text-green-400">
            <Check className="w-2.5 h-2.5" /> Approved
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-600 mt-0.5">{asset.folder}</p>
    </motion.div>
  )
}

export default function AssetLibrary() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState('All')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState('All')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string) => {
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = mockAssets.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
    const matchClient = selectedClient === 'All' || a.clientName === selectedClient
    const matchFolder = !selectedFolder || a.folder === selectedFolder
    const matchType = selectedType === 'All' || a.type === selectedType
    return matchSearch && matchClient && matchFolder && matchType
  })

  const totalSize = mockAssets.reduce((s, a) => {
    const n = parseFloat(a.size ?? '0')
    if (a.size?.includes('MB')) return s + n
    if (a.size?.includes('KB')) return s + n / 1024
    return s
  }, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Asset Library</h1>
          <p className="text-slate-400 text-sm mt-1">{mockAssets.length} assets · {totalSize.toFixed(0)} MB total</p>
        </div>
        <button className="btn-primary text-sm">
          <Upload className="w-4 h-4" /> Upload Assets
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Object.entries(typeIcons).filter(([k]) => k !== 'other' && k !== 'color').map(([type, { color, emoji }]) => {
          const count = mockAssets.filter((a) => a.type === type).length
          return (
            <button key={type}
              onClick={() => setSelectedType(selectedType === type ? 'All' : type)}
              className={`glass-blue rounded-xl p-3 text-center transition-all hover:scale-[1.02] ${selectedType === type ? 'border-blue-500/40' : ''}`}
              style={{ border: selectedType === type ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xl mb-1">{emoji}</div>
              <div className="text-sm font-black text-white">{count}</div>
              <div className="text-[10px] text-slate-500 capitalize">{type}</div>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Folder sidebar */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Clients</h3>
          <button
            onClick={() => { setSelectedClient('All'); setSelectedFolder(null) }}
            className={`nav-item w-full ${!selectedClient || selectedClient === 'All' ? 'active' : ''}`}>
            <FolderOpen className="w-4 h-4" />
            <span>All Assets</span>
            <span className="ml-auto text-[10px] text-slate-600">{mockAssets.length}</span>
          </button>

          {clientFolders.map(({ client, folders }) => (
            <div key={client.id}>
              <button
                onClick={() => { setSelectedClient(client.brandName); setSelectedFolder(null) }}
                className={`nav-item w-full ${selectedClient === client.brandName ? 'active' : ''}`}>
                <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                  style={{ background: client.color }}>
                  {getInitials(client.brandName)[0]}
                </div>
                <span className="truncate">{client.brandName}</span>
                <span className="ml-auto text-[10px] text-slate-600">
                  {mockAssets.filter((a) => a.clientId === client.id).length}
                </span>
              </button>
              {selectedClient === client.brandName && folders.map((folder) => (
                <button key={folder}
                  onClick={() => setSelectedFolder(selectedFolder === folder ? null : folder)}
                  className={`nav-item w-full ml-3 text-[12px] ${selectedFolder === folder ? 'text-blue-400' : ''}`}>
                  <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{folder}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Asset grid */}
        <div className="lg:col-span-4">
          {/* Search + filter */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input className="input pl-9 py-2 text-xs" placeholder="Search assets…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input py-2 text-xs w-auto" value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}>
              <option>All</option>
              {['logo', 'video', 'music', 'document', 'image', 'intro'].map((t) => (
                <option key={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((asset, i) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}>
                  <AssetCard asset={asset} onCopy={handleCopy} />
                </motion.div>
              ))}

              {/* Upload dropzone */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                style={{ border: '2px dashed rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.03)' }}>
                <Upload className="w-6 h-6 text-slate-600" />
                <span className="text-[11px] text-slate-600">Drop files here</span>
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <FolderOpen className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No assets found.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
