import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedAssets } from '../data/seed'
import type { Asset } from '../types'

export const assetService = {
  getAll: async (agencyId: string): Promise<Asset[]> => {
    if (!isSupabaseReady || !supabase) return seedAssets

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[assetService.getAll]', error); return seedAssets }
    return (data ?? []) as unknown as Asset[]
  },

  getByClient: async (clientId: string, clientVisible?: boolean): Promise<Asset[]> => {
    if (!isSupabaseReady || !supabase) {
      const filtered = seedAssets.filter((a) => a.clientId === clientId)
      return filtered
    }

    let query = supabase
      .from('assets')
      .select('*')
      .eq('client_id', clientId)

    if (clientVisible !== undefined) {
      query = query.eq('is_client_visible', clientVisible)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) { console.error('[assetService.getByClient]', error); return [] }
    return (data ?? []) as unknown as Asset[]
  },

  create: async (agencyId: string, asset: Partial<Asset>): Promise<Asset> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to upload assets')

    const { data, error } = await supabase
      .from('assets')
      .insert({ agency_id: agencyId, ...asset })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Asset
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] assetService.delete', id)
      return
    }

    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (error) throw error
  },
}
