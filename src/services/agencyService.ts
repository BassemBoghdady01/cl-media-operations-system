/**
 * Agency — production service. Reads/updates the agency row under RLS
 * ("Admins can update their agency"). Failures throw; pages surface them.
 */
import { db, orThrow, type Row, requireRows } from './serviceCore'

export interface AgencyInfo {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  phone: string | null
  email: string | null
}

function mapAgency(r: Row): AgencyInfo {
  return {
    id: r.id,
    name: r.name ?? '',
    logo_url: r.logo_url ?? null,
    website: r.website ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
  }
}

export const agencyService = {
  getAgency: async (id: string): Promise<AgencyInfo | undefined> => {
    const { data, error } = await db()
      .from('agencies')
      .select('id, name, logo_url, website, phone, email')
      .eq('id', id)
      .maybeSingle()
    orThrow('agencyService.getAgency', error)
    return data ? mapAgency(data) : undefined
  },

  updateAgency: async (
    id: string,
    updates: { name?: string; website?: string; phone?: string; email?: string }
  ): Promise<void> => {
    const patch: Row = {}
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.website !== undefined) patch.website = updates.website || null
    if (updates.phone !== undefined) patch.phone = updates.phone || null
    if (updates.email !== undefined) patch.email = updates.email || null
    const { data: _rows, error } = await db().from('agencies').update(patch).eq('id', id).select('id')
    orThrow('agencyService.updateAgency', error)
    requireRows('agencyService.updateAgency', _rows)
  },
}
