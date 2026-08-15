import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, FileText, Image, Film, Music, Download } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { assetService } from '../../services/assetService'
import type { Asset } from '../../types'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  logo:     <Image className="w-4 h-4" />,
  image:    <Image className="w-4 h-4" />,
  video:    <Film className="w-4 h-4" />,
  music:    <Music className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  font:     <FileText className="w-4 h-4" />,
}

const TYPE_COLORS: Record<string, string> = {
  logo:     '#3B82F6',
  image:    '#10B981',
  video:    '#8B5CF6',
  music:    '#F59E0B',
  document: '#EF4444',
  font:     '#06B6D4',
}

export default function ClientAssets() {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    assetService.getByClient(user.id).then((data) => {
      setAssets(data)
      setLoading(false)
    })
      .catch((err) => {
        console.error('[ClientAssets] data load failed', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
        setLoading(false)
      })
  }, [user])

  const folders = ['all', ...Array.from(new Set(assets.map((a) => a.folder)))]
  const filtered = activeFolder === 'all' ? assets : assets.filter((a) => a.folder === activeFolder)

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Brand Assets</h1>
        <p className="text-sm text-slate-400">Logos, guidelines, intros, and brand files</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16 }}>
          <FolderOpen className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">No assets uploaded yet</p>
        </div>
      ) : (
        <>
          {/* Folder tabs */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  activeFolder === folder
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}>
                {folder === 'all' ? `All (${assets.length})` : folder}
              </button>
            ))}
          </div>

          {/* Asset grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((asset, i) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl p-4 group flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${TYPE_COLORS[asset.type] ?? '#64748B'}15`, color: TYPE_COLORS[asset.type] ?? '#64748B' }}>
                  {TYPE_ICONS[asset.type] ?? <FileText className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{asset.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">{asset.format ?? asset.type}</span>
                    {asset.size && <span className="text-[10px] text-slate-600">{asset.size}</span>}
                  </div>
                </div>

                {asset.url ? (
                  <a
                    href={asset.url}
                    download
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Download className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <Download className="w-3.5 h-3.5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
