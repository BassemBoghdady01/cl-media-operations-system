/**
 * EZ Marketing Agency — Settings
 *
 * PRODUCTION CONTRACT: every control on this page performs a real operation.
 * The demo-era sections (integrations, plan & billing, notification toggles,
 * branding colours, fake sessions/2FA, hardcoded team list) had no backend and
 * were removed — nothing here pretends to save.
 *
 *   • Agency profile  → agencies row via agencyService (settings.manage only)
 *   • My profile      → profiles row via userService.updateProfile + refresh()
 *   • Workspace       → links to the real admin pages the user can access
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, UserRound, Users, Shield, Wallet, ScrollText,
  Save, ChevronRight, Lock,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PageErrorState from '../../components/system/PageErrorState'
import { toastSuccess, toastError } from '../../lib/toast'
import { agencyService, type AgencyInfo } from '../../services/agencyService'
import { userService } from '../../services/userService'

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 last:mb-0">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

// ─── Agency profile (settings.manage) ────────────────────────────────────────

function AgencyProfileTab() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''
  const canManage = hasPermission('settings.manage')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '' })

  const load = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    setLoadError(null)
    try {
      const a: AgencyInfo | undefined = await agencyService.getAgency(agencyId)
      setForm({
        name: a?.name ?? '',
        email: a?.email ?? '',
        phone: a?.phone ?? '',
        website: a?.website ?? '',
      })
    } catch (err) {
      console.error('[Settings] agency load failed', err)
      setLoadError(err instanceof Error ? err.message : 'Could not load agency details.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { load() }, [load])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) {
      setSaveError('Agency name cannot be empty.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await agencyService.updateAgency(agencyId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
      })
      toastSuccess('Agency profile saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save agency profile.'
      setSaveError(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return <PageErrorState title="We couldn't load your agency profile" message={loadError} onRetry={load} />
  }

  return (
    <div className="glass-blue rounded-2xl p-6">
      <Section title="Agency Information" desc="Contact details stored on your agency record">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <>
            {!canManage && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl text-xs text-slate-400"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                Only administrators can edit agency details.
              </div>
            )}

            {saveError && (
              <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {saveError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Agency Name">
                <input className="input py-2.5 text-sm" type="text" value={form.name}
                  onChange={set('name')} disabled={!canManage || saving} />
              </Field>
              <Field label="Email">
                <input className="input py-2.5 text-sm" type="email" value={form.email}
                  onChange={set('email')} disabled={!canManage || saving} />
              </Field>
              <Field label="Phone">
                <input className="input py-2.5 text-sm" type="tel" value={form.phone}
                  onChange={set('phone')} disabled={!canManage || saving} />
              </Field>
              <Field label="Website">
                <input className="input py-2.5 text-sm" type="text" value={form.website}
                  onChange={set('website')} disabled={!canManage || saving} placeholder="https://…" />
              </Field>
            </div>

            {canManage && (
              <button className="btn-primary text-sm py-2.5 px-6 mt-5" onClick={save} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save agency profile'}
              </button>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

// ─── My profile ──────────────────────────────────────────────────────────────

function MyProfileTab() {
  const { user, profile, refresh } = useAuth()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    job_title: profile?.job_title ?? '',
    department: profile?.department ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!user?.id) return
    if (!form.full_name.trim()) {
      setSaveError('Your name cannot be empty.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await userService.updateProfile(user.id, {
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim() || null,
        department: form.department.trim() || null,
      })
      await refresh() // so the navbar/sidebar reflect the new name immediately
      toastSuccess('Profile saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save your profile.'
      setSaveError(msg)
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-blue rounded-2xl p-6">
      <Section title="My Profile" desc="How your name appears across the workspace">
        {saveError && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {saveError}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Full Name">
            <input className="input py-2.5 text-sm" type="text" value={form.full_name}
              onChange={set('full_name')} disabled={saving} />
          </Field>
          <Field label="Email">
            <input className="input py-2.5 text-sm opacity-60" type="email"
              value={profile?.email ?? user?.email ?? ''} disabled readOnly
              title="Your sign-in email is managed by your administrator" />
          </Field>
          <Field label="Job Title">
            <input className="input py-2.5 text-sm" type="text" value={form.job_title}
              onChange={set('job_title')} disabled={saving} placeholder="e.g. Video Editor" />
          </Field>
          <Field label="Department">
            <input className="input py-2.5 text-sm" type="text" value={form.department}
              onChange={set('department')} disabled={saving} placeholder="e.g. Production" />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Your sign-in email and role are managed by an administrator in User Management.
        </p>

        <button className="btn-primary text-sm py-2.5 px-6 mt-4" onClick={save} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save profile'}
        </button>
      </Section>
    </div>
  )
}

// ─── Workspace links ─────────────────────────────────────────────────────────

function WorkspaceTab() {
  const { hasPermission } = useAuth()

  const links = [
    { to: '/app/team', label: 'Team', desc: 'View your team members and workload', icon: Users, show: true },
    { to: '/app/users', label: 'User Management', desc: 'Invite, edit and deactivate user accounts', icon: UserRound, show: hasPermission('users.view') },
    { to: '/app/roles', label: 'Roles & Permissions', desc: 'Control what each role can see and do', icon: Shield, show: hasPermission('users.manage_roles') },
    { to: '/app/finance/settings', label: 'Finance Settings', desc: 'Accounts, categories, services and finance preferences', icon: Wallet, show: hasPermission('finance.manage') },
    { to: '/app/audit', label: 'Audit Log', desc: 'Review sensitive actions across the workspace', icon: ScrollText, show: hasPermission('audit.view') },
  ].filter((l) => l.show)

  return (
    <div className="glass-blue rounded-2xl p-6">
      <Section title="Workspace Administration" desc="Team, access and finance configuration live on their own pages">
        <div className="space-y-2">
          {links.map(({ to, label, desc, icon: Icon }) => (
            <Link key={to} to={to}
              className="flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-white/[0.05] group"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'agency', label: 'Agency Profile', icon: Building2 },
  { id: 'profile', label: 'My Profile', icon: UserRound },
  { id: 'workspace', label: 'Workspace', icon: Users },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('agency')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your agency profile and personal details</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
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
          <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            {activeTab === 'agency' && <AgencyProfileTab />}
            {activeTab === 'profile' && <MyProfileTab />}
            {activeTab === 'workspace' && <WorkspaceTab />}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
