import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, Plus, Search, DollarSign, Clock, AlertTriangle,
  CheckCircle, Send, Download, TrendingUp, FileText,
} from 'lucide-react'
import { mockInvoices } from '../../data/mockData'
import { statusColors, formatCurrency, formatDate, getInitials } from '../../lib/utils'
import type { Invoice } from '../../types'

const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  draft: { label: 'Draft', icon: FileText, bg: 'rgba(100,116,139,0.2)', text: '#94A3B8' },
  sent: { label: 'Sent', icon: Send, bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  paid: { label: 'Paid', icon: CheckCircle, bg: 'rgba(16,185,129,0.15)', text: '#34D399' },
  overdue: { label: 'Overdue', icon: AlertTriangle, bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5' },
  cancelled: { label: 'Cancelled', icon: FileText, bg: 'rgba(71,85,105,0.2)', text: '#64748B' },
}

function InvoiceRow({ invoice, i }: { invoice: Invoice; i: number }) {
  const cfg = statusConfig[invoice.status] ?? statusConfig.draft
  const StatusIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-white/[0.02] transition-colors group"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

      {/* Invoice number */}
      <div className="flex-shrink-0 w-36">
        <p className="text-xs font-bold text-white">{invoice.invoiceNumber}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Issued {formatDate(invoice.issuedDate)}</p>
      </div>

      {/* Client */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
          {getInitials(invoice.clientName)}
        </div>
        <span className="text-sm text-white truncate">{invoice.clientName}</span>
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
        <p className="text-xs text-slate-400">{formatDate(invoice.dueDate)}</p>
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
        {invoice.status === 'draft' && (
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function BillingPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const totalPaid = mockInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalPending = mockInvoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0)
  const totalOverdue = mockInvoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0)

  const filtered = mockInvoices.filter((inv) => {
    const matchSearch = inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || inv.status === filter.toLowerCase()
    return matchSearch && matchFilter
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Billing & Invoices</h1>
          <p className="text-slate-400 text-sm mt-1">{mockInvoices.length} invoices total</p>
        </div>
        <button className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: CheckCircle, label: 'Collected This Month', value: formatCurrency(totalPaid), color: '#10B981', sub: `${mockInvoices.filter((i) => i.status === 'paid').length} invoices` },
          { icon: Clock, label: 'Pending Payment', value: formatCurrency(totalPending), color: '#3B82F6', sub: `${mockInvoices.filter((i) => i.status === 'sent').length} outstanding` },
          { icon: AlertTriangle, label: 'Overdue', value: formatCurrency(totalOverdue), color: '#EF4444', sub: `${mockInvoices.filter((i) => i.status === 'overdue').length} invoices` },
          { icon: TrendingUp, label: 'Total Invoiced', value: formatCurrency(mockInvoices.reduce((s, i) => s + i.total, 0)), color: '#8B5CF6', sub: 'All time' },
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
      {totalOverdue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300">
            <strong>Invoice overdue:</strong> Desert Palm Hotel — EZ-2024-0044 ({formatCurrency(3052)}) is 5+ days past due.
          </span>
          <button className="ml-auto text-xs text-red-400 hover:text-red-300 font-medium whitespace-nowrap">Send Reminder →</button>
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

      {/* Table header */}
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
            <InvoiceRow key={inv.id} invoice={inv} i={i} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No invoices found.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
