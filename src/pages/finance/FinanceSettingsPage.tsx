/**
 * EZ Marketing Agency — Finance Settings
 *
 * Configuration hub for the finance module: accounts, categories, the service
 * catalogue, targets, recurring company expenses and workspace preferences.
 * Every list is real Supabase data; archiving (never deleting) keeps the
 * ledger's references intact.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Pencil, Archive as ArchiveIcon, X, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import {
  FinancePageHeader, Panel, FinanceSkeleton, EmptyState, StatusBadge, DataTable, Money,
} from '../../components/finance/FinanceKit'
import { formatMoney, formatDateShort, SUPPORTED_CURRENCIES } from '../../lib/finance'
import {
  financeService,
  type FinanceAccount, type FinanceCategory, type AgencyService,
  type FinanceSettings, type RecurringExpense,
} from '../../services/financeService'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'wallet', 'gateway', 'other'] as const

const CATEGORY_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#06B6D4', '#64748B',
]

const FREQUENCIES: { value: RecurringExpense['frequency']; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' },
]

const SECTIONS = [
  { id: 'accounts', label: 'Financial accounts' },
  { id: 'categories', label: 'Categories' },
  { id: 'services', label: 'Services' },
  { id: 'targets', label: 'Targets' },
  { id: 'recurring', label: 'Recurring expenses' },
  { id: 'preferences', label: 'Preferences' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinanceSettingsPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('finance.manage')
  const canSettings = hasPermission('settings.manage')

  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [services, setServices] = useState<AgencyService[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [settings, setSettings] = useState<FinanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state — 'new' opens an empty form; a row opens it pre-filled.
  const [accountForm, setAccountForm] = useState<FinanceAccount | 'new' | null>(null)
  const [categoryForm, setCategoryForm] = useState<FinanceCategory | 'new' | null>(null)
  const [serviceForm, setServiceForm] = useState<AgencyService | 'new' | null>(null)
  const [recurringForm, setRecurringForm] = useState<RecurringExpense | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    action: () => Promise<void>
  } | null>(null)

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [accs, cats, svcs, rec, st] = await Promise.all([
        financeService.listAccounts(agencyId),
        financeService.listCategories(agencyId),
        financeService.listServices(agencyId),
        financeService.listRecurringExpenses(agencyId),
        financeService.getSettings(agencyId),
      ])
      setAccounts(accs); setCategories(cats); setServices(svcs)
      setRecurring(rec); setSettings(st)
    } catch (err) {
      console.error('[FinanceSettings] load failed', err)
      setError(err instanceof Error ? err.message : 'Could not load finance settings.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories])
  const incomeCategories = useMemo(() => categories.filter((c) => c.kind === 'income'), [categories])
  const baseCurrency = settings?.base_currency ?? 'EGP'

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (error) {
    return <PageErrorState title="We couldn't load finance settings" message={error} onRetry={load} />
  }

  return (
    <div>
      <FinancePageHeader
        title="Finance Settings"
        subtitle="Accounts, categories, services, targets and recurring costs for your workspace."
      />

      {loading ? (
        <div className="space-y-4">
          <Panel><FinanceSkeleton rows={4} /></Panel>
          <Panel><FinanceSkeleton rows={3} /></Panel>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* ── Section nav ── */}
          <nav className="hidden xl:block w-48 flex-shrink-0">
            <div className="sticky top-6 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-5">
            {/* ── 1. Financial accounts ── */}
            <section id="accounts" className="scroll-mt-6">
              <Panel
                title="Financial accounts"
                action={canManage ? (
                  <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => setAccountForm('new')}>
                    <Plus className="w-3.5 h-3.5" /> Add account
                  </button>
                ) : undefined}
              >
                <p className="text-[11px] text-slate-500 mb-4">
                  Where money actually sits — cash boxes, bank accounts, cards, wallets and
                  payment gateways. Accounts are archived, never deleted, because the ledger
                  references them.
                </p>
                {accounts.length === 0 ? (
                  <EmptyState
                    icon="🏦" title="No accounts yet"
                    description="Add your first cash box or bank account so transactions can be attributed to it."
                    action={canManage ? (
                      <button className="btn-primary py-2 px-4 text-xs" onClick={() => setAccountForm('new')}>
                        <Plus className="w-3.5 h-3.5" /> Add account
                      </button>
                    ) : undefined}
                  />
                ) : (
                  <DataTable minWidth={640} columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type' },
                    { key: 'currency', label: 'Currency' },
                    { key: 'opening', label: 'Opening balance', align: 'right' },
                    { key: 'status', label: 'Status', align: 'right' },
                    ...(canManage ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
                  ]}>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3 text-white text-sm">{a.name}</td>
                        <td className="py-3 text-slate-400 text-xs capitalize">{a.type}</td>
                        <td className="py-3 text-slate-400 text-xs">{a.currency}</td>
                        <td className="py-3 text-right"><Money amount={Number(a.opening_balance)} currency={a.currency} /></td>
                        <td className="py-3 text-right"><StatusBadge status={a.status} /></td>
                        {canManage && (
                          <td className="py-3 text-right">
                            <RowActions
                              onEdit={() => setAccountForm(a)}
                              onArchive={() => setConfirm({
                                title: `Archive "${a.name}"?`,
                                message: 'Accounts are archived, never deleted, because ledger transactions reference them. The account disappears from pickers but its history stays intact.',
                                action: async () => {
                                  await financeService.archiveAccount(a.id)
                                  setConfirm(null)
                                  await load()
                                },
                              })}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </DataTable>
                )}
                {!canManage && <LockNote text="Read-only — the finance.manage permission is required to make changes." />}
              </Panel>
            </section>

            {/* ── 2. Categories ── */}
            <section id="categories" className="scroll-mt-6">
              <Panel
                title="Categories"
                action={canManage ? (
                  <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => setCategoryForm('new')}>
                    <Plus className="w-3.5 h-3.5" /> Add category
                  </button>
                ) : undefined}
              >
                <p className="text-[11px] text-slate-500 mb-4">
                  Categories drive the expense breakdown and fixed-vs-variable analysis.
                  Used categories are archived, not deleted.
                </p>
                <div className="grid lg:grid-cols-2 gap-5">
                  <CategoryList
                    heading="Expense categories" rows={expenseCategories} canManage={canManage}
                    emptyText="No expense categories yet."
                    onEdit={setCategoryForm}
                    onArchive={(c) => setConfirm({
                      title: `Archive "${c.name}"?`,
                      message: 'Used categories are archived, not deleted — existing transactions keep their category. It simply stops appearing in pickers.',
                      action: async () => {
                        await financeService.archiveCategory(c.id)
                        setConfirm(null)
                        await load()
                      },
                    })}
                  />
                  <CategoryList
                    heading="Income categories" rows={incomeCategories} canManage={canManage}
                    emptyText="No income categories yet."
                    onEdit={setCategoryForm}
                    onArchive={(c) => setConfirm({
                      title: `Archive "${c.name}"?`,
                      message: 'Used categories are archived, not deleted — existing transactions keep their category. It simply stops appearing in pickers.',
                      action: async () => {
                        await financeService.archiveCategory(c.id)
                        setConfirm(null)
                        await load()
                      },
                    })}
                  />
                </div>
                {!canManage && <LockNote text="Read-only — the finance.manage permission is required to make changes." />}
              </Panel>
            </section>

            {/* ── 3. Services ── */}
            <section id="services" className="scroll-mt-6">
              <Panel
                title="Services"
                action={canManage ? (
                  <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => setServiceForm('new')}>
                    <Plus className="w-3.5 h-3.5" /> Add service
                  </button>
                ) : undefined}
              >
                <p className="text-[11px] text-slate-500 mb-4">
                  Your agency's service catalogue. Income attributed to a service feeds
                  service-level profitability.
                </p>
                {services.length === 0 ? (
                  <EmptyState
                    icon="🧩" title="No services defined"
                    description="Add the services you sell — video production, social media management, media buying…"
                    action={canManage ? (
                      <button className="btn-primary py-2 px-4 text-xs" onClick={() => setServiceForm('new')}>
                        <Plus className="w-3.5 h-3.5" /> Add service
                      </button>
                    ) : undefined}
                  />
                ) : (
                  <DataTable minWidth={620} columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'category', label: 'Category' },
                    { key: 'price', label: 'Default price', align: 'right' },
                    { key: 'currency', label: 'Currency' },
                    { key: 'status', label: 'Status', align: 'right' },
                    ...(canManage ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
                  ]}>
                    {services.map((s) => (
                      <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3 text-white text-sm">{s.name}</td>
                        <td className="py-3 text-slate-400 text-xs">{s.category ?? '—'}</td>
                        <td className="py-3 text-right text-xs text-slate-300 font-semibold">
                          {s.default_price != null ? formatMoney(Number(s.default_price), s.currency) : '—'}
                        </td>
                        <td className="py-3 text-slate-400 text-xs">{s.currency}</td>
                        <td className="py-3 text-right"><StatusBadge status={s.status} /></td>
                        {canManage && (
                          <td className="py-3 text-right">
                            <RowActions
                              onEdit={() => setServiceForm(s)}
                              onArchive={() => setConfirm({
                                title: `Archive "${s.name}"?`,
                                message: 'The service is archived, not deleted — historical income attributed to it is preserved.',
                                action: async () => {
                                  await financeService.archiveAgencyService(s.id)
                                  setConfirm(null)
                                  await load()
                                },
                              })}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </DataTable>
                )}
                {!canManage && <LockNote text="Read-only — the finance.manage permission is required to make changes." />}
              </Panel>
            </section>

            {/* ── 4. Targets ── */}
            <section id="targets" className="scroll-mt-6">
              <TargetsSection
                agencyId={agencyId} settings={settings} baseCurrency={baseCurrency}
                canEdit={canSettings} onSaved={load}
              />
            </section>

            {/* ── 5. Recurring company expenses ── */}
            <section id="recurring" className="scroll-mt-6">
              <Panel
                title="Recurring company expenses"
                action={canManage ? (
                  <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => setRecurringForm('new')}>
                    <Plus className="w-3.5 h-3.5" /> Add recurring expense
                  </button>
                ) : undefined}
              >
                <p className="text-[11px] text-slate-500 mb-4">
                  Rent, software subscriptions and other repeating bills. Auto-generate
                  creates the expense in the ledger when it falls due.
                </p>
                {recurring.length === 0 ? (
                  <EmptyState
                    icon="🔁" title="No recurring expenses"
                    description="Add repeating costs like rent or software so forecasts and break-even use them."
                    action={canManage ? (
                      <button className="btn-primary py-2 px-4 text-xs" onClick={() => setRecurringForm('new')}>
                        <Plus className="w-3.5 h-3.5" /> Add recurring expense
                      </button>
                    ) : undefined}
                  />
                ) : (
                  <DataTable minWidth={780} columns={[
                    { key: 'title', label: 'Title' },
                    { key: 'vendor', label: 'Vendor' },
                    { key: 'amount', label: 'Amount', align: 'right' },
                    { key: 'frequency', label: 'Frequency' },
                    { key: 'next', label: 'Next due' },
                    { key: 'auto', label: 'Auto', align: 'center' },
                    { key: 'status', label: 'Status', align: 'right' },
                    ...(canManage ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
                  ]}>
                    {recurring.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3 text-white text-sm">{r.title}</td>
                        <td className="py-3 text-slate-400 text-xs">{r.vendor ?? '—'}</td>
                        <td className="py-3 text-right"><Money amount={Number(r.amount)} currency={r.currency} /></td>
                        <td className="py-3 text-slate-400 text-xs">
                          {FREQUENCIES.find((f) => f.value === r.frequency)?.label ?? r.frequency}
                        </td>
                        <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateShort(r.next_due_date)}</td>
                        <td className="py-3 text-center">
                          <Toggle
                            checked={r.auto_generate}
                            disabled={!canManage}
                            onChange={async (v) => {
                              try {
                                await financeService.updateRecurringExpense(r.id, { auto_generate: v })
                                setRecurring((prev) => prev.map((x) => x.id === r.id ? { ...x, auto_generate: v } : x))
                              } catch (err) {
                                console.error('[FinanceSettings] toggle auto_generate failed', err)
                                await load()
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 text-right"><StatusBadge status={r.status} /></td>
                        {canManage && (
                          <td className="py-3 text-right">
                            <RowActions onEdit={() => setRecurringForm(r)} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </DataTable>
                )}
                {!canManage && <LockNote text="Read-only — the finance.manage permission is required to make changes." />}
              </Panel>
            </section>

            {/* ── 6. Preferences ── */}
            <section id="preferences" className="scroll-mt-6">
              <PreferencesSection
                agencyId={agencyId} settings={settings}
                canEdit={canSettings} onSaved={load}
              />
            </section>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {accountForm && (
        <AccountFormModal
          agencyId={agencyId}
          initial={accountForm === 'new' ? null : accountForm}
          onClose={() => setAccountForm(null)}
          onSaved={async () => { setAccountForm(null); await load() }}
        />
      )}
      {categoryForm && (
        <CategoryFormModal
          agencyId={agencyId}
          initial={categoryForm === 'new' ? null : categoryForm}
          onClose={() => setCategoryForm(null)}
          onSaved={async () => { setCategoryForm(null); await load() }}
        />
      )}
      {serviceForm && (
        <ServiceFormModal
          agencyId={agencyId}
          initial={serviceForm === 'new' ? null : serviceForm}
          onClose={() => setServiceForm(null)}
          onSaved={async () => { setServiceForm(null); await load() }}
        />
      )}
      {recurringForm && (
        <RecurringFormModal
          agencyId={agencyId}
          userId={user?.id ?? ''}
          initial={recurringForm === 'new' ? null : recurringForm}
          categories={expenseCategories}
          accounts={accounts}
          onClose={() => setRecurringForm(null)}
          onSaved={async () => { setRecurringForm(null); await load() }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Archive"
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ─── Category list ────────────────────────────────────────────────────────────

function CategoryList({
  heading, rows, canManage, emptyText, onEdit, onArchive,
}: {
  heading: string
  rows: FinanceCategory[]
  canManage: boolean
  emptyText: string
  onEdit: (c: FinanceCategory) => void
  onArchive: (c: FinanceCategory) => void
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">{heading}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-3">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((c) => (
            <div key={c.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-sm text-white flex-1 truncate">{c.name}</span>
              {c.cost_type !== 'none' && (
                <span
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                  style={c.cost_type === 'fixed'
                    ? { color: '#38BDF8', background: 'rgba(56,189,248,0.12)' }
                    : { color: '#FB923C', background: 'rgba(251,146,60,0.12)' }}
                >
                  {c.cost_type === 'fixed' ? 'Fixed' : 'Variable'}
                </span>
              )}
              {c.is_payroll && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                  style={{ color: '#C084FC', background: 'rgba(192,132,252,0.12)' }}>
                  Payroll
                </span>
              )}
              {canManage && (
                <RowActions onEdit={() => onEdit(c)} onArchive={() => onArchive(c)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Targets ──────────────────────────────────────────────────────────────────

function TargetsSection({
  agencyId, settings, baseCurrency, canEdit, onSaved,
}: {
  agencyId: string
  settings: FinanceSettings | null
  baseCurrency: string
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const toInput = (v: number | null | undefined) => (v == null ? '' : String(v))
  const [f, setF] = useState({
    monthly_revenue_target: toInput(settings?.monthly_revenue_target),
    monthly_profit_target: toInput(settings?.monthly_profit_target),
    mrr_target: toInput(settings?.mrr_target),
    new_client_target: toInput(settings?.new_client_target),
  })
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const parse = (v: string): number | null => {
    if (!v.trim()) return null
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : NaN as never
  }

  const save = async () => {
    const patch = {
      monthly_revenue_target: parse(f.monthly_revenue_target),
      monthly_profit_target: parse(f.monthly_profit_target),
      mrr_target: parse(f.mrr_target),
      new_client_target: parse(f.new_client_target),
    }
    if (Object.values(patch).some((v) => v !== null && Number.isNaN(v))) {
      setErr('Targets must be positive numbers (or left empty).')
      return
    }
    setSaving(true); setErr('')
    try {
      await financeService.updateSettings(agencyId, patch)
      setFlash(true)
      setTimeout(() => setFlash(false), 2500)
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save targets.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Targets">
      <p className="text-[11px] text-slate-500 mb-4">
        Monthly goals shown against actuals across the finance dashboards. Money targets
        are in your base currency ({baseCurrency}).
      </p>

      {err && <ErrBox text={err} />}

      {canEdit ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={`Monthly revenue target (${baseCurrency})`}>
              <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.monthly_revenue_target}
                onChange={(e) => set('monthly_revenue_target', e.target.value)} placeholder="Not set" />
            </Field>
            <Field label={`Monthly profit target (${baseCurrency})`}>
              <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.monthly_profit_target}
                onChange={(e) => set('monthly_profit_target', e.target.value)} placeholder="Not set" />
            </Field>
            <Field label={`MRR target (${baseCurrency})`}>
              <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                value={f.mrr_target}
                onChange={(e) => set('mrr_target', e.target.value)} placeholder="Not set" />
            </Field>
            <Field label="New clients per month">
              <input className="input py-2 text-sm" type="number" min="0" step="1"
                value={f.new_client_target}
                onChange={(e) => set('new_client_target', e.target.value)} placeholder="Not set" />
            </Field>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="btn-primary py-2 px-4 text-xs" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save targets'}
            </button>
            {flash && <span className="text-xs text-green-400">Saved.</span>}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ReadOnlyValue label="Monthly revenue"
              value={settings?.monthly_revenue_target != null ? formatMoney(settings.monthly_revenue_target, baseCurrency) : 'Not set'} />
            <ReadOnlyValue label="Monthly profit"
              value={settings?.monthly_profit_target != null ? formatMoney(settings.monthly_profit_target, baseCurrency) : 'Not set'} />
            <ReadOnlyValue label="MRR"
              value={settings?.mrr_target != null ? formatMoney(settings.mrr_target, baseCurrency) : 'Not set'} />
            <ReadOnlyValue label="New clients / month"
              value={settings?.new_client_target != null ? String(settings.new_client_target) : 'Not set'} />
          </div>
          <LockNote text="Read-only — the settings.manage permission is required to edit targets." />
        </>
      )}
    </Panel>
  )
}

// ─── Preferences ──────────────────────────────────────────────────────────────

function PreferencesSection({
  agencyId, settings, canEdit, onSaved,
}: {
  agencyId: string
  settings: FinanceSettings | null
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const [f, setF] = useState({
    base_currency: settings?.base_currency ?? 'EGP',
    reminder_days: (settings?.default_reminder_days ?? [7, 3, 1]).join(', '),
    require_approval: settings?.require_expense_approval ?? false,
    threshold: settings?.expense_approval_threshold != null ? String(settings.expense_approval_threshold) : '',
  })
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    const days = f.reminder_days
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
    if (days.some((n) => !Number.isInteger(n) || n < 0)) {
      setErr('Reminder days must be a comma-separated list of whole numbers, e.g. 7, 3, 1.')
      return
    }
    let threshold: number | null = null
    if (f.threshold.trim()) {
      const n = Number(f.threshold)
      if (!Number.isFinite(n) || n < 0) {
        setErr('The approval threshold must be a positive number.')
        return
      }
      threshold = n
    }

    setSaving(true); setErr('')
    try {
      await financeService.updateSettings(agencyId, {
        base_currency: f.base_currency,
        default_reminder_days: Array.from(new Set(days)).sort((a, b) => b - a),
        require_expense_approval: f.require_approval,
        expense_approval_threshold: threshold,
      })
      setFlash(true)
      setTimeout(() => setFlash(false), 2500)
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save preferences.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Preferences">
      {err && <ErrBox text={err} />}

      {canEdit ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Base currency">
              <select className="input py-2 text-sm" value={f.base_currency}
                onChange={(e) => setF((p) => ({ ...p, base_currency: e.target.value }))}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Default payment reminder days" hint="Comma-separated days before a due date, e.g. 7, 3, 1.">
              <input className="input py-2 text-sm" value={f.reminder_days}
                onChange={(e) => setF((p) => ({ ...p, reminder_days: e.target.value }))} placeholder="7, 3, 1" />
            </Field>
          </div>

          <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Require expense approval</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Expenses at or above the threshold must be approved before payment.
                </p>
              </div>
              <Toggle checked={f.require_approval}
                onChange={(v) => setF((p) => ({ ...p, require_approval: v }))} />
            </div>
            {f.require_approval && (
              <div className="mt-3 max-w-xs">
                <Field label={`Approval threshold (${f.base_currency})`}
                  hint="Leave empty to require approval for every expense.">
                  <input className="input py-2 text-sm" type="number" min="0" step="0.01"
                    value={f.threshold}
                    onChange={(e) => setF((p) => ({ ...p, threshold: e.target.value }))} placeholder="0.00" />
                </Field>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button className="btn-primary py-2 px-4 text-xs" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
            {flash && <span className="text-xs text-green-400">Saved.</span>}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ReadOnlyValue label="Base currency" value={settings?.base_currency ?? 'EGP'} />
            <ReadOnlyValue label="Reminder days"
              value={(settings?.default_reminder_days ?? []).join(', ') || 'Not set'} />
            <ReadOnlyValue label="Expense approval"
              value={settings?.require_expense_approval ? 'Required' : 'Not required'} />
            <ReadOnlyValue label="Approval threshold"
              value={settings?.expense_approval_threshold != null
                ? formatMoney(settings.expense_approval_threshold, settings?.base_currency ?? 'EGP')
                : '—'} />
          </div>
          <LockNote text="Read-only — the settings.manage permission is required to edit preferences." />
        </>
      )}
    </Panel>
  )
}

// ─── Account form ─────────────────────────────────────────────────────────────

function AccountFormModal({
  agencyId, initial, onClose, onSaved,
}: {
  agencyId: string
  initial: FinanceAccount | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'bank',
    currency: initial?.currency ?? 'EGP',
    opening_balance: initial != null ? String(initial.opening_balance) : '0',
  })

  const submit = async () => {
    if (!f.name.trim()) return setErr('Please enter an account name.')
    const opening = Number(f.opening_balance || 0)
    if (!Number.isFinite(opening)) return setErr('Opening balance must be a number.')

    setSaving(true); setErr('')
    try {
      if (initial) {
        await financeService.updateAccount(initial.id, {
          name: f.name.trim(), type: f.type, currency: f.currency, opening_balance: opening,
        })
      } else {
        await financeService.createAccount({
          agency_id: agencyId, name: f.name.trim(), type: f.type,
          currency: f.currency, opening_balance: opening,
        })
      }
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the account.')
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? 'Edit account' : 'Add account'} onClose={onClose}>
      {err && <ErrBox text={err} />}
      <div className="space-y-3">
        <Field label="Name *">
          <input className="input py-2 text-sm" value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            placeholder="CIB business account" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input py-2 text-sm" value={f.type}
              onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select className="input py-2 text-sm" value={f.currency}
              onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Opening balance" hint="The balance when you started tracking this account here.">
          <input className="input py-2 text-sm" type="number" step="0.01"
            value={f.opening_balance}
            onChange={(e) => setF((p) => ({ ...p, opening_balance: e.target.value }))} placeholder="0.00" />
        </Field>
      </div>
      <ModalActions onCancel={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  )
}

// ─── Category form ────────────────────────────────────────────────────────────

function CategoryFormModal({
  agencyId, initial, onClose, onSaved,
}: {
  agencyId: string
  initial: FinanceCategory | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'expense' as FinanceCategory['kind'],
    cost_type: initial?.cost_type ?? 'variable' as FinanceCategory['cost_type'],
    color: initial?.color ?? CATEGORY_COLORS[0],
    is_payroll: initial?.is_payroll ?? false,
  })

  const submit = async () => {
    if (!f.name.trim()) return setErr('Please enter a category name.')

    const isExpense = f.kind === 'expense'
    const payload = {
      name: f.name.trim(),
      kind: f.kind,
      cost_type: isExpense ? f.cost_type : 'none' as const,
      color: f.color,
      is_payroll: isExpense ? f.is_payroll : false,
    }

    setSaving(true); setErr('')
    try {
      if (initial) {
        await financeService.updateCategory(initial.id, payload)
      } else {
        await financeService.createCategory({ agency_id: agencyId, ...payload })
      }
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the category.')
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? 'Edit category' : 'Add category'} onClose={onClose}>
      {err && <ErrBox text={err} />}
      <div className="space-y-3">
        <Field label="Name *">
          <input className="input py-2 text-sm" value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            placeholder={f.kind === 'expense' ? 'Software & tools' : 'Retainers'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <select className="input py-2 text-sm" value={f.kind}
              onChange={(e) => setF((p) => ({ ...p, kind: e.target.value as FinanceCategory['kind'] }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>
          {f.kind === 'expense' && (
            <Field label="Cost type">
              <select className="input py-2 text-sm" value={f.cost_type}
                onChange={(e) => setF((p) => ({ ...p, cost_type: e.target.value as FinanceCategory['cost_type'] }))}>
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
                <option value="none">Not classified</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`}
                onClick={() => setF((p) => ({ ...p, color: c }))}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  border: f.color === c ? '2px solid #fff' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </Field>
        {f.kind === 'expense' && (
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input type="checkbox" checked={f.is_payroll}
              onChange={(e) => setF((p) => ({ ...p, is_payroll: e.target.checked }))}
              className="w-4 h-4 rounded accent-purple-500" />
            <span className="text-xs text-slate-300">
              Payroll category
              <span className="block text-[10px] text-slate-500">
                Amounts in this category count as payroll and are hidden from users without payroll access.
              </span>
            </span>
          </label>
        )}
      </div>
      <ModalActions onCancel={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  )
}

// ─── Service form ─────────────────────────────────────────────────────────────

function ServiceFormModal({
  agencyId, initial, onClose, onSaved,
}: {
  agencyId: string
  initial: AgencyService | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? '',
    default_price: initial?.default_price != null ? String(initial.default_price) : '',
    currency: initial?.currency ?? 'EGP',
  })

  const submit = async () => {
    if (!f.name.trim()) return setErr('Please enter a service name.')
    let price: number | null = null
    if (f.default_price.trim()) {
      const n = Number(f.default_price)
      if (!Number.isFinite(n) || n < 0) return setErr('Default price must be a positive number.')
      price = n
    }

    setSaving(true); setErr('')
    try {
      const payload = {
        name: f.name.trim(),
        category: f.category.trim() || null,
        default_price: price,
        currency: f.currency,
      }
      if (initial) {
        await financeService.updateAgencyService(initial.id, payload)
      } else {
        await financeService.createAgencyService({ agency_id: agencyId, ...payload })
      }
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the service.')
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? 'Edit service' : 'Add service'} onClose={onClose}>
      {err && <ErrBox text={err} />}
      <div className="space-y-3">
        <Field label="Name *">
          <input className="input py-2 text-sm" value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            placeholder="Social media management" />
        </Field>
        <Field label="Category">
          <input className="input py-2 text-sm" value={f.category}
            onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
            placeholder="Retainer, Production, Media buying…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default price" hint="Optional — used as a starting point when billing.">
            <input className="input py-2 text-sm" type="number" min="0" step="0.01"
              value={f.default_price}
              onChange={(e) => setF((p) => ({ ...p, default_price: e.target.value }))} placeholder="—" />
          </Field>
          <Field label="Currency">
            <select className="input py-2 text-sm" value={f.currency}
              onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <ModalActions onCancel={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  )
}

// ─── Recurring expense form ───────────────────────────────────────────────────

function RecurringFormModal({
  agencyId, userId, initial, categories, accounts, onClose, onSaved,
}: {
  agencyId: string
  userId: string
  initial: RecurringExpense | null
  categories: FinanceCategory[]
  accounts: FinanceAccount[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    title: initial?.title ?? '',
    vendor: initial?.vendor ?? '',
    amount: initial != null ? String(initial.amount) : '',
    currency: initial?.currency ?? 'EGP',
    frequency: initial?.frequency ?? 'monthly' as RecurringExpense['frequency'],
    start_date: initial?.start_date ?? today,
    next_due_date: initial?.next_due_date ?? today,
    end_date: initial?.end_date ?? '',
    category_id: initial?.category_id ?? '',
    account_id: initial?.account_id ?? '',
    auto_generate: initial?.auto_generate ?? true,
    reminder_days_before: initial != null ? String(initial.reminder_days_before) : '3',
    status: initial?.status ?? 'active' as RecurringExpense['status'],
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!f.title.trim()) return setErr('Please enter a title.')
    const amount = Number(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter an amount greater than zero.')
    if (!f.start_date || !f.next_due_date) return setErr('Start date and next due date are required.')
    const reminder = Number(f.reminder_days_before || 0)
    if (!Number.isInteger(reminder) || reminder < 0) return setErr('Reminder days must be a whole number.')

    const payload = {
      title: f.title.trim(),
      vendor: f.vendor.trim() || null,
      amount,
      currency: f.currency,
      frequency: f.frequency,
      start_date: f.start_date,
      next_due_date: f.next_due_date,
      end_date: f.end_date || null,
      category_id: f.category_id || null,
      account_id: f.account_id || null,
      auto_generate: f.auto_generate,
      reminder_days_before: reminder,
      status: f.status,
    }

    setSaving(true); setErr('')
    try {
      if (initial) {
        await financeService.updateRecurringExpense(initial.id, payload)
      } else {
        await financeService.createRecurringExpense({
          agency_id: agencyId, created_by: userId || undefined, ...payload,
        })
      }
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the recurring expense.')
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? 'Edit recurring expense' : 'Add recurring expense'} onClose={onClose} wide>
      {err && <ErrBox text={err} />}
      <div className="space-y-3">
        <Field label="Title *">
          <input className="input py-2 text-sm" value={f.title}
            onChange={(e) => set('title', e.target.value)} placeholder="Office rent" />
        </Field>
        <Field label="Vendor">
          <input className="input py-2 text-sm" value={f.vendor}
            onChange={(e) => set('vendor', e.target.value)} placeholder="Landlord / supplier name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount *">
            <input className="input py-2 text-sm" type="number" min="0" step="0.01"
              value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Currency">
            <select className="input py-2 text-sm" value={f.currency}
              onChange={(e) => set('currency', e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <select className="input py-2 text-sm" value={f.frequency}
              onChange={(e) => set('frequency', e.target.value as RecurringExpense['frequency'])}>
              {FREQUENCIES.map((fr) => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input py-2 text-sm" value={f.status}
              onChange={(e) => set('status', e.target.value as RecurringExpense['status'])}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date *">
            <input className="input py-2 text-sm" type="date" value={f.start_date}
              onChange={(e) => set('start_date', e.target.value)} />
          </Field>
          <Field label="Next due date *">
            <input className="input py-2 text-sm" type="date" value={f.next_due_date}
              onChange={(e) => set('next_due_date', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className="input py-2 text-sm" value={f.category_id}
              onChange={(e) => set('category_id', e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Account">
            <select className="input py-2 text-sm" value={f.account_id}
              onChange={(e) => set('account_id', e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reminder days before due">
            <input className="input py-2 text-sm" type="number" min="0" step="1"
              value={f.reminder_days_before}
              onChange={(e) => set('reminder_days_before', e.target.value)} />
          </Field>
          <Field label="End date" hint="Optional — leave empty for open-ended.">
            <input className="input py-2 text-sm" type="date" value={f.end_date}
              onChange={(e) => set('end_date', e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3.5 py-3"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <p className="text-xs font-semibold text-white">Auto-generate</p>
            <p className="text-[10px] text-slate-500">Create the expense in the ledger automatically when it falls due.</p>
          </div>
          <Toggle checked={f.auto_generate} onChange={(v) => set('auto_generate', v)} />
        </div>
      </div>
      <ModalActions onCancel={onClose} onSubmit={submit} saving={saving} />
    </Modal>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Modal({
  title, onClose, children, wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className={`glass-blue rounded-2xl p-6 w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  onCancel, onSubmit, saving,
}: {
  onCancel: () => void
  onSubmit: () => void
  saving: boolean
}) {
  return (
    <div className="flex gap-3 mt-5">
      <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onCancel}>Cancel</button>
      <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={onSubmit} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', onConfirm, onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    setBusy(true); setErr('')
    try {
      await onConfirm()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The action failed.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,26,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass-blue rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-black text-white mb-2">{title}</h2>
        <p className="text-xs text-slate-400 mb-4">{message}</p>
        {err && <ErrBox text={err} />}
        <div className="flex gap-3">
          <button className="btn-secondary flex-1 justify-center py-2.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center py-2.5 text-sm" onClick={run} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function ErrBox({ text }: { text: string }) {
  return (
    <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
      {text}
    </div>
  )
}

function LockNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-4">
      <Lock className="w-3 h-3 flex-shrink-0" /> {text}
    </div>
  )
}

function RowActions({ onEdit, onArchive }: { onEdit: () => void; onArchive?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={onEdit} title="Edit"
        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      {onArchive && (
        <button onClick={onArchive} title="Archive"
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors">
          <ArchiveIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  )
}

function Toggle({
  checked, onChange, disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ background: checked ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.12)' }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-bold text-white break-words">{value}</p>
    </div>
  )
}
