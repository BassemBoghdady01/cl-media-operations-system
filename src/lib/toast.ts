/**
 * Minimal imperative toast — used by pages to confirm every async action.
 * No provider/context needed; safe to call from anywhere in the browser.
 */

type Tone = 'success' | 'error' | 'info'

const COLORS: Record<Tone, { border: string; text: string }> = {
  success: { border: 'rgba(52,211,153,0.4)', text: '#34D399' },
  error: { border: 'rgba(248,113,113,0.4)', text: '#F87171' },
  info: { border: 'rgba(96,165,250,0.4)', text: '#60A5FA' },
}

let container: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container
  container = document.createElement('div')
  container.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:360px;'
  document.body.appendChild(container)
  return container
}

export function toast(message: string, tone: Tone = 'info', durationMs = 4000): void {
  const el = document.createElement('div')
  const c = COLORS[tone]
  el.style.cssText =
    `background:rgba(8,13,32,0.96);border:1px solid ${c.border};color:${c.text};` +
    'padding:10px 14px;border-radius:12px;font-size:12px;font-weight:600;' +
    'box-shadow:0 12px 40px rgba(0,0,0,0.5);backdrop-filter:blur(10px);' +
    'transition:opacity .3s, transform .3s;opacity:0;transform:translateY(6px);' +
    'font-family:Inter,system-ui,sans-serif;line-height:1.4;word-break:break-word;'
  el.textContent = message
  ensureContainer().appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)' })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(6px)'
    setTimeout(() => el.remove(), 350)
  }, durationMs)
}

export const toastSuccess = (m: string) => toast(m, 'success')
export const toastError = (m: string) => toast(m, 'error', 6000)
