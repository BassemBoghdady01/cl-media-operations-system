import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    setError('')
    try {
      const { redirect } = await login(identifier, password)
      navigate(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#04081A' }}>

      {/* Left panel — Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-[100px] opacity-10"
            style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full blur-[80px] opacity-8"
            style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              CL
            </div>
            <div>
              <div className="text-[15px] font-bold text-white leading-tight">CL</div>
              <div className="text-[10px] text-slate-500 leading-tight">Media Operations System</div>
            </div>
          </Link>

          <h1 className="text-2xl font-black text-white mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-8">Sign in to your workspace</p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400 flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span>⚠️</span> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input pl-10"
                  placeholder="your@email.com"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Password</label>
                <button
                  type="button"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={() => setError('Contact your administrator to reset your password.')}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 mt-2">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </div>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-8">
            Need access?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
              Request an account
            </Link>
          </p>

          <p className="text-center text-[10px] text-slate-700 mt-4">
            CL Media Operations System · Secure workspace
          </p>
        </motion.div>
      </div>

      {/* Right panel — Brand panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 70%), rgba(6,13,31,0.95)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
        }}>
        <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none" />

        <div className="absolute top-1/4 right-1/3 w-64 h-64 rounded-full blur-[120px] opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full blur-[100px] opacity-6 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative">
          <div className="text-3xl font-black text-white leading-tight mb-4">
            "We replaced 6 tools
            <br />with <span className="gradient-text">one system</span>"
          </div>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            CL gave our team the clarity we were missing. Every video, every client, every deadline — visible in one place.
          </p>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>MK</div>
            <div>
              <div className="text-sm font-semibold text-white">Mona Khalil</div>
              <div className="text-xs text-slate-500">Head of Content, TechVision</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { val: '3×', label: 'Faster delivery' },
              { val: '90%', label: 'Less revisions' },
              { val: '100%', label: 'Package visibility' },
            ].map(({ val, label }) => (
              <div key={label} className="glass-blue rounded-xl p-4 text-center">
                <div className="text-2xl font-black gradient-text-blue">{val}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
