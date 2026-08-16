/**
 * Packages — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import type { Package } from '../types'

export function mapPackage(r: Row): Package {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    name: r.name ?? '',
    monthlyPrice: Number(r.monthly_price ?? 0),
    includedVideos: Number(r.included_videos ?? 0),
    consumedVideos: Number(r.consumed_videos ?? 0),
    includedRevisions: Number(r.included_revisions ?? 0),
    consumedRevisions: Number(r.consumed_revisions ?? 0),
    includedShootingDays: Number(r.included_shooting_days ?? 0),
    consumedShootingDays: Number(r.consumed_shooting_days ?? 0),
    startDate: dstr(r.created_at),
    renewalDate: dstr(r.renewal_date),
    status: r.status ?? 'active',
    platforms: r.platforms ?? [],
    extraVideoPrice: Number(r.extra_video_price ?? 0),
    extraRevisionPrice: Number(r.extra_revision_price ?? 0),
    notes: r.notes ?? undefined,
  }
}

export const packageService = {
  getAll: async (agencyId: string): Promise<Package[]> => {
    const { data, error } = await db()
      .from('packages').select('*, clients(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    orThrow('packageService.getAll', error)
    return (data ?? []).map(mapPackage)
  },

  getByClient: async (clientId: string): Promise<Package | undefined> => {
    const { data, error } = await db()
      .from('packages').select('*, clients(name)')
      .eq('client_id', clientId).eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    orThrow('packageService.getByClient', error)
    return data ? mapPackage(data) : undefined
  },

  create: async (agencyId: string, pkg: Partial<Package>): Promise<Package> => {
    const { data, error } = await db()
      .from('packages')
      .insert({
        agency_id: agencyId,
        client_id: pkg.clientId,
        name: pkg.name,
        monthly_price: pkg.monthlyPrice ?? 0,
        included_videos: pkg.includedVideos ?? 0,
        included_revisions: pkg.includedRevisions ?? 0,
        included_shooting_days: pkg.includedShootingDays ?? 0,
        extra_video_price: pkg.extraVideoPrice ?? 0,
        extra_revision_price: pkg.extraRevisionPrice ?? 0,
        platforms: pkg.platforms ?? [],
        renewal_date: pkg.renewalDate || null,
        status: pkg.status ?? 'active',
        notes: pkg.notes,
      })
      .select('*, clients(name)').single()
    orThrow('packageService.create', error)
    return mapPackage(data as Row)
  },

  update: async (id: string, updates: Partial<Package>): Promise<void> => {
    const patch: Row = {}
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.monthlyPrice !== undefined) patch.monthly_price = updates.monthlyPrice
    if (updates.includedVideos !== undefined) patch.included_videos = updates.includedVideos
    if (updates.consumedVideos !== undefined) patch.consumed_videos = updates.consumedVideos
    if (updates.includedRevisions !== undefined) patch.included_revisions = updates.includedRevisions
    if (updates.consumedRevisions !== undefined) patch.consumed_revisions = updates.consumedRevisions
    if (updates.includedShootingDays !== undefined) patch.included_shooting_days = updates.includedShootingDays
    if (updates.consumedShootingDays !== undefined) patch.consumed_shooting_days = updates.consumedShootingDays
    if (updates.renewalDate !== undefined) patch.renewal_date = updates.renewalDate || null
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.notes !== undefined) patch.notes = updates.notes
    const { error } = await db().from('packages').update(patch).eq('id', id)
    orThrow('packageService.update', error)
  },
}
