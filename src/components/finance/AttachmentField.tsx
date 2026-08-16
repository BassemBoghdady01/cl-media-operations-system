/**
 * EZ Marketing Agency — Attachment field (receipts, payment proofs)
 *
 * Controlled upload widget for the private `finance-attachments` bucket.
 * Stores a `storage:` reference through onChange; viewing resolves a short-lived
 * signed URL on demand. Never renders a public URL.
 */

import { useRef, useState } from 'react'
import { ExternalLink, Loader2, Paperclip, Upload, X } from 'lucide-react'
import { financeService } from '../../services/financeService'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB

interface AttachmentFieldProps {
  agencyId: string
  entity: string
  value: string | null
  onChange: (ref: string | null) => void
  disabled?: boolean
}

/** Human-ish file name out of a `storage:agency/entity/1712345678901-name.pdf` ref. */
function fileNameFromRef(ref: string): string {
  const last = ref.split('/').pop() ?? ref
  return last.replace(/^\d{10,}-/, '') || 'Attachment'
}

export default function AttachmentField({
  agencyId, entity, value, onChange, disabled = false,
}: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<'upload' | 'open' | 'remove' | null>(null)
  const [error, setError] = useState('')

  const pick = (f: File | null) => {
    setError('')
    if (f && f.size > MAX_FILE_BYTES) {
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      setError('File is larger than 20MB — please choose a smaller file.')
      return
    }
    setFile(f)
  }

  const upload = async () => {
    if (!file || busy) return
    if (!agencyId) { setError('No workspace selected.'); return }
    setBusy('upload'); setError('')
    try {
      const ref = await financeService.uploadAttachment(agencyId, entity, file)
      onChange(ref)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  const view = async () => {
    if (!value || busy) return
    setBusy('open'); setError('')
    try {
      const url = await financeService.attachmentUrl(value)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the attachment.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!value || busy || disabled) return
    setBusy('remove'); setError('')
    try {
      await financeService.deleteAttachment(value)
      onChange(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the attachment.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {value ? (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 truncate flex-1" title={fileNameFromRef(value)}>
            {fileNameFromRef(value)}
          </span>
          <button
            type="button" onClick={view} disabled={busy !== null}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 disabled:opacity-50"
          >
            {busy === 'open'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Opening…</>
              : <><ExternalLink className="w-3 h-3" /> View</>}
          </button>
          {!disabled && (
            <button
              type="button" onClick={remove} disabled={busy !== null}
              title="Remove attachment"
              className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            disabled={disabled || busy !== null}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="input py-1.5 text-xs flex-1 min-w-0 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-slate-200"
          />
          <button
            type="button"
            onClick={upload}
            disabled={disabled || !file || busy !== null}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
          >
            {busy === 'upload'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
              : <><Upload className="w-3.5 h-3.5" /> Upload</>}
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
    </div>
  )
}
