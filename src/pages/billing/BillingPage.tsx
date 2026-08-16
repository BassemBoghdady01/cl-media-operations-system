import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, Plus, Search, Clock, AlertTriangle,
  CheckCircle, Send, Download, TrendingUp, FileText,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { invoiceService } from '../../services/invoiceService'
import { formatCurrency, formatDate, getInitials } from '../../lib/utils'
import type { Invoice } from '../../types'

const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  draft: { label: 'Draft', icon: FileText, bg: 'rgba(100,116,139,0.2)', text: '#94A3B8' },
  sent: { label: 'Sent', icon: Send, bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  paid: { label: 'Paid', icon: CheckCircle, bg: 'rgba(16,185,129,0.15)', text: '#34D399' },
  overdue: { label: 'Overdue', icon: AlertTriangle, bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5' },
  cancelled: { label: 'Cancelled', icon: FileText, bg: 'rgba(71,85,105,0.2)', text: '#64748B' },
}

function InvoiceRow({
  invoice, i, onMarkPaid, marking,
}: { invoice: Invoice; i: number; onMarkPaid: (invoice: Invoice) => void; marking: boolean }) {
  const cfg = statusConfig[invoice.status] ?? statusConfig.draft
  const StatusIcon = cfg.icon
  const canMarkPaid = invoice.status === 'sent' || invoice.status === 'overdue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.05, 0.6) }}
      className="flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-white/[0.02] transition-colors group"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

      {/* Invoice number */}
      <div className="flex-shrink-0 w-36">
        <p className="text-xs font-bold text-white">{invoice.invoiceNumber}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {invoice.issuedDate ? `Issued ${formatDate(invoice.issuedDate)}` : 'Not issued'}
        </p>
      </div>

      {/* Client */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
          {getInitials(invoice.clientName || '—')}
        </div>
        <span className="text-sm text-white truncate">{invoice.clientName || '—'}</span>
      </div>

      {/* Amount */}
      <div className="text-right w-24 flex-shrink-0">
        <p className="text-sm font-black text-white">{formatCurrency(invoice.total)}</p>
        {invoice.discount > 0 && (
          <p className="text-[10px] text-green-400">-{formatCurrency(invoice.discount)} disc.</p>
        )}
      </div>

      {/* Due date */}
      <div className="w-24 flex-shrink-0 hidden md:block">
        <p className="text-xs text-slate-400">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
        {invoice.paidDate && (
          <p className="text-[10px] text-green-400">Paid {formatDate(invoice.paidDate)}</p>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-24">
        <span className="badge" style={{ background: cfg.bg, color: cfg.text }}>
          <StatusIcon className="w-2.5 h-2.5" />
          {cfg.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all">
          <Download className="w-3.5 h-3.5" />
        </button>
        {canMarkPaid && (
          <button
            title="Mark as paid"
            disabled={marking}
            onClick={() => onMarkPaid(invoice)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50">
            <CheckCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function BillingPage() {
  const { user, agency } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await invoiceService.getAll(agencyId)
        if (cancelled) return
        setInvoices(rows)
      } catch (err) {
        if (cancelled) return
        console.error('[BillingPage] load failed', err)
        setError(err instanceof Error ? err.message : 'Could not load invoices.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [agencyId, reloadKey])

  const markPaid = async (invoice: Invoice) => {
    setMarkingId(invoice.id)
    const previous = invoices
    const todayStr = new Date().toISOString().slice(0, 10)
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: 'paid', paidDate: todayStr } : inv))
    )
    try {
      await invoiceService.markPaid(invoice.id)
    } catch (err) {
      console.error('[BillingPage] markPaid failed', err)
      setInvoices(previous)
    } finally {
      setMarkingId(null)
    }
  }

  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const sentInvoices = invoices.filter((i) => i.status === 'sent')
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
  const totalPaid = paidInvoices.reduce((s, i) => s + i.total, 0)
  const totalPending = sentInvoices.reduce((s, i) => s + i.total, 0)
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total, 0)

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || inv.status === filter.toLowerCase()
    return matchSearch && matchFilter
  })

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageErrorState
          title="We couldn't load your invoices"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Billing & Invoices</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading invoices…' : `${invoices.length} invoices total`}
          </p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: CheckCircle, label: 'Collected', value: formatCurrency(totalPaid), color: '#10B981', sub: `${paidInvoices.length} invoices` },
              { icon: Clock, label: 'Pending Payment', value: formatCurrency(totalPending), color: '#3B82F6', sub: `${sentInvoices.length} outstanding` },
              { icon: AlertTriangle, label: 'Overdue', value: formatCurrency(totalOverdue), color: '#EF4444', sub: `${overdueInvoices.length} invoices` },
              { icon: TrendingUp, label: 'Total Invoiced', value: formatCurrency(invoices.reduce((s, i) => s + i.total, 0)), color: '#8B5CF6', sub: 'All time' },
            ].map(({ icon: Icon, label, value, color, sub }) => (
              <motion.div key={label} whileHover={{ y: -2 }}
                className="glass-blue rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-8" style={{ background: color }} />
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <div className="text-xl font-black text-white mb-0.5">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Overdue alert */}
          {overdueInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300">
                <strong>{overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? 's' : ''} overdue</strong>
                {' '}totaling {formatCurrency(totalOverdue)} — {overdueInvoices.map((i) => i.invoiceNumber).join(', ')}.
              </span>
            </motion.div>
          )}

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input className="input pl-9 py-2 text-xs" placeholder="Search invoices…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {['All', 'Paid', 'Sent', 'Overdue', 'Draft'].map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className="px-4 py-2 text-xs font-medium transition-all"
                  style={{ background: filter === s ? 'rgba(59,130,246,0.2)' : 'transparent', color: filter === s ? '#60A5FA' : '#64748B' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="glass-blue rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-36">Invoice #</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex-1">Client</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-24 text-right">Amount</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-24 hidden md:block">Due Date</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide w-24">Status</span>
              <span className="w-16" />
            </div>
            <div>
              {filtered.map((inv, i) => (
                <InvoiceRow key={inv.id} invoice={inv} i={i}
                  onMarkPaid={markPaid} marking={markingId === inv.id} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <CreditCard className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    {invoices.length === 0 ? 'No invoices yet — invoices you create will appear here.' : 'No invoices match your filters.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
