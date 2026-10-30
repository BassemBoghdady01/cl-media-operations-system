/**
 * Partners — ownership, capital, drawings, monthly profit distribution and a
 * statement per partner. Numbers come from the database (migration 011);
 * nothing here is computed from guesses.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users2, PieChart, ArrowDownLeft, ArrowUpRight, Plus, X, Trash2, Pencil, CheckCircle2,
  Banknote, AlertTriangle, Layers, FileText, Wand2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  FinancePageHeader, Panel, KpiCard, StatusBadge, DataTable, Money, EmptyState, FinanceSkeleton,
  InsufficientData, CurrencyTabs,
} from '../../components/finance/FinanceKit'
import PageErrorState from '../../components/system/PageErrorState'
import {
  partnerService, TX_LABELS, TX_DIRECTION, MANUAL_TX_TYPES, type Partner, type EffectiveShare, type PartnerBalance,
  type PartnerTransaction, type ProfitDistribution, type PartnerTxType,
} from '../../services/partnerService'
import { financeService, isoDate, type FinanceAccount } from '../../services/financeService'
import { userService, type ManagedUser } from '../../services/userService'
import { formatMoney, formatPercent, formatDateShort } from '../../lib/finance'
import { toastError, toastSuccess } from '../../lib/toast'
import { normalizeRole, ROLES } from '../../config/roles'

type Tab = 'overview' | 'distributions' | 'transactions' | 'ownership'

const PALETTE = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#F97316', '#64748B']
const METHODS = ['bank_transfer', 'cash', 'wallet', 'cheque', 'card', 'online', 'other'] as const

const errText = (err: unknown, fb: string) =>
  ((err instanceof Error ? err.message : String(err ?? '')).replace(/^[\w.()]+ failed: /, '') || fb)

const pct = (n: number) => `${Number(n.toFixed(2))}%`

function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass-blue rounded-3xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90dvh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Ownership: partner form ──────────────────────────────────────────────────

function PartnerForm({ initial, groups, users, onSave, onClose }: {
  initial: Partial<Partner>
  groups: Partner[]
  users: ManagedUser[]
  onSave: (p: Partial<Partner>) => Promise<void>
  onClose: () => void
}) {
  const [f, setF] = useState<Partial<Partner>>({ kind: 'individual', status: 'active', share_percent: 0, ...initial })
  const [saving, setSaving] = useState(false)
  const set = (p: Partial<Partner>) => setF((x) => ({ ...x, ...p }))
  const isMember = f.kind === 'individual' && !!f.parent_id
  const valid = !!f.name?.trim() && Number(f.share_percent) >= 0 && Number(f.share_percent) <= 100

  return (
    <Modal title={initial.id ? 'Edit partner' : f.kind === 'group' ? 'New partner group' : 'New partner'} onClose={onClose}>
      <div className="space-y-3">
        {!initial.id && (
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['individual', 'group'] as const).map((k) => (
              <button key={k} onClick={() => set({ kind: k, parent_id: k === 'group' ? null : f.parent_id })}
                className={`px-3 py-1.5 rounded-lg text-xs ${f.kind === k ? 'text-white bg-blue-500/20' : 'text-slate-400'}`}>
                {k === 'individual' ? 'Person' : 'Group (e.g. Capital)'}
              </button>
            ))}
          </div>
        )}
        <Field label="Name">
          <input className="input py-2 text-xs" value={f.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {f.kind === 'individual' && (
          <Field label="Belongs to group" hint="Leave empty if this person owns a share of the company directly.">
            <select className="input py-2 text-xs" value={f.parent_id ?? ''} onChange={(e) => set({ parent_id: e.target.value || null })}>
              <option value="">— Direct partner —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={isMember ? 'Share of the group (%)' : 'Share of the company (%)'}
          hint={isMember ? 'E.g. 3 equal members → 33.33 each.' : 'All direct shares must add up to 100.'}>
          <input type="number" step="0.01" min={0} max={100} className="input py-2 text-xs"
            value={f.share_percent ?? 0} onChange={(e) => set({ share_percent: Number(e.target.value) })} />
        </Field>
        {f.kind === 'individual' && (
          <Field label="Linked login (optional)" hint="Lets this partner sign in and see their own statement.">
            <select className="input py-2 text-xs" value={f.profile_id ?? ''} onChange={(e) => set({ profile_id: e.target.value || null })}>
              <option value="">No login</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone"><input className="input py-2 text-xs" value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><input className="input py-2 text-xs" value={f.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Joined on"><input type="date" className="input py-2 text-xs" value={f.joined_on ?? ''} onChange={(e) => set({ joined_on: e.target.value || null })} /></Field>
          <Field label="Status">
            <select className="input py-2 text-xs" value={f.status} onChange={(e) => set({ status: e.target.value as Partner['status'] })}>
              <option value="active">Active</option><option value="exited">Exited</option>
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className="input py-2 text-xs min-h-[56px]" value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <button className="btn-primary w-full justify-center text-xs py-2.5" disabled={!valid || saving}
          onClick={async () => { setSaving(true); try { await onSave(f) } finally { setSaving(false) } }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Quick setup for the "you + a group" structure ────────────────────────────

function QuickSetup({ defaultName, onDone, onClose, agencyId }: {
  defaultName: string; onDone: () => void; onClose: () => void; agencyId: string
}) {
  const [me, setMe] = useState(defaultName)
  const [myShare, setMyShare] = useState(33.33)
  const [group, setGroup] = useState('Capital')
  const [members, setMembers] = useState(['', '', ''])
  const [saving, setSaving] = useState(false)
  const groupShare = Number((100 - myShare).toFixed(2))
  const named = members.map((m) => m.trim()).filter(Boolean)
  const each = named.length ? Number((100 / named.length).toFixed(4)) : 0

  const save = async () => {
    setSaving(true)
    try {
      await partnerService.savePartner(agencyId, { kind: 'individual', name: me, share_percent: myShare })
      await partnerService.savePartner(agencyId, { kind: 'group', name: group, share_percent: groupShare })
      const all = await partnerService.listPartners(agencyId)
      const g = all.find((p) => p.kind === 'group' && p.name === group.trim())
      if (g) {
        // Equal split; the last member absorbs rounding so the group totals 100.
        let used = 0
        for (let i = 0; i < named.length; i++) {
          const share = i === named.length - 1 ? Number((100 - used).toFixed(4)) : each
          used += share
          await partnerService.savePartner(agencyId, { kind: 'individual', name: named[i], parent_id: g.id, share_percent: share })
        }
      }
      toastSuccess('Ownership saved.')
      onDone()
    } catch (err) {
      toastError(errText(err, 'Could not save the ownership.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Set up ownership" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-400">You own a direct share; the rest belongs to a group whose members split it.</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2"><Field label="Your name"><input className="input py-2 text-xs" value={me} onChange={(e) => setMe(e.target.value)} /></Field></div>
          <Field label="Your share %"><input type="number" step="0.01" className="input py-2 text-xs" value={myShare} onChange={(e) => setMyShare(Number(e.target.value))} /></Field>
          <div className="col-span-2"><Field label="Group name"><input className="input py-2 text-xs" value={group} onChange={(e) => setGroup(e.target.value)} /></Field></div>
          <Field label="Group share %"><input className="input py-2 text-xs opacity-70" value={groupShare} readOnly /></Field>
        </div>
        <Field label={`Members of ${group || 'the group'} (equal split)`}>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className="input py-2 text-xs flex-1" placeholder={`Member ${i + 1}`} value={m}
                  onChange={(e) => setMembers((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />
                <span className="text-[11px] text-slate-500 w-28 self-center text-right">
                  {m.trim() ? `${pct(each)} of group · ${pct(groupShare * each / 100)}` : ''}
                </span>
              </div>
            ))}
            <button className="btn-ghost text-[11px]" onClick={() => setMembers((x) => [...x, ''])}><Plus className="w-3 h-3" /> Add member</button>
          </div>
        </Field>
        <button className="btn-primary w-full justify-center text-xs py-2.5"
          disabled={saving || !me.trim() || !group.trim() || named.length === 0 || myShare <= 0 || myShare >= 100}
          onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save ownership'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Transaction form ────────────────────────────────────────────────────────

function TransactionForm({ partners, accounts, distributions, baseCurrency, onSave, onClose }: {
  partners: Partner[]; accounts: FinanceAccount[]; distributions: ProfitDistribution[]; baseCurrency: string
  onSave: (t: Partial<PartnerTransaction>) => Promise<void>; onClose: () => void
}) {
  const [t, setT] = useState<Partial<PartnerTransaction>>({
    type: 'capital_contribution', currency: accounts[0]?.currency ?? baseCurrency,
    transaction_date: isoDate(new Date()), account_id: accounts[0]?.id ?? null, payment_method: 'bank_transfer',
  })
  const [saving, setSaving] = useState(false)
  const set = (p: Partial<PartnerTransaction>) => setT((x) => ({ ...x, ...p }))
  const openDists = distributions.filter((d) => d.status === 'approved' && d.lines.some((l) => l.partner_id === t.partner_id))
  const valid = !!t.partner_id && !!t.type && Number(t.amount) > 0 && !!t.transaction_date

  return (
    <Modal title="Record partner money" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Partner">
            <select className="input py-2 text-xs" value={t.partner_id ?? ''} onChange={(e) => set({ partner_id: e.target.value })}>
              <option value="">Choose…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kind === 'group' ? ' (group)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="input py-2 text-xs" value={t.type} onChange={(e) => set({ type: e.target.value as PartnerTxType, distribution_id: null })}>
              {MANUAL_TX_TYPES.map((k) => <option key={k} value={k}>{TX_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" min={0} step="0.01" className="input py-2 text-xs" value={t.amount ?? ''}
              onChange={(e) => set({ amount: Number(e.target.value) })} />
          </Field>
          <Field label="Date">
            <input type="date" className="input py-2 text-xs" value={t.transaction_date} onChange={(e) => set({ transaction_date: e.target.value })} />
          </Field>
          <Field label="Company account" hint="Moves this account's balance.">
            <select className="input py-2 text-xs" value={t.account_id ?? ''}
              onChange={(e) => {
                const acc = accounts.find((a) => a.id === e.target.value)
                set({ account_id: e.target.value || null, currency: acc?.currency ?? t.currency })
              }}>
              <option value="">Not through an account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <input className="input py-2 text-xs" value={t.currency ?? ''} disabled={!!t.account_id}
              onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Method">
            <select className="input py-2 text-xs" value={t.payment_method ?? ''} onChange={(e) => set({ payment_method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input className="input py-2 text-xs" value={t.reference ?? ''} onChange={(e) => set({ reference: e.target.value })} /></Field>
        </div>
        {t.type === 'profit_payout' && (
          <Field label="Against distribution" hint="Links the payout to an approved distribution so its balance updates.">
            <select className="input py-2 text-xs" value={t.distribution_id ?? ''} onChange={(e) => set({ distribution_id: e.target.value || null })}>
              <option value="">— None —</option>
              {openDists.map((d) => <option key={d.id} value={d.id}>{d.title} · {d.currency}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes"><textarea className="input py-2 text-xs min-h-[56px]" value={t.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <p className="text-[11px] text-slate-500">
          {t.type && TX_DIRECTION[t.type] === 'in' ? 'Money comes INTO the company.' : 'Money goes OUT to the partner.'}
          {' '}Partner money is equity — it never shows as an expense in the P&L.
        </p>
        <button className="btn-primary w-full justify-center text-xs py-2.5" disabled={!valid || saving}
          onClick={async () => { setSaving(true); try { await onSave(t) } finally { setSaving(false) } }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Distribution form ───────────────────────────────────────────────────────

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) }
}

function DistributionForm({ agencyId, shares, baseCurrency, onCreated, onClose }: {
  agencyId: string; shares: EffectiveShare[]; baseCurrency: string; onCreated: () => void; onClose: () => void
}) {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [mode, setMode] = useState<'month' | 'quarter' | 'custom'>('month')
  const [month, setMonth] = useState(`${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`)
  const [custom, setCustom] = useState({ from: isoDate(lastMonth), to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) })
  const [quarter, setQuarter] = useState(() => {
    const q = Math.floor(lastMonth.getMonth() / 3)
    return `${lastMonth.getFullYear()}-Q${q + 1}`
  })
  const [currency, setCurrency] = useState(baseCurrency)
  const [reserve, setReserve] = useState(0)
  const [manual, setManual] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [summary, setSummary] = useState<{ currency: string; revenue: number; expenses: number; net: number }[] | null>(null)
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => {
    if (mode === 'month') return monthRange(month)
    if (mode === 'quarter') {
      const [y, q] = quarter.split('-Q').map(Number)
      return { from: isoDate(new Date(y, (q - 1) * 3, 1)), to: isoDate(new Date(y, q * 3, 0)) }
    }
    return custom
  }, [mode, month, quarter, custom])

  useEffect(() => {
    let cancelled = false
    setSummary(null)
    partnerService.periodSummary(agencyId, range.from, range.to)
      .then((s) => { if (!cancelled) setSummary(s) })
      .catch(() => { if (!cancelled) setSummary([]) })
    return () => { cancelled = true }
  }, [agencyId, range.from, range.to])

  const row = summary?.find((s) => s.currency === currency) ?? { currency, revenue: 0, expenses: 0, net: 0 }
  const currencies = Array.from(new Set([baseCurrency, ...(summary ?? []).map((s) => s.currency)]))
  const auto = Math.max(Math.round(row.net * (1 - reserve / 100) * 100) / 100, 0)
  const distributable = manual.trim() !== '' ? Math.max(Number(manual) || 0, 0) : auto

  const quarters = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
    return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
  }).filter((v, i, a) => a.indexOf(v) === i)

  const create = async () => {
    setSaving(true)
    try {
      await partnerService.createDistribution({
        agencyId, from: range.from, to: range.to, currency, reservePercent: reserve,
        amountOverride: manual.trim() !== '' ? Number(manual) : null, notes,
      })
      toastSuccess('Distribution drafted — review and approve it.')
      onCreated()
    } catch (err) {
      toastError(errText(err, 'Could not create the distribution.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New profit distribution" onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['month', 'quarter', 'custom'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize ${mode === m ? 'text-white bg-blue-500/20' : 'text-slate-400'}`}>{m}</button>
            ))}
          </div>
          {mode === 'month' && <Field label="Month"><input type="month" className="input py-2 text-xs" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
          {mode === 'quarter' && (
            <Field label="Quarter">
              <select className="input py-2 text-xs" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                {quarters.map((q) => <option key={q}>{q}</option>)}
              </select>
            </Field>
          )}
          {mode === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From"><input type="date" className="input py-2 text-xs" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></Field>
              <Field label="To"><input type="date" className="input py-2 text-xs" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Currency">
              <select className="input py-2 text-xs" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Keep in company %" hint="Reserve before splitting.">
              <input type="number" min={0} max={100} step="1" className="input py-2 text-xs" value={reserve}
                onChange={(e) => setReserve(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))} />
            </Field>
          </div>
          <Field label="Distribute a fixed amount instead (optional)" hint="Leave empty to use net profit minus the reserve.">
            <input type="number" min={0} step="0.01" className="input py-2 text-xs" value={manual} onChange={(e) => setManual(e.target.value)} />
          </Field>
          <Field label="Notes"><textarea className="input py-2 text-xs min-h-[50px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl p-4 space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{formatDateShort(range.from)} → {formatDateShort(range.to)}</div>
            {summary === null ? <div className="h-20 animate-pulse rounded-lg bg-white/[0.03]" /> : (
              <>
                <div className="flex justify-between"><span className="text-slate-400">Revenue collected</span><Money amount={row.revenue} currency={currency} /></div>
                <div className="flex justify-between"><span className="text-slate-400">Expenses paid</span><Money amount={row.expenses} currency={currency} /></div>
                <div className="flex justify-between pt-2 border-t border-white/5"><span className="text-slate-300 font-semibold">Net profit</span><Money amount={row.net} currency={currency} tone="auto" /></div>
                {reserve > 0 && manual.trim() === '' && (
                  <div className="flex justify-between"><span className="text-slate-400">Kept in company ({reserve}%)</span><Money amount={Math.max(row.net, 0) * reserve / 100} currency={currency} /></div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/5"><span className="text-white font-bold">To distribute</span><span className="font-black text-green-400">{formatMoney(distributable, currency)}</span></div>
              </>
            )}
          </div>
          {summary !== null && row.net <= 0 && manual.trim() === '' && (
            <InsufficientData message="No profit in this period for this currency — the distribution would be zero. Record the month's revenue and expenses first, or enter a fixed amount." />
          )}
          <div className="space-y-1.5">
            {shares.map((s, i) => (
              <div key={s.partner_id} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="text-slate-200 flex-1 truncate">{s.name}{s.group_name ? <span className="text-slate-500"> · {s.group_name}</span> : ''}</span>
                <span className="text-slate-500 w-14 text-right">{pct(s.effective_percent)}</span>
                <span className="text-white font-semibold w-28 text-right">{formatMoney(distributable * s.effective_percent / 100, currency)}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full justify-center text-xs py-2.5" disabled={saving || summary === null}
            onClick={() => void create()}>
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Pay-out dialog ──────────────────────────────────────────────────────────

function PayDialog({ dist, accounts, onPaid, onClose }: {
  dist: ProfitDistribution; accounts: FinanceAccount[]; onPaid: () => void; onClose: () => void
}) {
  const usable = accounts.filter((a) => a.currency === dist.currency)
  const [account, setAccount] = useState(usable[0]?.id ?? '')
  const [method, setMethod] = useState('bank_transfer')
  const [date, setDate] = useState(isoDate(new Date()))
  const [saving, setSaving] = useState(false)
  return (
    <Modal title={`Pay out — ${dist.title}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Pays every partner's remaining share. If a partner took an advance (drawing) that hasn't been recovered yet,
          that amount is settled first and only the rest is paid in cash — the advance is never deducted twice.
        </p>
        <Field label="Paid from account">
          <select className="input py-2 text-xs" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Not through an account</option>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Method">
            <select className="input py-2 text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="input py-2 text-xs" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <button className="btn-primary w-full justify-center text-xs py-2.5" disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              const n = await partnerService.payDistribution(dist.id, account || null, method, date)
              toastSuccess(`${n} payout${n === 1 ? '' : 's'} recorded.`)
              onPaid()
            } catch (err) { toastError(errText(err, 'Could not record the payouts.')) } finally { setSaving(false) }
          }}>
          {saving ? 'Recording…' : 'Record payouts'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Statement ───────────────────────────────────────────────────────────────

function Statement({ partner, share, currency, txs, distributions, onClose }: {
  partner: Partner; share?: EffectiveShare; currency: string
  txs: PartnerTransaction[]; distributions: ProfitDistribution[]; onClose: () => void
}) {
  const rows = useMemo(() => {
    const items: { date: string; label: string; detail: string; credit: number; debit: number; capital: number }[] = []
    for (const d of distributions) {
      if (d.currency !== currency || (d.status !== 'approved' && d.status !== 'paid')) continue
      const l = d.lines.find((x) => x.partner_id === partner.id)
      if (l && l.amount > 0) items.push({ date: d.period_end, label: 'Profit share', detail: `${d.title} · ${pct(l.share_percent)}`, credit: l.amount, debit: 0, capital: 0 })
    }
    for (const t of txs) {
      if (t.partner_id !== partner.id || t.currency !== currency) continue
      if (t.type === 'advance_offset') items.push({ date: t.transaction_date, label: 'Advance recovered', detail: `${formatMoney(t.amount, currency)} of the share settled against earlier drawings — no cash moved`, credit: 0, debit: 0, capital: 0 })
      else if (t.type === 'profit_payout') items.push({ date: t.transaction_date, label: 'Payout', detail: t.notes ?? '', credit: 0, debit: t.amount, capital: 0 })
      else if (t.type === 'drawing') items.push({ date: t.transaction_date, label: 'Drawing', detail: t.notes ?? '', credit: 0, debit: t.amount, capital: 0 })
      else items.push({ date: t.transaction_date, label: TX_LABELS[t.type], detail: t.notes ?? '', credit: 0, debit: 0, capital: t.type === 'capital_contribution' ? t.amount : -t.amount })
    }
    items.sort((a, b) => a.date.localeCompare(b.date))
    let bal = 0
    return items.map((r) => { bal += r.credit - r.debit; return { ...r, balance: bal } })
  }, [partner.id, currency, txs, distributions])

  const capital = rows.reduce((s, r) => s + r.capital, 0)
  const balance = rows.length ? rows[rows.length - 1].balance : 0

  return (
    <Modal title={`Statement — ${partner.name}`} onClose={onClose} wide>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiCard label="Ownership" value={share ? pct(share.effective_percent) : '—'} sub={share?.group_name ? `${pct(share.own_share)} of ${share.group_name}` : 'Direct'} color="#8B5CF6" />
        <KpiCard label="Capital in company" value={formatMoney(capital, currency)} color="#06B6D4" />
        <KpiCard label={balance >= 0 ? 'Owed to partner' : 'Drawn ahead'} value={formatMoney(Math.abs(balance), currency)} color={balance >= 0 ? '#10B981' : '#F97316'} emphasis />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="🧾" title="No movements yet" description="Profit shares, payouts, drawings and capital will appear here." />
      ) : (
        <div className="glass-blue rounded-2xl p-5">
          <DataTable minWidth={620} columns={[
            { key: 'd', label: 'Date' }, { key: 'l', label: 'Entry' }, { key: 'c', label: 'Profit share', align: 'right' },
            { key: 'p', label: 'Paid / drawn', align: 'right' }, { key: 'k', label: 'Capital', align: 'right' }, { key: 'b', label: 'Balance', align: 'right' },
          ]}>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-2.5 text-xs text-slate-400 whitespace-nowrap">{formatDateShort(r.date)}</td>
                <td className="py-2.5 text-xs"><div className="text-slate-200">{r.label}</div>{r.detail && <div className="text-[10px] text-slate-500 truncate max-w-[220px]">{r.detail}</div>}</td>
                <td className="py-2.5 text-xs text-right">{r.credit ? <Money amount={r.credit} currency={currency} tone="pos" /> : ''}</td>
                <td className="py-2.5 text-xs text-right">{r.debit ? <Money amount={r.debit} currency={currency} tone="neg" /> : ''}</td>
                <td className="py-2.5 text-xs text-right">{r.capital ? <Money amount={r.capital} currency={currency} /> : ''}</td>
                <td className="py-2.5 text-xs text-right"><Money amount={r.balance} currency={currency} tone="auto" /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </Modal>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('partners.manage')
  const canSeeAll = hasPermission('partners.view')

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const [partners, setPartners] = useState<Partner[]>([])
  const [shares, setShares] = useState<EffectiveShare[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [balances, setBalances] = useState<PartnerBalance[]>([])
  const [txs, setTxs] = useState<PartnerTransaction[]>([])
  const [dists, setDists] = useState<ProfitDistribution[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [ytd, setYtd] = useState<{ currency: string; revenue: number; expenses: number; net: number }[]>([])
  const [baseCurrency, setBaseCurrency] = useState('EGP')
  const [currency, setCurrency] = useState('EGP')

  const [editPartner, setEditPartner] = useState<Partial<Partner> | null>(null)
  const [showQuick, setShowQuick] = useState(false)
  const [showTx, setShowTx] = useState(false)
  const [showDist, setShowDist] = useState(false)
  const [payDist, setPayDist] = useState<ProfitDistribution | null>(null)
  const [statementFor, setStatementFor] = useState<Partner | null>(null)
  const [openDist, setOpenDist] = useState<string | null>(null)

  useEffect(() => {
    if (!agencyId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setError(null)
      try {
        const year = new Date().getFullYear()
        const [p, s, iss, b, t, d, acc, settings, sum] = await Promise.all([
          partnerService.listPartners(agencyId),
          partnerService.effectiveShares(agencyId),
          partnerService.structureIssues(agencyId),
          partnerService.balances(agencyId),
          partnerService.listTransactions(agencyId),
          partnerService.listDistributions(agencyId),
          financeService.listAccounts(agencyId).catch(() => [] as FinanceAccount[]),
          financeService.getSettings(agencyId).catch(() => null),
          partnerService.periodSummary(agencyId, `${year}-01-01`, `${year}-12-31`).catch(() => []),
        ])
        if (cancelled) return
        setPartners(p); setShares(s); setIssues(iss); setBalances(b); setTxs(t); setDists(d); setAccounts(acc); setYtd(sum)
        const base = settings?.base_currency || 'EGP'
        setBaseCurrency(base)
        setCurrency((c) => c || base)
      } catch (err) {
        if (!cancelled) setError(errText(err, 'Could not load partners.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  useEffect(() => {
    if (!agencyId || !canManage) return
    userService.listUsers(agencyId)
      .then((u) => setUsers(u.filter((x) => normalizeRole(x.role) !== ROLES.CLIENT)))
      .catch(() => setUsers([]))
  }, [agencyId, canManage])

  const currencies = useMemo(() => Array.from(new Set([
    baseCurrency, ...balances.map((b) => b.currency), ...dists.map((d) => d.currency), ...ytd.map((y) => y.currency),
  ])), [baseCurrency, balances, dists, ytd])

  const groups = partners.filter((p) => p.kind === 'group')
  const shareOf = (id: string) => shares.find((s) => s.partner_id === id)
  const balOf = (id: string) => balances.find((b) => b.partner_id === id && b.currency === currency)
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? '—'

  const curBalances = balances.filter((b) => b.currency === currency)
  const totals = {
    capital: curBalances.reduce((s, b) => s + b.net_capital, 0),
    allocated: curBalances.reduce((s, b) => s + b.profit_allocated, 0),
    paid: curBalances.reduce((s, b) => s + b.profit_paid + b.drawings, 0),
    owed: curBalances.reduce((s, b) => s + Math.max(b.balance_due, 0), 0),
  }
  const ytdRow = ytd.find((y) => y.currency === currency)
  const undistributed = dists.filter((d) => d.status === 'draft').length

  const savePartner = async (p: Partial<Partner>) => {
    try {
      await partnerService.savePartner(agencyId, p)
      toastSuccess('Partner saved.')
      setEditPartner(null)
      reload()
    } catch (err) { toastError(errText(err, 'Could not save the partner.')) }
  }

  const deletePartner = async (p: Partner) => {
    if (!window.confirm(`Remove ${p.name}? Partners with money movements can't be removed — mark them "Exited" instead.`)) return
    try { await partnerService.deletePartner(p.id); toastSuccess('Removed.'); reload() }
    catch (err) { toastError(errText(err, 'Could not remove — mark the partner as exited instead.')) }
  }

  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return
    setBusy(true)
    try { await fn(); toastSuccess(ok); reload() } catch (err) { toastError(errText(err, 'Action failed.')) }
    finally { setBusy(false) }
  }

  if (error) {
    return <div className="p-4 sm:p-6 lg:p-8"><PageErrorState title="We couldn't load partners" message={error} onRetry={reload} /></div>
  }

  const TABS: { key: Tab; label: string; icon: typeof PieChart }[] = [
    { key: 'overview', label: 'Overview', icon: PieChart },
    { key: 'distributions', label: 'Profit distribution', icon: Layers },
    { key: 'transactions', label: 'Capital & drawings', icon: Banknote },
    ...(canSeeAll ? [{ key: 'ownership' as Tab, label: 'Ownership', icon: Users2 }] : []),
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8">
      <FinancePageHeader title="Partners" subtitle="Ownership, capital, drawings and profit sharing between the partners.">
        <CurrencyTabs currencies={currencies} value={currency} onChange={setCurrency} />
        {canManage && tab === 'distributions' && (
          <button className="btn-primary text-sm" onClick={() => setShowDist(true)} disabled={partners.length === 0}
            title={partners.length === 0 ? 'Add the partners in Ownership first' : undefined}><Plus className="w-4 h-4" /> New distribution</button>
        )}
        {canManage && tab === 'transactions' && (
          <button className="btn-primary text-sm" onClick={() => setShowTx(true)} disabled={partners.length === 0}
            title={partners.length === 0 ? 'Add the partners in Ownership first' : undefined}><Plus className="w-4 h-4" /> Record money</button>
        )}
        {canManage && tab === 'ownership' && (
          <>
            <button className="btn-secondary text-sm" onClick={() => setEditPartner({ kind: 'group' })}><Layers className="w-4 h-4" /> Add group</button>
            <button className="btn-primary text-sm" onClick={() => setEditPartner({ kind: 'individual' })}><Plus className="w-4 h-4" /> Add partner</button>
          </>
        )}
      </FinancePageHeader>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl mb-6 w-fit max-w-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${tab === key ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            style={tab === key ? { background: 'rgba(59,130,246,0.2)' } : undefined}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {key === 'distributions' && undistributed > 0 && <span className="text-[10px] px-1.5 rounded-full bg-amber-500/25 text-amber-300">{undistributed}</span>}
          </button>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="rounded-2xl p-4 mb-5 flex gap-3 text-xs text-amber-200"
          style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>{issues.map((i) => <div key={i}>{i}</div>)}<div className="text-amber-300/70 mt-1">Profit can't be distributed until this is fixed in Ownership.</div></div>
        </div>
      )}

      {loading ? <FinanceSkeleton rows={5} /> : partners.length === 0 ? (
        <Panel>
          <EmptyState icon="🤝" title="No partners set up yet"
            description="Add the owners and their shares. Profit is split by these percentages every time you distribute."
            action={canManage ? (
              <div className="flex flex-wrap gap-2 justify-center">
                <button className="btn-primary text-xs" onClick={() => setShowQuick(true)}><Wand2 className="w-3.5 h-3.5" /> Quick setup (me + a group)</button>
                <button className="btn-secondary text-xs" onClick={() => { setTab('ownership'); setEditPartner({ kind: 'individual' }) }}>Add manually</button>
              </div>
            ) : undefined} />
        </Panel>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label={`Net profit ${new Date().getFullYear()}`} value={formatMoney(ytdRow?.net ?? 0, currency)}
                  sub={ytdRow ? `${formatMoney(ytdRow.revenue, currency)} in · ${formatMoney(ytdRow.expenses, currency)} out` : 'No ledger entries yet'} color="#3B82F6" />
                <KpiCard label="Profit allocated" value={formatMoney(totals.allocated, currency)} sub="Approved distributions" color="#8B5CF6" />
                <KpiCard label="Paid to partners" value={formatMoney(totals.paid, currency)} sub="Payouts + drawings" color="#06B6D4" />
                <KpiCard label="Still owed to partners" value={formatMoney(totals.owed, currency)} sub={`Capital in company: ${formatMoney(totals.capital, currency)}`} color="#10B981" emphasis />
              </div>

              <Panel title="Ownership">
                <div className="flex h-3 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {shares.map((s, i) => (
                    <div key={s.partner_id} title={`${s.name} ${pct(s.effective_percent)}`}
                      style={{ width: `${s.effective_percent}%`, background: PALETTE[i % PALETTE.length] }} />
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {shares.map((s, i) => {
                    const b = balOf(s.partner_id)
                    const p = partners.find((x) => x.id === s.partner_id)
                    const due = b?.balance_due ?? 0
                    return (
                      <button key={s.partner_id} onClick={() => p && setStatementFor(p)}
                        className="text-left rounded-2xl p-4 hover:bg-white/[0.03] transition-colors"
                        style={{ background: 'rgba(13,22,47,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{s.name}</div>
                              <div className="text-[10px] text-slate-500">{s.group_name ? `${pct(s.own_share)} of ${s.group_name}` : 'Direct partner'}</div>
                            </div>
                          </div>
                          <div className="text-lg font-black text-white">{pct(s.effective_percent)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div><div className="text-slate-500">Allocated</div><div className="text-slate-200 font-semibold">{formatMoney(b?.profit_allocated ?? 0, currency)}</div></div>
                          <div><div className="text-slate-500">Received</div><div className="text-slate-200 font-semibold">{formatMoney((b?.profit_paid ?? 0) + (b?.drawings ?? 0), currency)}</div></div>
                          <div><div className="text-slate-500">{due >= 0 ? 'Owed' : 'Drawn ahead'}</div>
                            <div className={`font-semibold ${due > 0 ? 'text-green-400' : due < 0 ? 'text-orange-400' : 'text-slate-200'}`}>{formatMoney(Math.abs(due), currency)}</div></div>
                        </div>
                        <div className="text-[10px] text-blue-400 mt-3 flex items-center gap-1"><FileText className="w-3 h-3" /> Statement</div>
                      </button>
                    )
                  })}
                </div>
              </Panel>

              <Panel title="Latest distributions" action={<button className="text-xs text-blue-400" onClick={() => setTab('distributions')}>All →</button>}>
                {dists.length === 0 ? <p className="text-xs text-slate-500">No distributions yet. Close a month in the ledger, then create one in "Profit distribution".</p> : (
                  <div className="space-y-2">
                    {dists.slice(0, 4).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-200 truncate">{d.title}</span>
                        <div className="flex items-center gap-3"><Money amount={d.distributable_amount} currency={d.currency} /><StatusBadge status={d.status} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* ── DISTRIBUTIONS ── */}
          {tab === 'distributions' && (
            <Panel>
              {dists.length === 0 ? (
                <EmptyState icon="📊" title="No distributions yet"
                  description="Pick a month or quarter — the system takes net profit from the ledger, keeps your reserve, and splits the rest by ownership."
                  action={canManage ? <button className="btn-primary text-xs" onClick={() => setShowDist(true)}><Plus className="w-3.5 h-3.5" /> New distribution</button> : undefined} />
              ) : (
                <div className="space-y-3">
                  {dists.map((d) => {
                    const open = openDist === d.id
                    const paidFor = (pid: string) => txs.filter((t) => t.distribution_id === d.id && t.partner_id === pid && t.type === 'profit_payout').reduce((s, t) => s + t.amount, 0)
                    const offsetFor = (pid: string) => txs.filter((t) => t.distribution_id === d.id && t.partner_id === pid && t.type === 'advance_offset').reduce((s, t) => s + t.amount, 0)
                    return (
                      <div key={d.id} className="rounded-2xl" style={{ background: 'rgba(13,22,47,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <button className="w-full text-left p-4 flex flex-wrap items-center gap-3 justify-between" onClick={() => setOpenDist(open ? null : d.id)}>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white">{d.title}</div>
                            <div className="text-[11px] text-slate-500">{formatDateShort(d.period_start)} → {formatDateShort(d.period_end)} · net {formatMoney(d.net_profit, d.currency)}{d.reserve_percent > 0 ? ` · ${d.reserve_percent}% kept` : ''}{d.is_manual_amount ? ' · fixed amount' : ''}</div>
                          </div>
                          <div className="flex items-center gap-3"><span className="text-sm font-black text-white">{formatMoney(d.distributable_amount, d.currency)}</span><StatusBadge status={d.status} /></div>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-4">
                                <DataTable minWidth={640} columns={[
                                  { key: 'p', label: 'Partner' }, { key: 's', label: 'Share', align: 'right' },
                                  { key: 'a', label: 'Amount', align: 'right' }, { key: 'o', label: 'Advance recovered', align: 'right' },
                                  { key: 'pd', label: 'Paid in cash', align: 'right' }, { key: 'r', label: 'Remaining', align: 'right' },
                                ]}>
                                  {d.lines.map((l) => {
                                    const paid = paidFor(l.partner_id)
                                    const offset = offsetFor(l.partner_id)
                                    const left = Math.max(l.amount - paid - offset, 0)
                                    return (
                                      <tr key={l.id} className="border-b border-white/[0.04]">
                                        <td className="py-2 text-xs text-slate-200">{name(l.partner_id)}</td>
                                        <td className="py-2 text-xs text-right text-slate-400">{pct(l.share_percent)}</td>
                                        <td className="py-2 text-xs text-right"><Money amount={l.amount} currency={d.currency} /></td>
                                        <td className="py-2 text-xs text-right">{offset > 0 ? <Money amount={offset} currency={d.currency} /> : <span className="text-slate-600">—</span>}</td>
                                        <td className="py-2 text-xs text-right"><Money amount={paid} currency={d.currency} /></td>
                                        <td className="py-2 text-xs text-right"><Money amount={left} currency={d.currency} tone={left > 0.01 ? 'neg' : undefined} /></td>
                                      </tr>
                                    )
                                  })}
                                </DataTable>
                                {d.notes && <p className="text-xs text-slate-400 mt-3">{d.notes}</p>}
                                {canManage && (
                                  <div className="flex flex-wrap gap-2 justify-end mt-4">
                                    {(d.status === 'draft' || (d.status === 'approved' && !txs.some((t) => t.distribution_id === d.id))) && (
                                      <button className="btn-ghost text-xs text-red-300" onClick={() => {
                                        if (window.confirm('Cancel this distribution?')) void act(() => partnerService.cancelDistribution(d.id), 'Distribution cancelled.')
                                      }}><Trash2 className="w-3.5 h-3.5" /> Cancel</button>
                                    )}
                                    {d.status === 'draft' && (
                                      <button className="btn-primary text-xs" disabled={busy} onClick={() => void act(() => partnerService.approveDistribution(d.id), 'Approved — partner balances updated.')}>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                      </button>
                                    )}
                                    {d.status === 'approved' && (
                                      <button className="btn-primary text-xs" onClick={() => setPayDist(d)}><Banknote className="w-3.5 h-3.5" /> Pay out remaining</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          )}

          {/* ── TRANSACTIONS ── */}
          {tab === 'transactions' && (
            <Panel>
              {txs.length === 0 ? (
                <EmptyState icon="💼" title="No capital or drawings recorded"
                  description="Record the capital each partner put in, money they took in advance, and profit payouts."
                  action={canManage ? <button className="btn-primary text-xs" onClick={() => setShowTx(true)}><Plus className="w-3.5 h-3.5" /> Record money</button> : undefined} />
              ) : (
                <DataTable minWidth={720} columns={[
                  { key: 'd', label: 'Date' }, { key: 'p', label: 'Partner' }, { key: 't', label: 'Type' },
                  { key: 'a', label: 'Account' }, { key: 'm', label: 'Amount', align: 'right' }, { key: 'x', label: '', align: 'right' },
                ]}>
                  {txs.map((t) => {
                    const dir = TX_DIRECTION[t.type]
                    return (
                      <tr key={t.id} className="border-b border-white/[0.04]">
                        <td className="py-2.5 text-xs text-slate-400 whitespace-nowrap">{formatDateShort(t.transaction_date)}</td>
                        <td className="py-2.5 text-xs text-slate-200">{name(t.partner_id)}</td>
                        <td className="py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1 text-slate-300">
                            {dir === 'in' ? <ArrowDownLeft className="w-3 h-3 text-green-400" />
                              : dir === 'out' ? <ArrowUpRight className="w-3 h-3 text-orange-400" />
                              : <Layers className="w-3 h-3 text-violet-400" />}
                            {TX_LABELS[t.type]}
                          </span>
                          {t.notes && <div className="text-[10px] text-slate-500 truncate max-w-[220px]">{t.notes}</div>}
                        </td>
                        <td className="py-2.5 text-xs text-slate-400">{accounts.find((a) => a.id === t.account_id)?.name ?? '—'}</td>
                        <td className="py-2.5 text-xs text-right">
                          {dir === 'none'
                            ? <span className="text-slate-400" title="Settled against an earlier drawing — no cash moved">{formatMoney(t.amount, t.currency)}</span>
                            : <Money amount={dir === 'in' ? t.amount : -t.amount} currency={t.currency} tone="auto" />}
                        </td>
                        <td className="py-2.5 text-right">
                          {canManage && t.type !== 'advance_offset' && !(t.type === 'profit_payout' && t.distribution_id) && (
                            <button aria-label="Delete" className="text-slate-600 hover:text-red-400" onClick={() => {
                              if (window.confirm('Delete this entry?')) void act(() => partnerService.deleteTransaction(t.id), 'Entry deleted.')
                            }}><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </DataTable>
              )}
            </Panel>
          )}

          {/* ── OWNERSHIP ── */}
          {tab === 'ownership' && (
            <Panel>
              <div className="space-y-3">
                {partners.filter((p) => !p.parent_id).map((p) => {
                  const members = partners.filter((m) => m.parent_id === p.id)
                  const memberTotal = members.filter((m) => m.status === 'active').reduce((s, m) => s + m.share_percent, 0)
                  return (
                    <div key={p.id} className="rounded-2xl p-4" style={{ background: 'rgba(13,22,47,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.kind === 'group' ? <Layers className="w-4 h-4 text-violet-400" /> : <Users2 className="w-4 h-4 text-blue-400" />}
                          <span className="text-sm font-bold text-white truncate">{p.name}</span>
                          {p.status === 'exited' && <StatusBadge status="cancelled" />}
                          {p.profile_id && <span className="text-[10px] text-slate-500">· has login</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{pct(p.share_percent)}</span>
                          {canManage && <>
                            <button aria-label="Edit" className="text-slate-500 hover:text-white" onClick={() => setEditPartner(p)}><Pencil className="w-3.5 h-3.5" /></button>
                            <button aria-label="Remove" className="text-slate-500 hover:text-red-400" onClick={() => void deletePartner(p)}><Trash2 className="w-3.5 h-3.5" /></button>
                          </>}
                        </div>
                      </div>
                      {p.kind === 'group' && (
                        <div className="mt-3 pl-6 space-y-2">
                          {members.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-slate-300 truncate">{m.name}{m.status === 'exited' ? ' (exited)' : ''}{m.profile_id ? <span className="text-slate-600"> · login</span> : ''}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{pct(m.share_percent)} of group</span>
                                <span className="text-white font-semibold w-16 text-right">{pct(p.share_percent * m.share_percent / 100)}</span>
                                {canManage && <>
                                  <button aria-label="Edit" className="text-slate-500 hover:text-white" onClick={() => setEditPartner(m)}><Pencil className="w-3 h-3" /></button>
                                  <button aria-label="Remove" className="text-slate-500 hover:text-red-400" onClick={() => void deletePartner(m)}><Trash2 className="w-3 h-3" /></button>
                                </>}
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-[11px] pt-1">
                            {canManage ? <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1" onClick={() => setEditPartner({ kind: 'individual', parent_id: p.id })}><Plus className="w-3 h-3" /> Add member</button> : <span />}
                            <span className={Math.abs(memberTotal - 100) > 0.05 && members.length ? 'text-amber-300' : 'text-slate-500'}>Members total {formatPercent(memberTotal, 2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}
        </>
      )}

      <AnimatePresence>
        {editPartner && <PartnerForm initial={editPartner} groups={groups} users={users} onSave={savePartner} onClose={() => setEditPartner(null)} />}
        {showQuick && <QuickSetup agencyId={agencyId} defaultName={user?.name ?? ''} onClose={() => setShowQuick(false)} onDone={() => { setShowQuick(false); reload() }} />}
        {showTx && <TransactionForm partners={partners.filter((p) => p.status === 'active' && (p.kind === 'individual' || !partners.some((m) => m.parent_id === p.id)))}
          accounts={accounts} distributions={dists} baseCurrency={baseCurrency}
          onClose={() => setShowTx(false)}
          onSave={async (t) => {
            try { await partnerService.addTransaction(agencyId, t); toastSuccess('Saved.'); setShowTx(false); reload() }
            catch (err) { toastError(errText(err, 'Could not save.')) }
          }} />}
        {showDist && <DistributionForm agencyId={agencyId} shares={shares} baseCurrency={currency}
          onClose={() => setShowDist(false)} onCreated={() => { setShowDist(false); setTab('distributions'); reload() }} />}
        {payDist && <PayDialog dist={payDist} accounts={accounts} onClose={() => setPayDist(null)} onPaid={() => { setPayDist(null); reload() }} />}
        {statementFor && <Statement partner={statementFor} share={shareOf(statementFor.id)} currency={currency} txs={txs} distributions={dists} onClose={() => setStatementFor(null)} />}
      </AnimatePresence>
    </motion.div>
  )
}
