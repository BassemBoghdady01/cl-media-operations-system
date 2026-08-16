import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { invoiceService } from '../../services/invoiceService'
import type { Invoice } from '../../types'
import { format, parseISO } from 'date-fns'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  paid:      { label: 'Paid', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  sent:      { label: 'Pending', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: <Clock className="w-3.5 h-3.5" /> },
  overdue:   { label: 'Overdue', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  draft:     { label: 'Draft', color: '#64748B', bg: 'rgba(100,116,139,0.1)', icon: <Clock className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', color: '#64748B', bg: 'rgba(100,116,139,0.1)', icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

export default function ClientInvoices() {
  const { user, profile } = useAuth()
  // Portal data is keyed by the linked client record, not the auth user id.
  const clientId = profile?.client_id ?? user?.id ?? ''
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoadError(null)
    invoiceService.getByClient(clientId).then((data) => {
      setInvoices(data)
      setLoading(false)
    })
      .catch((err) => {
        console.error('[ClientInvoices] data load failed', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.')
        setLoading(false)
      })
  }, [user])

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalPending = invoices.filter((i) => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0)

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white mb-1">Invoices</h1>
        <p className="text-sm text-slate-400">Your billing history and outstanding payments</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">Total Paid</div>
          <div className="text-xl font-black text-white">${totalPaid.toLocaleString()}</div>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: totalPending > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${totalPending > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)'}` }}>
          <div className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${totalPending > 0 ? 'text-red-500' : 'text-slate-600'}`}>
            Outstanding
          </div>
          <div className={`text-xl font-black ${totalPending > 0 ? 'text-red-400' : 'text-white'}`}>
            ${totalPending.toLocaleString()}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16 }}>
          <CreditCard className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice, i) => {
            const status = STATUS_CONFIG[invoice.status] ?? { label: invoice.status, color: '#64748B', bg: 'rgba(100,116,139,0.1)', icon: null }
            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: status.bg, color: status.color }}>
                  {status.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{invoice.invoiceNumber}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-slate-500">
                      Issued {format(parseISO(invoice.issuedDate), 'MMM d, yyyy')}
                    </span>
                    {invoice.dueDate && invoice.status !== 'paid' && (
                      <span className={`text-[11px] ${invoice.status === 'overdue' ? 'text-red-400' : 'text-slate-500'}`}>
                        Due {format(parseISO(invoice.dueDate), 'MMM d, yyyy')}
                      </span>
                    )}
                    {invoice.paidDate && (
                      <span className="text-[11px] text-emerald-500">
                        Paid {format(parseISO(invoice.paidDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white">${invoice.total.toLocaleString()}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>

                {invoice.status !== 'draft' && (
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-400 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
