/**
 * EZ Marketing Agency — Full-screen state shells
 *
 * Every non-rendering auth/route outcome resolves to one of these instead of a
 * blank screen. Shared so the loader, setup, error and denied states all look
 * like one system.
 */

import type { ReactNode } from 'react'

const SHELL = 'min-h-screen flex items-center justify-center px-6 py-12 relative'
const BG = { background: '#04081A' }

function LogoTile({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-9 h-9 text-base rounded-xl' : 'w-12 h-12 text-lg rounded-2xl'
  return (
    <div
      className={`${dim} flex items-center justify-center font-black text-white flex-shrink-0`}
      style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
    >
      EZ
    </div>
  )
}

/** Spinner shown while auth is resolving. */
export function FullScreenLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className={SHELL} style={BG}>
      <div className="flex flex-col items-center gap-4">
        <LogoTile />
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

interface FullScreenMessageProps {
  icon?: ReactNode
  tone?: 'error' | 'warning' | 'info'
  title: string
  description: ReactNode
  /** Optional monospace detail block (diagnostics, error text) */
  details?: string | null
  children?: ReactNode
}

const TONES = {
  error: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)', text: 'text-red-400' },
  warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', text: 'text-amber-400' },
  info: { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)', text: 'text-blue-400' },
} as const

/** Terminal state with a title, explanation and action buttons. */
export function FullScreenMessage({
  icon,
  tone = 'info',
  title,
  description,
  details,
  children,
}: FullScreenMessageProps) {
  const t = TONES[tone]
  return (
    <div className={SHELL} style={BG}>
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="w-full max-w-lg relative">
        <div className="flex items-center gap-3 mb-8">
          <LogoTile size="sm" />
          <span className="text-[15px] font-bold text-white">EZ Marketing Agency</span>
        </div>

        <div className="glass-blue rounded-2xl p-7">
          <div
            className="w-12 h-12 rounded-2xl mb-5 flex items-center justify-center text-2xl"
            style={{ background: t.bg, border: `1px solid ${t.border}` }}
          >
            {icon ?? '⚠️'}
          </div>

          <h1 className="text-xl font-black text-white mb-2">{title}</h1>
          <div className="text-sm text-slate-400 leading-relaxed mb-6">{description}</div>

          {details && (
            <pre
              className={`text-[11px] ${t.text} rounded-xl p-3.5 mb-6 overflow-x-auto whitespace-pre-wrap break-words`}
              style={{ background: t.bg, border: `1px solid ${t.border}` }}
            >
              {details}
            </pre>
          )}

          {children && <div className="flex flex-col sm:flex-row gap-3">{children}</div>}
        </div>
      </div>
    </div>
  )
}
