import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedInvoices } from '../data/seed'
import type { Invoice } from '../types'

export const invoiceService = {
  getAll: async (agencyId: string): Promise<Invoice[]> => {
    if (!isSupabaseReady || !supabase) return seedInvoices

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[invoiceService.getAll]', error); return seedInvoices }
    return (data ?? []) as unknown as Invoice[]
  },

  getByClient: async (clientId: string): Promise<Invoice[]> => {
    if (!isSupabaseReady || !supabase) return seedInvoices.filter((i) => i.clientId === clientId)

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[invoiceService.getByClient]', error); return [] }
    return (data ?? []) as unknown as Invoice[]
  },

  create: async (agencyId: string, invoice: Partial<Invoice>): Promise<Invoice> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create invoices')

    const { data, error } = await supabase
      .from('invoices')
      .insert({ agency_id: agencyId, ...invoice })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Invoice
  },

  markPaid: async (id: string): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] invoiceService.markPaid', id)
      return
    }

    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },
}
