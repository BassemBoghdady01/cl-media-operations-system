/**
 * EZ Marketing Agency — Audit log reader
 *
 * audit_logs rows are written by database triggers (write_audit_log) — the
 * frontend can only READ them, and only with audit.view (RLS, 006).
 */
import { db, orThrow, type Row } from './serviceCore'

export interface AuditLogRow {
  id: string
  agency_id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditFilters {
  actorEmail?: string
  entityType?: string
  action?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export const auditService = {
  list: async (
    agencyId: string,
    filters: AuditFilters = {}
  ): Promise<{ rows: AuditLogRow[]; total: number }> => {
    let q = db()
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (filters.actorEmail) q = q.ilike('actor_email', `%${filters.actorEmail}%`)
    if (filters.entityType) q = q.eq('entity_type', filters.entityType)
    if (filters.action) q = q.eq('action', filters.action)
    if (filters.from) q = q.gte('created_at', filters.from)
    if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59`)

    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    q = q.range(offset, offset + limit - 1)

    const { data, error, count } = await q
    orThrow('auditService.list', error)
    return { rows: (data ?? []) as AuditLogRow[], total: count ?? 0 }
  },

  /** Distinct entity types present in this agency's log (for the filter). */
  listEntityTypes: async (agencyId: string): Promise<string[]> => {
    const { data, error } = await db()
      .from('audit_logs')
      .select('entity_type')
      .eq('agency_id', agencyId)
      .limit(1000)
    orThrow('auditService.listEntityTypes', error)
    return Array.from(new Set(((data ?? []) as Row[]).map((r) => String(r.entity_type)))).sort()
  },
}
