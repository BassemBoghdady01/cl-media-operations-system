import { supabase, isSupabaseReady } from '../lib/supabase'
import { seedBookings } from '../data/seed'
import type { Booking } from '../types'

export const bookingService = {
  getAll: async (agencyId: string): Promise<Booking[]> => {
    if (!isSupabaseReady || !supabase) return seedBookings

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('agency_id', agencyId)
      .order('booking_date', { ascending: true })

    if (error) { console.error('[bookingService.getAll]', error); return seedBookings }
    return (data ?? []) as unknown as Booking[]
  },

  getByClient: async (clientId: string): Promise<Booking[]> => {
    if (!isSupabaseReady || !supabase) return seedBookings.filter((b) => b.clientId === clientId)

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('client_id', clientId)
      .order('booking_date', { ascending: true })

    if (error) { console.error('[bookingService.getByClient]', error); return [] }
    return (data ?? []) as unknown as Booking[]
  },

  create: async (agencyId: string, booking: Partial<Booking>): Promise<Booking> => {
    if (!isSupabaseReady || !supabase) throw new Error('Connect Supabase to create bookings')

    const { data, error } = await supabase
      .from('bookings')
      .insert({ agency_id: agencyId, ...booking })
      .select()
      .single()

    if (error) throw error
    return data as unknown as Booking
  },

  updateStatus: async (id: string, status: Booking['status']): Promise<void> => {
    if (!isSupabaseReady || !supabase) {
      console.log('[stub] bookingService.updateStatus', id, status)
      return
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },
}
