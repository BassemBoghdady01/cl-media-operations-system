/**
 * EZ Marketing Agency — Finance formatting helpers
 *
 * Currency is never mixed. Every total the UI shows carries its own currency
 * code, because the ledger stores per-transaction currency and there is no
 * exchange-rate table yet (see FINANCE_MODULE.md → Multi-currency).
 */

export const SUPPORTED_CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED'] as const
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * Agency reporting currency (agency_finance_settings.base_currency).
 * Used only as the default for NEW records and for record types that have no
 * currency column at all (e.g. booking deposits). Never used to relabel a
 * record that carries its own currency.
 */
export const BASE_CURRENCY: CurrencyCode = 'EGP'

const LOCALE = 'en-EG'

/** Round to cents so float noise (0.1 + 0.2) never leaks into the UI. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string = BASE_CURRENCY,
  opts: { display?: 'symbol' | 'code' } = {},
): string {
  const value = roundCents(Number(amount ?? 0) || 0)
  const code = currency || BASE_CURRENCY
  const digits = value % 1 === 0 ? 0 : 2
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: code,
      // Codes by default ("EGP 10,000", "USD 200") — never a bare "$" that could be
      // mistaken for the agency's currency.
      currencyDisplay: opts.display ?? 'code',
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)
  } catch {
    // Unknown currency code — fall back to a plain number plus the code.
    return `${code} ${value.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`
  }
}

/** The currency a record is stored in. Falls back to the base currency only when the record has none. */
export function currencyOf(record: { currency?: string | null } | null | undefined): string {
  return record?.currency || BASE_CURRENCY
}

/** One currency's share of an aggregate. */
export interface MoneyGroup {
  currency: string
  amount: number
  count: number
}

/**
 * Sum amounts per currency. Amounts of different currencies are NEVER added
 * together. Groups are ordered base currency first, then by code.
 * `fallbackCurrency` applies only to items whose currency is empty — pass it
 * only for record types that genuinely have no currency column.
 */
export function sumByCurrency<T>(
  items: readonly T[],
  getAmount: (item: T) => number | null | undefined,
  getCurrency: (item: T) => string | null | undefined,
  fallbackCurrency: string = BASE_CURRENCY,
): MoneyGroup[] {
  const map = new Map<string, MoneyGroup>()
  for (const item of items) {
    const currency = (getCurrency(item) || fallbackCurrency).toUpperCase()
    const amount = Number(getAmount(item) ?? 0) || 0
    const g = map.get(currency) ?? { currency, amount: 0, count: 0 }
    g.amount = roundCents(g.amount + amount)
    g.count += 1
    map.set(currency, g)
  }
  return [...map.values()].sort((a, b) =>
    a.currency === BASE_CURRENCY ? -1 : b.currency === BASE_CURRENCY ? 1 : a.currency.localeCompare(b.currency))
}

/**
 * "EGP 10,000" or "EGP 10,000 · USD 200". Uses currency codes (not symbols)
 * so mixed totals are unambiguous. An empty list renders as zero in
 * `emptyCurrency` (the base currency by default).
 */
export function formatMoneyGroups(
  groups: readonly MoneyGroup[],
  emptyCurrency: string = BASE_CURRENCY,
  separator = ' · ',
): string {
  if (!groups.length) return formatMoney(0, emptyCurrency, { display: 'code' })
  return groups.map((g) => formatMoney(g.amount, g.currency, { display: 'code' })).join(separator)
}

/** Convenience: sumByCurrency + formatMoneyGroups in one call. */
export function formatMoneyTotal<T>(
  items: readonly T[],
  getAmount: (item: T) => number | null | undefined,
  getCurrency: (item: T) => string | null | undefined,
  fallbackCurrency: string = BASE_CURRENCY,
): string {
  return formatMoneyGroups(sumByCurrency(items, getAmount, getCurrency, fallbackCurrency), fallbackCurrency)
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
