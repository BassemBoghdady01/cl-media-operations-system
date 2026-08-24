import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Upload, FolderOpen, Folder, Image, Film, Music,
  FileText, Download, Copy, Check, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { assetService } from '../../services/assetService'
import { clientService } from '../../services/clientService'
import { storageService } from '../../services/storageService'
import { toastSuccess, toastError } from '../../lib/toast'
import { getInitials } from '../../lib/utils'
import type { Asset, Client } from '../../types'

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

const UPLOAD_TYPES: Asset['type'][] = ['logo', 'image', 'video', 'music', 'document', 'font', 'intro', 'other']

const ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.ttf,.otf,.woff,.woff2,.ai,.psd'

/** Best-guess asset type from the file's MIME type; the user can still override. */
function guessType(file: File): Asset['type'] {
  const m = file.type
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'music'
  if (m.startsWith('font/')) return 'font'
  if (m === 'application/pdf' || m.startsWith('text/') ||
    m.includes('word') || m.includes('presentation') || m.includes('sheet')) return 'document'
  return 'other'
}

function AssetCard({ asset, onCopy }: { asset: Asset; onCopy: (asset: Asset) => void }) {
  const ti = typeIcons[asset.type] ?? typeIcons.other
  const openAsset = () => {
    if (asset.url) window.open(asset.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={openAsset}
      className={`glass-blue rounded-xl p-4 group relative overflow-hidden ${asset.url ? 'cursor-pointer' : ''}`}>
      {/* Thumbnail */}
      <div className="aspect-video rounded-lg mb-3 flex items-center justify-center text-4xl relative overflow-hidden"
        style={{ background: `${ti.color}10` }}>
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <span>{ti.emoji}</span>
        )}
        {/* Hover overlay — actions only exist when the asset has a real file URL */}
        {asset.url && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: 'rgba(4,8,26,0.8)' }}>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110"
              title="Copy link"
              style={{ background: 'rgba(59,130,246,0.3)' }}
              onClick={(e) => { e.stopPropagation(); onCopy(asset) }}>
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110"
              title="Open file"
              style={{ background: 'rgba(16,185,129,0.3)' }}
              onClick={(e) => { e.stopPropagation(); openAsset() }}>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-xs font-semibold text-white truncate mb-0.5">{asset.name}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          {[asset.format, asset.size].filter(Boolean).join(' · ') || '—'}
        </span>
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

/** Approximate size in MB parsed from the human-readable size label. */
function sizeInMB(size?: string): number {
  if (!size) return 0
  const n = parseFloat(size)
  if (!Number.isFinite(n)) return 0
  if (size.includes('GB')) return n * 1024
  if (size.includes('MB')) return n
  if (size.includes('KB')) return n / 1024
  return 0
}

interface UploadForm {
  clientId: string
  name: string
  type: Asset['type']
  folder: string
  tags: string
}

type UploadPhase = 'idle' | 'uploading' | 'saving'

