/**
 * EZ Marketing Agency — Profitability
 *
 * Client / project / service contribution. Cost is only what has been
 * ATTRIBUTED to that entity — unallocated overhead is not spread silently,
 * because inventing an allocation would make the margins fiction.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, FinanceSkeleton, PeriodSelector,
  EmptyState, DataTable, Money, CurrencyTabs, InsufficientData,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatPercent, toCsv, downloadCsv } from '../../lib/finance'
import {
  financeService, resolvePeriod,
  type PeriodKey, type ClientProfitability,
  type ProjectProfitability, type ServiceProfitability,
} from '../../services/financeService'

type Tab = 'clients' | 'projects' | 'services'

export default function ProfitabilityPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [tab, setTab] = useState<Tab>('clients')
  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [currency, setCurrency] = useState('EGP')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientProfitability[]>([])
  const [projects, setProjects] = useState<ProjectProfitability[]>([])
  const [services, setServices] = useState<ServiceProfitability[]>([])

  const range = useMemo(() => resolvePeriod(period), [period])

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true); setError(null)
    try {
      const [c, p, s] = await Promise.all([
        financeService.getClientProfitability(agencyId, range.from, range.to),
        financeService.getProjectProfitability(agencyId, range.from, range.to),
        financeService.getServiceProfitability(agencyId, range.from, range.to),
      ])
      setClients(c); setProjects(p); setServices(s)
    } catch (err) {
      console.error('[Profitability] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load profitability data.')
    } finally {
      setLoading(false)
    }
  }, [agencyId, range.from, range.to])

  useEffect(() => { load() }, [load])

  const currencies = useMemo(() => {
    const set = new Set([...clients, ...projects, ...services].map((r) => r.currency))
    return set.size ? Array.from(set).sort() : ['EGP']
  }, [clients, projects, services])

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0])
  }, [currencies, currency])

  const rows = (
    tab === 'clients' ? clients : tab === 'projects' ? projects : services
  ).filter((r) => r.currency === currency)

  if (error) return <PageErrorState title="We couldn't load profitability" message={error} onRetry={load} />

  return (
    <div>
      <FinancePageHeader title="Profitability" subtitle="Contribution by client, project and service.">
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        <PeriodSelector value={period} onChange={setPeriod} />
        {hasPermission('finance.export') && rows.length > 0 && (
          <button className="btn-secondary py-2 px-3 text-xs"
            onClick={() => downloadCsv(`ez-profitability-${tab}-${range.from}`, toCsv(rows as unknown as Record<string, unknown>[]))}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </FinancePageHeader>

      <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {(['clients', 'projects', 'services'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              tab === t ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            style={tab === t ? { background: 'rgba(59,130,246,0.20)' } : undefined}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <Panel><FinanceSkeleton rows={6} /></Panel>
      ) : (
        <div className="space-y-4">
          <InsufficientData message="Costs shown are those explicitly attributed to each row. Unallocated overhead (rent, general software, non-attributed payroll) is not distributed automatically — allocate expenses to a client, project or service to sharpen these margins." />

          <Panel>
            {rows.length === 0 ? (
              <EmptyState icon="📊" title={`No ${tab} activity in this period`}
                description="Record income and attribute expenses to see contribution here." />
            ) : tab === 'clients' ? (
              <DataTable columns={[
                { key: 'name', label: 'Client' },
                { key: 'revenue', label: 'Revenue', align: 'right' },
                { key: 'cost', label: 'Attributed cost', align: 'right' },
                { key: 'profit', label: 'Contribution', align: 'right' },
                { key: 'margin', label: 'Margin', align: 'right' },
                { key: 'subs', label: 'Subscription', align: 'right' },
                { key: 'projects', label: 'Projects', align: 'right' },
              ]}>
                {(rows as ClientProfitability[]).map((r) => (
                  <tr key={r.client_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{r.client_name}</td>
                    <td className="py-3 text-right text-xs text-slate-300">{formatMoney(Number(r.revenue), r.currency)}</td>
                    <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.direct_cost), r.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.profit)} currency={r.currency} tone="auto" /></td>
                    <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(Number(r.margin), 0)}</td>
                    <td className="py-3 text-right text-xs text-slate-400">
                      {Number(r.subscription_value) > 0 ? formatMoney(Number(r.subscription_value), r.currency) : '—'}
                    </td>
                    <td className="py-3 text-right text-xs text-slate-400">{r.active_projects}</td>
                  </tr>
                ))}
              </DataTable>
            ) : tab === 'projects' ? (
              <DataTable columns={[
                { key: 'name', label: 'Project' },
                { key: 'client', label: 'Client' },
                { key: 'status', label: 'Status' },
                { key: 'revenue', label: 'Revenue', align: 'right' },
                { key: 'cost', label: 'Cost', align: 'right' },
                { key: 'profit', label: 'Profit', align: 'right' },
                { key: 'margin', label: 'Margin', align: 'right' },
              ]}>
                {(rows as ProjectProfitability[]).map((r) => (
                  <tr key={r.project_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{r.project_name}</td>
                    <td className="py-3 text-xs text-slate-400">{r.client_name}</td>
                    <td className="py-3 text-xs text-slate-400 capitalize">{r.status}</td>
                    <td className="py-3 text-right text-xs text-slate-300">{formatMoney(Number(r.revenue), r.currency)}</td>
                    <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.cost), r.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.profit)} currency={r.currency} tone="auto" /></td>
                    <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(Number(r.margin), 0)}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <DataTable minWidth={560} columns={[
                { key: 'name', label: 'Service' },
                { key: 'revenue', label: 'Revenue', align: 'right' },
                { key: 'cost', label: 'Cost', align: 'right' },
                { key: 'profit', label: 'Profit', align: 'right' },
                { key: 'margin', label: 'Margin', align: 'right' },
              ]}>
                {(rows as ServiceProfitability[]).map((r) => (
                  <tr key={r.service_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 text-white text-sm">{r.service_name}</td>
                    <td className="py-3 text-right text-xs text-slate-300">{formatMoney(Number(r.revenue), r.currency)}</td>
                    <td className="py-3 text-right text-xs text-slate-400">{formatMoney(Number(r.cost), r.currency)}</td>
                    <td className="py-3 text-right"><Money amount={Number(r.profit)} currency={r.currency} tone="auto" /></td>
                    <td className="py-3 text-right text-xs font-semibold text-slate-300">{formatPercent(Number(r.margin), 0)}</td>
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
