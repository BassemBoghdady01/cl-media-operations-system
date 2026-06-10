import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedClients } from '../data/seed'
import type { Client } from '../types'

export const clientService = {
  getAll: async (agencyId: string): Promise<Client[]> => {
    if (!isSupabaseReady || !supabase) return seedClients

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('agency_id', agencyId)
      .order('name')

    if (error) { console.error('[clientService.getAll]', error); return seedClients }
    return (data ?? []) as unknown as Client[]
  },

  getById: async (id: string): Promise<Client | undefined> => {
    if (!isSupabaseReady || !supabase) return seedClients.find((c) => c.id === id)

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) { console.error('[clientService.getById]', error); return undefined }
    return data as unknown as Client
  },

  create: async (agencyId: string, client: Partial<Client>): Promise<Client> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create clients')

    const { data, error } = await supabase
      .from('clients')
      .insert({ agency_id: agencyId, ...client })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Client
  },

  update: async (id: string, updates: Partial<Client>): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] clientService.update', id)
      return
    }

    const { error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },
}