function UploadAssetModal({
  clients, initialFile, phase, error, onSubmit, onClose,
}: {
  clients: Client[]
  initialFile: File | null
  phase: UploadPhase
  error: string | null
  onSubmit: (form: UploadForm, file: File) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<UploadForm>({
    clientId: '',
    name: initialFile?.name ?? '',
    type: initialFile ? guessType(initialFile) : 'other',
    folder: '',
    tags: '',
  })
  const [file, setFile] = useState<File | null>(initialFile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<UploadForm>) => setForm((f) => ({ ...f, ...patch }))
  const busy = phase !== 'idle'
  const valid = form.clientId && !!file

  const pickFile = (f: File | null) => {
    setFile(f)
    if (f) {
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : f.name,
        type: guessType(f),
      }))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={() => { if (!busy) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-blue rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">Upload Asset</h2>
          <button onClick={onClose} disabled={busy}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50">
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
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">File</label>
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 w-full rounded-xl px-3 py-3 text-xs text-left transition-all hover:bg-white/[0.03]"
              style={{ border: '1px dashed rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.04)' }}>
              {file ? (
                <span className="text-white font-medium break-all">
                  {file.name}
                  <span className="text-slate-500 font-normal"> · {(file.size / 1_048_576).toFixed(1)} MB</span>
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Choose a file…
                </span>
              )}
            </button>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Asset Name</label>
            <input className="input py-2 text-xs mt-1" placeholder="Defaults to the file name"
              value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Type</label>
              <select className="input py-2 text-xs mt-1 capitalize" value={form.type}
                onChange={(e) => set({ type: e.target.value as Asset['type'] })}>
                {UPLOAD_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Folder (optional)</label>
              <input className="input py-2 text-xs mt-1" placeholder="General"
                value={form.folder} onChange={(e) => set({ folder: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Tags (optional, comma-separated)</label>
            <input className="input py-2 text-xs mt-1" placeholder="brand, q3-campaign"
              value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-blue-300 rounded-xl px-3 py-2"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
              {phase === 'uploading' ? 'Uploading file to storage…' : 'Saving asset record…'}
            </div>
          )}

          <button
            className="btn-primary w-full justify-center text-xs py-2.5 disabled:opacity-50"
            disabled={!valid || busy}
            onClick={() => { if (file) onSubmit(form, file) }}>
            {busy ? 'Uploading…' : 'Upload Asset'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AssetLibrary() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('assets.manage')

  const [assets, setAssets] = useState<Asset[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState('All')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState('All')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

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
        const [assetRows, clientRows] = await Promise.all([
          assetService.getAll(agencyId),
          clientService.getAll(agencyId),
        ])
        if (cancelled) return
        setAssets(assetRows)
        setClients(clientRows)
      } catch (err) {
        if (cancelled) return
        console.error('[AssetLibrary] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load assets.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const handleCopy = (asset: Asset) => {
    if (!asset.url) return
    navigator.clipboard.writeText(asset.url).then(
      () => {
        setCopiedId(asset.id)
        setTimeout(() => setCopiedId(null), 2000)
      },
      () => toastError('Could not copy the link to clipboard.')
    )
  }

  const openUpload = (file?: File) => {
    setInitialFile(file ?? null)
    setUploadError(null)
    setShowUpload(true)
  }

  const handleUpload = async (form: UploadForm, file: File) => {
    setUploadError(null)
    try {
      setUploadPhase('uploading')
      const { url } = await storageService.uploadClientAsset(agencyId, form.clientId, file)
      setUploadPhase('saving')
      const name = form.name.trim() || file.name
      await assetService.create(agencyId, {
        clientId: form.clientId,
        name,
        type: form.type,
        folder: form.folder.trim() || 'General',
        url,
        fileSize: file.size,
        mimeType: file.type || undefined,
        format: (file.name.includes('.') ? file.name.split('.').pop() ?? '' : '').toUpperCase() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      toastSuccess(`"${name}" uploaded.`)
      setShowUpload(false)
      setInitialFile(null)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[AssetLibrary] upload failed', err)
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      setUploadError(msg)
      toastError(msg)
    } finally {
      setUploadPhase('idle')
    }
  }

  // Client → folder tree built from real assets.
  const clientFolders = useMemo(
    () =>
      clients.map((c) => ({
        client: c,
        count: assets.filter((a) => a.clientId === c.id).length,
        folders: [...new Set(assets.filter((a) => a.clientId === c.id).map((a) => a.folder))],
      })),
    [clients, assets]
  )

  const filtered = assets.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
    const matchClient = selectedClient === 'All' || a.clientName === selectedClient
    const matchFolder = !selectedFolder || a.folder === selectedFolder
    const matchType = selectedType === 'All' || a.type === selectedType
    return matchSearch && matchClient && matchFolder && matchType
  })

  const totalSize = assets.reduce((s, a) => s + sizeInMB(a.size), 0)

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load the asset library"
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
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Asset Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading assets…' : `${assets.length} assets · ${totalSize.toFixed(0)} MB total`}
          </p>
        </div>
        {canManage && (
          <button className="btn-primary text-sm" onClick={() => openUpload()}>
            <Upload className="w-4 h-4" /> Upload Assets
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && assets.length === 0 && (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No assets yet</p>
          <p className="text-slate-600 text-xs mt-1">Uploaded brand files and deliverables will appear here.</p>
          {canManage && (
            <button className="btn-primary text-xs mt-4 mx-auto" onClick={() => openUpload()}>
              <Upload className="w-3.5 h-3.5" /> Upload your first asset
            </button>
          )}
        </div>
      )}

      {!loading && assets.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {Object.entries(typeIcons).filter(([k]) => k !== 'other' && k !== 'color').map(([type, { color, emoji }]) => {
              const count = assets.filter((a) => a.type === type).length
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
                <span className="ml-auto text-[10px] text-slate-600">{assets.length}</span>
              </button>

              {clientFolders.map(({ client, count, folders }) => (
                <div key={client.id}>
                  <button
                    onClick={() => { setSelectedClient(client.brandName); setSelectedFolder(null) }}
                    className={`nav-item w-full ${selectedClient === client.brandName ? 'active' : ''}`}>
                    <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                      style={{ background: client.color }}>
                      {getInitials(client.brandName)[0]}
                    </div>
                    <span className="truncate">{client.brandName}</span>
                    <span className="ml-auto text-[10px] text-slate-600">{count}</span>
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
                      transition={{ delay: Math.min(i * 0.05, 0.6) }}>
                      <AssetCard asset={asset} onCopy={handleCopy} />
                    </motion.div>
                  ))}

                  {/* Upload dropzone — click to pick a file or drop one here */}
                  {canManage && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      onClick={() => openUpload()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const f = e.dataTransfer.files?.[0]
                        if (f) openUpload(f)
                      }}
                      className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                      style={{ border: '2px dashed rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.03)' }}>
                      <Upload className="w-6 h-6 text-slate-600" />
                      <span className="text-[11px] text-slate-600">Drop files here</span>
                    </motion.button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <FolderOpen className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No assets match your filters.</p>
                </div>
              )}

              {copiedId && (
                <p className="text-[10px] text-green-400 mt-3">Asset link copied to clipboard.</p>
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showUpload && (
          <UploadAssetModal
            clients={clients}
            initialFile={initialFile}
            phase={uploadPhase}
            error={uploadError}
            onSubmit={handleUpload}
            onClose={() => { setShowUpload(false); setInitialFile(null) }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
