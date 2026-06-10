import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedPackages } from '../data/seed'
import type { Package } from '../types'

export const packageService = {
  getAll: async (agencyId: string): Promise<Package[]> => {
    if (!isSupabaseReady || !supabase) return seedPackages

    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[packageService.getAll]', error); return seedPackages }
    return (data ?? []) as unknown as Package[]
  },

  getByClient: async (clientId: string): Promise<Package | undefined> => {
    if (!isSupabaseReady || !supabase) return seedPackages.find((p) => p.clientId === clientId)

    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single()

    if (error) { console.error('[packageService.getByClient]', error); return undefined }
    return data as unknown as Package
  },

  update: async (id: string, updates: Partial<Package>): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] packageService.update', id)
      return
    }

    const { error } = await supabase
      .from('packages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },
}
