import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

/**
 * App shell.
 * Desktop (lg+): fixed 220px sidebar, content offset beside it — unchanged.
 * Mobile: sidebar becomes an off-canvas drawer (closed by default), opened by
 * the navbar hamburger, closed by backdrop tap / route change / Escape.
 * Body scroll locks while the drawer is open.
 */
export default function AppLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Route change closes the drawer.
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])

  // Escape closes; body scroll locks while open.
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileNavOpen])

  return (
    <div className="flex overflow-hidden" style={{ background: '#04081A', height: '100dvh' }}>
      {/* Mobile backdrop — below the drawer, above content */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMobileNavOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col ml-0 lg:ml-[220px] min-w-0">
        <Navbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Subtle ambient background */}
          <div className="fixed inset-0 lg:ml-[220px] pointer-events-none z-0"
            style={{
              background: 'radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.03) 0%, transparent 50%)',
            }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative z-10 min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
