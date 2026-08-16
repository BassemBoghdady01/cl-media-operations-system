/**
 * Clients — production service. Real Supabase rows mapped to the app type.
 * No seed fallback: failures throw, absence returns empty.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import type { Client } from '../types'

export function mapClient(r: Row): Client {
  return {
    id: r.id,
    agencyId: r.agency_id,
    name: r.name ?? '',
    brandName: r.brand_name ?? r.name ?? '',
    industry: r.industry ?? '',
    contactName: r.contact_name ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    status: r.status ?? 'active',
    color: r.color ?? '#3B82F6',
    socialLinks: r.social_links ?? undefined,
    accountManagerId: r.assigned_manager_id ?? undefined,
    portalAccess: !!r.portal_access_enabled,
    createdAt: dstr(r.created_at),
  }
}

export const clientService = {
  getAll: async (agencyId: string): Promise<Client[]> => {
    const { data, error } = await db()
      .from('clients').select('*')
      .eq('agency_id', agencyId).order('name')
    orThrow('clientService.getAll', error)
    return (data ?? []).map(mapClient)
  },

  getById: async (id: string): Promise<Client | undefined> => {
    const { data, error } = await db()
      .from('clients').select('*').eq('id', id).maybeSingle()
    orThrow('clientService.getById', error)
    return data ? mapClient(data) : undefined
  },

  create: async (agencyId: string, client: Partial<Client>): Promise<Client> => {
    const { data, error } = await db()
      .from('clients')
      .insert({
        agency_id: agencyId,
        name: client.name,
        brand_name: client.brandName,
        industry: client.industry,
        contact_name: client.contactName,
        email: client.email,
        phone: client.phone,
        status: client.status ?? 'active',
        color: client.color,
        assigned_manager_id: client.accountManagerId ?? null,
        portal_access_enabled: client.portalAccess ?? false,
      })
      .select().single()
    orThrow('clientService.create', error)
    return mapClient(data as Row)
  },

  update: async (id: string, updates: Partial<Client>): Promise<void> => {
    const patch: Row = {}
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.brandName !== undefined) patch.brand_name = updates.brandName
    if (updates.industry !== undefined) patch.industry = updates.industry
    if (updates.contactName !== undefined) patch.contact_name = updates.contactName
    if (updates.email !== undefined) patch.email = updates.email
    if (updates.phone !== undefined) patch.phone = updates.phone
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.color !== undefined) patch.color = updates.color
    if (updates.accountManagerId !== undefined) patch.assigned_manager_id = updates.accountManagerId
    if (updates.portalAccess !== undefined) patch.portal_access_enabled = updates.portalAccess
    const { error } = await db().from('clients').update(patch).eq('id', id)
    orThrow('clientService.update', error)
  },
}
