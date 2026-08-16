/**
 * EZ Marketing Agency — Finance formatting helpers
 *
 * Currency is never mixed. Every total the UI shows carries its own currency
 * code, because the ledger stores per-transaction currency and there is no
 * exchange-rate table yet (see FINANCE_MODULE.md → Multi-currency).
 */

export const SUPPORTED_CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED'] as const
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

const LOCALE = 'en-EG'

export function formatMoney(amount: number | null | undefined, currency = 'EGP'): string {
  const value = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    // Unknown currency code — fall back to a plain number plus the code.
    return `${value.toLocaleString(LOCALE)} ${currency}`
  }
}

/** Compact form for KPI tiles: 1.2M, 340K. */
export function formatCompact(amount: number | null | undefined, currency = 'EGP'): string {
  const value = Number(amount ?? 0)
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${currency}`
  if (abs >= 10_000) return `${Math.round(value / 1_000)}K ${currency}`
  return formatMoney(value, currency)
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits)}%`
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(LOCALE, { month: 'short', year: '2-digit' })
}

/** Percentage change between two periods. Returns null when there is no base. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Draft',          color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  expected:       { label: 'Expected',       color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  pending:        { label: 'Pending',        color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  approved:       { label: 'Approved',       color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  paid:           { label: 'Paid',           color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  partially_paid: { label: 'Partial',        color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  overdue:        { label: 'Overdue',        color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  cancelled:      { label: 'Cancelled',      color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  refunded:       { label: 'Refunded',       color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
  active:         { label: 'Active',         color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  paused:         { label: 'Paused',         color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  expired:        { label: 'Expired',        color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  invoiced:       { label: 'Invoiced',       color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  written_off:    { label: 'Written off',    color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  pending_approval: { label: 'Pending approval', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  held:           { label: 'Held',           color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
  open:           { label: 'Open',           color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  closed:         { label: 'Closed',         color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
}

/** Convert rows to CSV. Values containing commas/quotes are escaped. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return ''
  const cols = columns ?? Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
