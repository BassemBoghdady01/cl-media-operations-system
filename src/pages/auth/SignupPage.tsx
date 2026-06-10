import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, User, Building2, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const steps = ['Agency Info', 'Your Account', 'Use Case']

export default function SignupPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    agencyName: '', name: '', email: '', password: '',
    companyType: '', teamSize: '', useCase: '',
  })

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleFinish = async () => {
    setLoading(true)
    await login(form.email || 'admin@cl.agency', form.password || 'dactrah123')
    setTimeout(() => navigate('/app/dashboard'), 600)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative"
      style={{ background: '#04081A' }}>
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
      <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full blur-[80px] opacity-8 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            CL
          </div>
          <span className="text-[15px] font-bold text-white">CL</span>
        </Link>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[11px] font-medium transition-colors hidden sm:block ${i === step ? 'text-white' : 'text-slate-600'}`}>{s}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px transition-all duration-300 ${i < step ? 'bg-green-500' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        <div className="glass-blue rounded-2xl p-7">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-xl font-black text-white mb-1">Set up your agency</h2>
              <p className="text-slate-400 text-sm mb-6">Tell us about your production company</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Agency / Company name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-10" placeholder="Your Agency Name" value={form.agencyName} onChange={(e) => update('agencyName', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Company type</label>
                  <select className="input" value={form.companyType} onChange={(e) => update('companyType', e.target.value)}>
                    <option value="">Select type…</option>
                    <option>Content Agency</option>
                    <option>Video Production Company</option>
                    <option>Marketing Agency</option>
                    <option>Freelance Studio</option>
                    <option>Brand In-House Team</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Team size</label>
                  <select className="input" value={form.teamSize} onChange={(e) => update('teamSize', e.target.value)}>
                    <option value="">Select size…</option>
                    <option>Just me</option>
                    <option>2–5 people</option>
                    <option>6–15 people</option>
                    <option>16–50 people</option>
                    <option>50+ people</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary w-full justify-center mt-6 py-3" onClick={() => setStep(1)}>
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-xl font-black text-white mb-1">Create your account</h2>
              <p className="text-slate-400 text-sm mb-6">Your personal admin login</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Your full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-10" placeholder="Full Name" value={form.name} onChange={(e) => update('name', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Work email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-10" placeholder="you@agency.com" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-10" placeholder="Min. 8 characters" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn-secondary flex-1 justify-center py-3" onClick={() => setStep(0)}>Back</button>
                <button className="btn-primary flex-1 justify-center py-3" onClick={() => setStep(2)}>
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-xl font-black text-white mb-1">How will you use EZ?</h2>
              <p className="text-slate-400 text-sm mb-6">Helps us personalize your experience</p>
              <div className="space-y-2">
                {[
                  { id: 'reels', label: 'Producing Reels & Short Videos', icon: '🎬' },
                  { id: 'ads', label: 'Managing Client Ad Campaigns', icon: '📢' },
                  { id: 'podcast', label: 'Podcast & Long-Form Production', icon: '🎙️' },
                  { id: 'brand', label: 'Brand Content & Social Media', icon: '✨' },
                  { id: 'all', label: 'All of the Above', icon: '🚀' },
                ].map(({ id, label, icon }) => (
                  <label key={id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all ${form.useCase === id
                      ? 'border border-blue-500/50 bg-blue-500/10'
                      : 'border border-transparent hover:bg-white/[0.03]'
                    }`}>
                    <input type="radio" name="useCase" value={id} className="hidden"
                      checked={form.useCase === id} onChange={() => update('useCase', id)} />
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-slate-300 font-medium">{label}</span>
                    {form.useCase === id && <Check className="w-4 h-4 text-blue-400 ml-auto" />}
                  </label>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn-secondary flex-1 justify-center py-3" onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary flex-1 justify-center py-3" onClick={handleFinish} disabled={loading}>
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Launching…
                    </div>
                  ) : (
                    <><Zap className="w-4 h-4" /> Launch Dashboard</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
