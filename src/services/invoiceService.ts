/**
 * Invoices — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row, requireRows } from './serviceCore'
import type { Invoice } from '../types'
import { BASE_CURRENCY } from '../lib/finance'

export function mapInvoice(r: Row): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number ?? '',
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    amount: Number(r.amount ?? 0),
    tax: Number(r.tax ?? 0),
    discount: Number(r.discount ?? 0),
    total: Number(r.total ?? 0),
    currency: r.currency || BASE_CURRENCY,
    status: r.status ?? 'draft',
    dueDate: dstr(r.due_date),
    issuedDate: dstr(r.issued_date),
    paidDate: r.paid_at ? dstr(r.paid_at) : undefined,
    notes: r.notes ?? undefined,
    packageId: r.package_id ?? undefined,
  }
}

export const invoiceService = {
  getAll: async (agencyId: string): Promise<Invoice[]> => {
    const { data, error } = await db()
      .from('invoices').select('*, clients(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    orThrow('invoiceService.getAll', error)
    return (data ?? []).map(mapInvoice)
  },

  getByClient: async (clientId: string): Promise<Invoice[]> => {
    const { data, error } = await db()
      .from('invoices').select('*, clients(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    orThrow('invoiceService.getByClient', error)
    return (data ?? []).map(mapInvoice)
  },

  create: async (agencyId: string, invoice: Partial<Invoice>): Promise<Invoice> => {
    const { data, error } = await db()
      .from('invoices')
      .insert({
        agency_id: agencyId,
        client_id: invoice.clientId,
        package_id: invoice.packageId ?? null,
        invoice_number: invoice.invoiceNumber,
        amount: invoice.amount ?? 0,
        tax: invoice.tax ?? 0,
        discount: invoice.discount ?? 0,
        total: invoice.total ?? 0,
        currency: invoice.currency || BASE_CURRENCY,
        status: invoice.status ?? 'draft',
        due_date: invoice.dueDate || null,
        issued_date: invoice.issuedDate || undefined,
        notes: invoice.notes,
      })
      .select('*, clients(name)').single()
    orThrow('invoiceService.create', error)
    return mapInvoice(data as Row)
  },

  update: async (id: string, updates: Partial<Invoice>): Promise<void> => {
    const patch: Row = {}
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.amount !== undefined) patch.amount = updates.amount
    if (updates.tax !== undefined) patch.tax = updates.tax
    if (updates.discount !== undefined) patch.discount = updates.discount
    if (updates.total !== undefined) patch.total = updates.total
    if (updates.currency) patch.currency = updates.currency
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate || null
    if (updates.issuedDate !== undefined) patch.issued_date = updates.issuedDate || null
    if (updates.notes !== undefined) patch.notes = updates.notes
    const { data: _rows, error } = await db().from('invoices').update(patch).eq('id', id).select('id')
    orThrow('invoiceService.update', error)
    requireRows('invoiceService.update', _rows)
  },

  markPaid: async (id: string): Promise<void> => {
    const { data: _rows, error } = await db()
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id).select('id')
    orThrow('invoiceService.markPaid', error)
    requireRows('invoiceService.markPaid', _rows)
  },
}
