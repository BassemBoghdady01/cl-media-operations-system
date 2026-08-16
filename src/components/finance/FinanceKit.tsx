/**
 * EZ Marketing Agency — Finance UI kit
 *
 * Shared primitives so every finance page reads as one system. Deliberately
 * restrained: accounting screens get clarity, not animation.
 */

import type { ReactNode } from 'react'
import { STATUS_STYLES, formatMoney, formatPercent } from '../../lib/finance'
import { PERIOD_LABELS, type PeriodKey } from '../../services/financeService'

// ─── Page scaffolding ─────────────────────────────────────────────────────────

export function FinancePageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`glass-blue rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-bold text-white">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  color = '#3B82F6',
  trend,
  emphasis = false,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  trend?: number | null
  emphasis?: boolean
}) {
  return (
    <div
      className="glass-blue rounded-2xl p-5 relative overflow-hidden"
      style={emphasis ? { borderColor: `${color}44` } : undefined}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.07] -translate-y-5 translate-x-5"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        {trend !== undefined && trend !== null && (
          <span className={`text-[11px] font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(trend))}
          </span>
        )}
      </div>
      <div className="text-xl font-black text-white leading-tight break-words">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}
    >
      {s.label}
    </span>
  )
}

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODS: PeriodKey[] = ['this_month', 'last_month', 'last_3_months', 'this_quarter', 'this_year']

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodKey
  onChange: (p: PeriodKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === p ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
          style={value === p ? { background: 'rgba(59,130,246,0.20)' } : undefined}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  )
}

/** Shown when the agency trades in more than one currency. */
export function CurrencyTabs({
  currencies,
  value,
  onChange,
}: {
  currencies: string[]
  value: string
  onChange: (c: string) => void
}) {
  if (currencies.length <= 1) return null
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
      {currencies.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === c ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
          style={value === c ? { background: 'rgba(139,92,246,0.20)' } : undefined}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────────────────

export function FinanceSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
      ))}
    </div>
  )
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
      ))}
    </div>
  )
}

/**
 * Honest empty state. Finance pages must say "no data recorded" — never render
 * a zero as though it were a measured result.
 */
export function EmptyState({
  icon = '📊',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div
        className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-2xl"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      {description && <p className="text-xs text-slate-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}

/** Shown when a metric cannot be computed honestly yet. */
export function InsufficientData({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-4 text-xs text-slate-400"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}
    >
      {message}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function DataTable({
  columns,
  children,
  minWidth = 720,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[]
  children: ReactNode
  minWidth?: number
}) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`pb-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Money({ amount, currency, tone }: { amount: number; currency: string; tone?: 'pos' | 'neg' | 'auto' }) {
  const cls =
    tone === 'pos' ? 'text-green-400'
      : tone === 'neg' ? 'text-red-400'
      : tone === 'auto' ? (amount >= 0 ? 'text-green-400' : 'text-red-400')
      : 'text-white'
  return <span className={`font-semibold ${cls}`}>{formatMoney(amount, currency)}</span>
}
