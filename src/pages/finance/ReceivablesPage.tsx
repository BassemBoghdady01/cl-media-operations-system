/**
 * EZ Marketing Agency — Accounts Receivable
 * Who owes us money, how much, and how late.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, KpiCard, KpiSkeleton, FinanceSkeleton,
  EmptyState, DataTable, Money, CurrencyTabs,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, toCsv, downloadCsv } from '../../lib/finance'
import { financeService, type ReceivableRow, type UpcomingRow } from '../../services/financeService'

export default function ReceivablesPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([])
  const [currency, setCurrency] = useState('EGP')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true); setError(null)
    try {
      const [r, u] = await Promise.all([
        financeService.getReceivables(agencyId),
        financeService.getUpcoming(agencyId, 30),
      ])
      setRows(r); setUpcoming(u)
    } catch (err) {
      console.error('[Receivables] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load receivables.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  const currencies = useMemo(() => {
    const set = new Set(rows.map((r) => r.currency))
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [rows])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  const scoped = rows.filter((r) => r.currency === currency)
  const totalOutstanding = scoped.reduce((a, b) => a + Number(b.outstanding), 0)
  const totalOverdue = scoped.reduce((a, b) => a + Number(b.overdue_amount), 0)
  const dueThisMonth = upcoming
    .filter((u) => u.kind === 'income' && u.currency === currency && u.days_until >= 0 && u.days_until <= 30)
    .reduce((a, b) => a + Number(b.amount), 0)

  if (error) return <PageErrorState title="We couldn't load receivables" message={error} onRetry={load} />

  return (
    <div>
      <FinancePageHeader title="Accounts Receivable" subtitle="Outstanding client balances and collection status.">
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        {hasPermission('finance.export') && scoped.length > 0 && (
          <button className="btn-secondary py-2 px-3 text-xs"
            onClick={() => downloadCsv(`ez-receivables-${currency}`, toCsv(scoped as unknown as Record<string, unknown>[]))}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </FinancePageHeader>

      {loading ? (
        <div className="space-y-4"><KpiSkeleton count={3} /><Panel><FinanceSkeleton rows={5} /></Panel></div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Total receivable" value={formatMoney(totalOutstanding, currency)} color="#F59E0B" emphasis />
            <KpiCard label="Overdue" value={formatMoney(totalOverdue, currency)} color="#EF4444"
              sub={totalOverdue > 0 ? 'Requires follow-up' : 'Nothing past due'} />
            <KpiCard label="Due next 30 days" value={formatMoney(dueThisMonth, currency)} color="#3B82F6" />
          </div>

          <Panel title="By client">
            {scoped.length === 0 ? (
              <EmptyState icon="✅" title="Nothing outstanding"
                description="Every recorded invoice and payment has been settled." />
            ) : (
              <DataTable columns={[
                { key: 'client', label: 'Client' },
                { key: 'billed', label: 'Billed', align: 'right' },
                { key: 'paid', label: 'Paid', align: 'right' },
                { key: 'outstanding', label: 'Outstanding', align: 'right' },
                { key: 'overdue', label: 'Overdue', align: 'right' },
                { key: 'oldest', label: 'Oldest due' },
                { key: 'age', label: 'Days late', align: 'right' },
              ]}>
                {scoped.map((r) => (
                  <tr key={r.client_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{r.client_name}</td>
                    <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.total_billed), r.currency)}</td>
                    <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.total_paid), r.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.outstanding)} currency={r.currency} /></td>
                    <td className="py-3 text-right">
                      {Number(r.overdue_amount) > 0
                        ? <Money amount={Number(r.overdue_amount)} currency={r.currency} tone="neg" />
                        : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="py-3 text-xs text-slate-400 whitespace-nowrap">{formatDateShort(r.oldest_due_date)}</td>
                    <td className="py-3 text-right text-xs">
                      {r.days_overdue > 0
                        ? <span className="text-red-400 font-semibold">{r.days_overdue}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
