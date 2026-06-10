import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Building2, Users, Bell, Palette, Globe, Shield,
  Zap, CreditCard, Check, ChevronRight, Upload, Plus, Trash2,
  Eye, EyeOff, Save,
} from 'lucide-react'

const settingsTabs = [
  { id: 'agency', label: 'Agency Profile', icon: Building2 },
  { id: 'team', label: 'Team & Roles', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
]

const integrations = [
  { name: 'Meta (Facebook & Instagram)', desc: 'Auto-post to Instagram and Facebook pages', icon: '📘', connected: false, soon: false },
  { name: 'TikTok Business', desc: 'Schedule and publish TikTok videos', icon: '🎵', connected: false, soon: false },
  { name: 'YouTube', desc: 'Upload and schedule YouTube content', icon: '📹', connected: false, soon: false },
  { name: 'LinkedIn', desc: 'Publish posts to company LinkedIn pages', icon: '💼', connected: false, soon: false },
  { name: 'WhatsApp Business API', desc: 'Send automated delivery notifications to clients', icon: '💬', connected: false, soon: true },
  { name: 'Stripe', desc: 'Accept online invoice payments', icon: '💳', connected: false, soon: true },
  { name: 'Google Drive', desc: 'Sync files and folders with Drive', icon: '🗂️', connected: false, soon: true },
  { name: 'Dropbox', desc: 'Import raw footage from Dropbox', icon: '📦', connected: false, soon: true },
  { name: 'OpenAI', desc: 'Power AI Studio features', icon: '🤖', connected: true, soon: false },
]

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ label, desc, defaultValue = false }: { label: string; desc?: string; defaultValue?: boolean }) {
  const [on, setOn] = useState(defaultValue)
  return (
    <div className="flex items-center justify-between py-3.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <p className="text-sm text-white">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className="relative w-10 h-5.5 rounded-full transition-all flex-shrink-0"
        style={{ background: on ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' : 'rgba(255,255,255,0.1)', minWidth: 40, height: 22 }}>
        <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transition-all duration-300 ${on ? 'left-[calc(100%-20px)]' : 'left-0.5'}`}
          style={{ width: 18, height: 18 }} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('agency')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your agency profile, team, and preferences</p>
        </div>
        <button onClick={handleSave}
          className={`btn-primary text-sm transition-all ${saved ? 'bg-green-500' : ''}`}
          style={saved ? { background: '#10B981' } : {}}>
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => setActiveTab(id)}
              className={`nav-item w-full text-left ${activeTab === id ? 'active' : ''}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {activeTab === id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3">

          {activeTab === 'agency' && (
            <motion.div key="agency" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Agency Information" desc="Your public agency profile details">
                <div className="flex items-center gap-5 mb-6 p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>CL</div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">CL</p>
                    <button className="btn-secondary text-xs py-1.5 px-3">
                      <Upload className="w-3 h-3" /> Upload Logo
                    </button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: 'Agency Name', value: 'CL', type: 'text' },
                    { label: 'Email', value: 'contact@cl.agency', type: 'email' },
                    { label: 'Phone', value: '+20 100 000 0000', type: 'tel' },
                    { label: 'Website', value: 'cl.agency', type: 'text' },
                    { label: 'Country', value: 'Egypt', type: 'text' },
                    { label: 'City', value: 'Cairo', type: 'text' },
                  ].map(({ label, value, type }) => (
                    <div key={label}>
                      <label className="text-[11px] text-slate-400 mb-1.5 block">{label}</label>
                      <input className="input py-2.5 text-sm" type={type} defaultValue={value} />
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Agency Description">
                <textarea className="input resize-none h-24 text-sm"
                  defaultValue="CL is a premium content production agency specializing in video, reels, and social media content for brands across Egypt and MENA." />
              </Section>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div key="notifs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="In-App Notifications" desc="Control which notifications appear in your dashboard">
                {[
                  { label: 'Client approved a video', defaultValue: true },
                  { label: 'Client requested a revision', defaultValue: true },
                  { label: 'Video awaiting your review', defaultValue: true },
                  { label: 'Invoice overdue alert', defaultValue: true },
                  { label: 'Package limit reached (85%+)', defaultValue: true },
                  { label: 'Shooting day reminder (24h before)', defaultValue: true },
                  { label: 'Task assigned to me', defaultValue: true },
                  { label: 'New comment on video', defaultValue: false },
                  { label: 'File uploaded by team member', defaultValue: false },
                ].map(({ label, defaultValue }) => (
                  <ToggleSwitch key={label} label={label} defaultValue={defaultValue} />
                ))}
              </Section>
              <Section title="Email Notifications" desc="Daily and weekly email digests">
                {[
                  { label: 'Daily summary email', desc: 'Videos due today, pending approvals, urgent tasks' },
                  { label: 'Weekly performance report', desc: 'Videos delivered, revenue, team stats' },
                  { label: 'Invoice reminders', desc: 'When invoices become overdue' },
                ].map(({ label, desc }) => (
                  <ToggleSwitch key={label} label={label} desc={desc} defaultValue />
                ))}
              </Section>
            </motion.div>
          )}

          {activeTab === 'integrations' && (
            <motion.div key="integrations" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Platform Integrations" desc="Connect CL to your tools and social platforms">
                <div className="space-y-3">
                  {integrations.map(({ name, desc, icon, connected, soon }) => (
                    <div key={name}
                      className={`flex items-center gap-4 p-4 rounded-xl ${soon ? 'opacity-60' : ''}`}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-2xl flex-shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{name}</p>
                          {soon && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-purple-400"
                              style={{ background: 'rgba(139,92,246,0.15)' }}>SOON</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
                      </div>
                      {!soon && (
                        <button
                          className={connected ? 'btn-secondary text-xs py-2 px-4' : 'btn-primary text-xs py-2 px-4'}
                          style={connected ? { color: '#34D399', borderColor: 'rgba(16,185,129,0.3)' } : {}}>
                          {connected ? <><Check className="w-3 h-3" /> Connected</> : 'Connect'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {activeTab === 'branding' && (
            <motion.div key="branding" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Brand Colors" desc="These colors are used in client portal and reports">
                <div className="flex flex-wrap gap-3 mb-5">
                  {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'].map((c) => (
                    <button key={c} className="w-9 h-9 rounded-xl transition-all hover:scale-110"
                      style={{ background: c, boxShadow: `0 0 12px ${c}40` }} />
                  ))}
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all"
                    style={{ border: '2px dashed rgba(255,255,255,0.15)' }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </Section>
              <Section title="Client Portal Settings" desc="Customize how clients see your portal">
                {[
                  { label: 'Show your agency branding in client portal', defaultValue: true },
                  { label: 'Allow clients to download final videos', defaultValue: true },
                  { label: 'Allow clients to request revisions directly', defaultValue: true },
                  { label: 'Show package usage to clients', defaultValue: true },
                  { label: 'Show invoice history to clients', defaultValue: false },
                ].map(({ label, defaultValue }) => (
                  <ToggleSwitch key={label} label={label} defaultValue={defaultValue} />
                ))}
              </Section>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Change Password">
                <div className="space-y-4 max-w-md">
                  {['Current password', 'New password', 'Confirm new password'].map((l) => (
                    <div key={l}>
                      <label className="text-[11px] text-slate-400 mb-1.5 block">{l}</label>
                      <input className="input py-2.5 text-sm" type="password" placeholder="••••••••" />
                    </div>
                  ))}
                  <button className="btn-primary text-sm py-2.5 px-6">Update Password</button>
                </div>
              </Section>
              <Section title="Two-Factor Authentication" desc="Add an extra layer of security to your account">
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">Authenticator App</p>
                    <p className="text-xs text-slate-500 mt-0.5">Use an app like Google Authenticator</p>
                  </div>
                  <button className="btn-primary text-xs py-2 px-4">Enable 2FA</button>
                </div>
              </Section>
              <Section title="Active Sessions">
                <div className="space-y-2">
                  {[
                    { device: 'Chrome on Windows 11', location: 'Cairo, Egypt', current: true, time: 'Now' },
                    { device: 'Safari on iPhone 15', location: 'Cairo, Egypt', current: false, time: '2 hours ago' },
                  ].map(({ device, location, current, time }) => (
                    <div key={device} className="flex items-center justify-between p-3.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white">{device}</p>
                          {current && <span className="text-[10px] text-green-400 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(16,185,129,0.12)' }}>Current</span>}
                        </div>
                        <p className="text-[11px] text-slate-500">{location} · {time}</p>
                      </div>
                      {!current && (
                        <button className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div key="billing" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Current Plan">
                <div className="p-5 rounded-xl glow-border mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-5 h-5 text-blue-400" />
                        <span className="text-base font-black gradient-text">Growth Plan</span>
                      </div>
                      <p className="text-xs text-slate-400">Up to 10 clients · Unlimited videos · AI Studio · Client portal</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-white">$149</p>
                      <p className="text-xs text-slate-500">/month</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Renews June 1, 2024</span>
                    <button className="text-blue-400 hover:text-blue-300 transition-colors">Upgrade to Enterprise →</button>
                  </div>
                </div>
              </Section>
              <Section title="Usage This Month">
                {[
                  { label: 'Active Clients', used: 6, total: 10 },
                  { label: 'Team Members', used: 5, total: 15 },
                  { label: 'Storage Used', used: 25, total: 100, unit: 'GB' },
                  { label: 'AI Credits', used: 340, total: 1000 },
                ].map(({ label, used, total, unit = '' }) => {
                  const pct = Math.round((used / total) * 100)
                  return (
                    <div key={label} className="mb-3">
                      <div className="flex justify-between mb-1 text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white font-semibold">{used}{unit}/{total}{unit}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </Section>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-blue rounded-2xl p-6">
              <Section title="Team Members" desc="Manage access and roles for your team">
                <button className="btn-primary text-xs py-2 px-4 mb-4">
                  <Plus className="w-3.5 h-3.5" /> Invite Member
                </button>
                <div className="space-y-2">
                  {[
                    { name: 'Bassem Mahmoud', email: 'bassem@cl.agency', role: 'Admin', you: true },
                    { name: 'Layla Kamal', email: 'layla@cl.agency', role: 'Project Manager', you: false },
                    { name: 'Omar Tarek', email: 'omar@cl.agency', role: 'Video Editor', you: false },
                    { name: 'Nour Ibrahim', email: 'nour@cl.agency', role: 'Video Editor', you: false },
                    { name: 'Ahmed Samir', email: 'ahmed@cl.agency', role: 'Social Media Manager', you: false },
                  ].map(({ name, email, role, you }) => (
                    <div key={email}
                      className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                        {name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{name}</p>
                          {you && <span className="text-[10px] text-blue-400 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(59,130,246,0.12)' }}>You</span>}
                        </div>
                        <p className="text-[11px] text-slate-500">{email}</p>
                      </div>
                      <select className="input py-1.5 text-xs w-auto" defaultValue={role}>
                        <option>Admin</option>
                        <option>Project Manager</option>
                        <option>Video Editor</option>
                        <option>Social Media Manager</option>
                        <option>Client Success</option>
                        <option>Accountant</option>
                      </select>
                      {!you && (
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
