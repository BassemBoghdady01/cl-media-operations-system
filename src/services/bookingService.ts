/**
 * Shooting bookings — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import type { Booking } from '../types'

function fmtTime(t: unknown): string {
  return t ? String(t).slice(0, 5) : ''
}

/** "10:00 → 13:00" duration label from start/end times, or ''. */
function durationLabel(start: unknown, end: unknown): string {
  if (!start || !end) return ''
  const [sh, sm] = String(start).split(':').map(Number)
  const [eh, em] = String(end).split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  if (!Number.isFinite(mins) || mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function mapBooking(r: Row): Booking {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    clientColor: r.clients?.color ?? '#3B82F6',
    date: dstr(r.booking_date),
    time: fmtTime(r.start_time),
    duration: durationLabel(r.start_time, r.end_time),
    location: r.location ?? '',
    studio: r.studio ?? undefined,
    assignedTeam: r.assigned_team_ids ?? [],
    status: r.status ?? 'requested',
    shotList: r.shot_list ?? undefined,
    notes: r.notes ?? undefined,
    depositAmount: r.deposit_amount != null ? Number(r.deposit_amount) : undefined,
    depositPaid: !!r.deposit_paid,
  }
}

export const bookingService = {
  getAll: async (agencyId: string): Promise<Booking[]> => {
    const { data, error } = await db()
      .from('bookings').select('*, clients(name, color)')
      .eq('agency_id', agencyId)
      .order('booking_date', { ascending: true })
    orThrow('bookingService.getAll', error)
    return (data ?? []).map(mapBooking)
  },

  getByClient: async (clientId: string): Promise<Booking[]> => {
    const { data, error } = await db()
      .from('bookings').select('*, clients(name, color)')
      .eq('client_id', clientId)
      .order('booking_date', { ascending: true })
    orThrow('bookingService.getByClient', error)
    return (data ?? []).map(mapBooking)
  },

  create: async (
    agencyId: string,
    booking: Partial<Booking> & { title?: string; endTime?: string }
  ): Promise<Booking> => {
    const { data, error } = await db()
      .from('bookings')
      .insert({
        agency_id: agencyId,
        client_id: booking.clientId,
        title: booking.title ?? 'Shooting session',
        location: booking.location,
        studio: booking.studio,
        booking_date: booking.date,
        start_time: booking.time || null,
        end_time: booking.endTime || null,
        status: booking.status ?? 'requested',
        assigned_team_ids: booking.assignedTeam ?? [],
        shot_list: booking.shotList ?? [],
        deposit_amount: booking.depositAmount ?? 0,
        deposit_paid: booking.depositPaid ?? false,
        notes: booking.notes,
      })
      .select('*, clients(name, color)').single()
    orThrow('bookingService.create', error)
    return mapBooking(data as Row)
  },

  updateStatus: async (id: string, status: Booking['status']): Promise<void> => {
    const { error } = await db().from('bookings').update({ status }).eq('id', id)
    orThrow('bookingService.updateStatus', error)
  },
}
