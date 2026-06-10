import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#04081A' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col ml-[220px] min-w-0">
        <Navbar />

        <main className="flex-1 overflow-y-auto">
          {/* Subtle ambient background */}
          <div className="fixed inset-0 ml-[220px] pointer-events-none z-0"
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
