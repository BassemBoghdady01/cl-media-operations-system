/**
 * EZ Marketing Agency — In-layout page error state
 *
 * Rendered inside an existing layout when a page's data load fails. Keeps the
 * sidebar/header intact so a single failing query never takes down the shell.
 * Full-screen failures use FullScreenMessage instead.
 */

interface PageErrorStateProps {
  title?: string
  message?: string | null
  onRetry?: () => void
}

export default function PageErrorState({
  title = "We couldn't load this page",
  message,
  onRetry,
}: PageErrorStateProps) {
  const isDev = import.meta.env.DEV

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div
        className="w-12 h-12 rounded-2xl mb-5 flex items-center justify-center text-2xl"
        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}
      >
        ⚠️
      </div>

      <h2 className="text-lg font-black text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        The data for this page could not be loaded. This is usually temporary — retry, or
        refresh the page. If it keeps happening, contact your administrator.
      </p>

      {/* Error text is shown in development only — never leak internals in production. */}
      {isDev && message && (
        <pre
          className="text-[11px] text-red-400 rounded-xl p-3.5 mb-6 max-w-lg overflow-x-auto whitespace-pre-wrap break-words text-left"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {message}
        </pre>
      )}

      {onRetry && (
        <button className="btn-primary justify-center py-2.5 px-5" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
