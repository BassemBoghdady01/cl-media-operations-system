/**
 * Asset library — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row, requireRows } from './serviceCore'
import { storageService } from './storageService'
import { APP_CONFIG } from '../config/app'
import type { Asset } from '../types'

function fmtSize(bytes: unknown): string | undefined {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return undefined
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

export function mapAsset(r: Row): Asset {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    type: r.type ?? 'other',
    name: r.name ?? '',
    url: r.file_url ?? undefined,
    folder: r.folder ?? 'General',
    size: fmtSize(r.file_size),
    format: r.format ?? undefined,
    isApproved: !!r.is_approved,
    createdAt: dstr(r.created_at),
    tags: r.tags ?? undefined,
  }
}

export const assetService = {
  getAll: async (agencyId: string): Promise<Asset[]> => {
    const { data, error } = await db()
      .from('assets').select('*, clients(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    orThrow('assetService.getAll', error)
    return (data ?? []).map(mapAsset)
  },

  getByClient: async (clientId: string, clientVisible?: boolean): Promise<Asset[]> => {
    let q = db().from('assets').select('*, clients(name)').eq('client_id', clientId)
    if (clientVisible !== undefined) q = q.eq('is_client_visible', clientVisible)
    const { data, error } = await q.order('created_at', { ascending: false })
    orThrow('assetService.getByClient', error)
    return (data ?? []).map(mapAsset)
  },

  create: async (agencyId: string, asset: Partial<Asset> & { fileSize?: number; mimeType?: string }): Promise<Asset> => {
    const { data, error } = await db()
      .from('assets')
      .insert({
        agency_id: agencyId,
        client_id: asset.clientId,
        name: asset.name,
        type: asset.type ?? 'other',
        folder: asset.folder ?? 'General',
        file_url: asset.url ?? null,
        file_size: asset.fileSize ?? null,
        mime_type: asset.mimeType ?? null,
        format: asset.format ?? null,
        tags: asset.tags ?? [],
        is_approved: asset.isApproved ?? false,
      })
      .select('*, clients(name)').single()
    orThrow('assetService.create', error)
    return mapAsset(data as Row)
  },

  delete: async (id: string): Promise<void> => {
    const { data: _rows, error } = await db().from('assets').delete().eq('id', id).select('id')
    orThrow('assetService.delete', error)
    requireRows('assetService.delete', _rows)
  },

  /**
   * Deletes the asset row, then its object in the private `client-assets`
   * bucket. The row goes first so an RLS-blocked delete never orphans the
   * record's file. Returns whether the stored file was also removed.
   */
  deleteWithFile: async (asset: Pick<Asset, 'id' | 'url'>): Promise<{ fileRemoved: boolean }> => {
    await assetService.delete(asset.id)
    if (!asset.url) return { fileRemoved: true }
    try {
      await storageService.deleteStored(APP_CONFIG.storage.clientAssets, asset.url)
      return { fileRemoved: true }
    } catch (err) {
      console.error('[assetService] storage object delete failed', err)
      return { fileRemoved: false }
    }
  },

  /** Opens the asset's file via a 1-hour signed URL. */
  open: (asset: Pick<Asset, 'url'>): Promise<void> =>
    storageService.openStoredFile(APP_CONFIG.storage.clientAssets, asset.url),

  /** A 1-hour signed URL for the asset's file. */
  signedUrl: (asset: Pick<Asset, 'url'>): Promise<string> =>
    storageService.signedUrlFor(APP_CONFIG.storage.clientAssets, asset.url),
}
