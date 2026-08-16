/**
 * EZ Marketing Agency — First-time setup checklist
 *
 * Optional guided setup at /app/onboarding. Every step's status is DETECTED
 * from real data (never assumed), loaded with Promise.allSettled so a
 * permission-denied query renders that step as unavailable — it can never take
 * down the page. "Skip for now" persists into agency_finance_settings.
 * Auto-detected completion always overrides a skip. Nothing here blocks the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Landmark, Briefcase, Tags, Users, UserPlus, Repeat,
  FolderKanban, CalendarClock, Wallet, Bell, CheckCircle2, ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { FinancePageHeader, Panel, FinanceSkeleton, EmptyState } from '../../components/finance/FinanceKit'
import { financeService, type FinanceSettings } from '../../services/financeService'
import { clientService } from '../../services/clientService'
import { userService } from '../../services/userService'
import { projectService } from '../../services/projectService'
import { subscriptionService } from '../../services/subscriptionService'
import { payrollService } from '../../services/payrollService'

// ─── Step model ───────────────────────────────────────────────────────────────

/** null = the count could not be established (permission denied / query failed). */
type Count = number | null

interface Counts {
  accounts: Count
  services: Count
  categories: Count
  team: Count
  clients: Count
  projects: Count
  subscriptions: Count
  recurring: Count
  payroll: Count
}

interface StepView {
  key: string
  icon: LucideIcon
  title: string
  description: string
  link: string
  done: boolean
  unavailable: boolean
  skipped: boolean
}

const EMPTY_COUNTS: Counts = {
  accounts: null, services: null, categories: null, team: null, clients: null,
  projects: null, subscriptions: null, recurring: null, payroll: null,
}

function settled(r: PromiseSettledResult<unknown[]>): Count {
  return r.status === 'fulfilled' ? r.value.length : null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, agency, hasPermission } = useAuth()
  const agencyId = user?.agencyId || agency?.id || ''

  const canSubscriptions = hasPermission('subscriptions.view')
  const canExpenses = hasPermission('finance.view_expenses')
  const canPayroll = hasPermission('finance.view_payroll')

  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [settings, setSettings] = useState<FinanceSettings | null>(null)
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!agencyId) { setLoading(false); return }
    setLoading(true)

    const unavailable = () => Promise.reject(new Error('unavailable'))

    const [accounts, services, categories, team, clients, projects, subs, recurring, payroll, cfg] =
      await Promise.allSettled([
        financeService.listAccounts(agencyId),
        financeService.listServices(agencyId),
        financeService.listCategories(agencyId),
        userService.listUsers(agencyId),
        clientService.getAll(agencyId),
        projectService.getAll(agencyId),
        canSubscriptions ? subscriptionService.list(agencyId) : unavailable(),
        canExpenses ? financeService.listRecurringExpenses(agencyId) : unavailable(),
        canPayroll ? payrollService.listCompensation(agencyId) : unavailable(),
        financeService.getSettings(agencyId),
      ])

    setCounts({
      accounts: settled(accounts),
      services: settled(services),
      categories: settled(categories),
      team: settled(team),
      clients: settled(clients),
      projects: settled(projects),
      subscriptions: settled(subs),
      recurring: settled(recurring),
      payroll: settled(payroll),
    })

    if (cfg.status === 'fulfilled') {
      const s = cfg.value as FinanceSettings | null
      setSettings(s)
      setSkipped(s?.onboarding_steps ?? {})
      setCompleted(!!s?.onboarding_completed)
    }

    setLoading(false)
  }, [agencyId, canSubscriptions, canExpenses, canPayroll])

  useEffect(() => { load() }, [load])

  // ─── Derived steps ──────────────────────────────────────────────────────────

  const steps = useMemo<StepView[]>(() => {
    const gt = (c: Count, min = 0) => c !== null && c > min

    const base: Omit<StepView, 'skipped'>[] = [
      {
        key: 'company', icon: Building2, title: 'Company profile',
        description: 'Confirm your agency name and workspace details.',
        link: '/app/settings', done: !!agency?.name, unavailable: false,
      },
      {
        key: 'accounts', icon: Landmark, title: 'Financial accounts',
        description: 'Add the bank accounts, wallets or cash boxes money moves through.',
        link: '/app/finance/settings', done: gt(counts.accounts), unavailable: counts.accounts === null,
      },
      {
        key: 'services', icon: Briefcase, title: 'Services',
        description: 'Define what you sell — production, social management, media buying.',
        link: '/app/finance/settings', done: gt(counts.services), unavailable: counts.services === null,
      },
      {
        key: 'categories', icon: Tags, title: 'Expense categories',
        description: 'Categorise costs so profitability and burn reports mean something.',
        link: '/app/finance/settings', done: gt(counts.categories), unavailable: counts.categories === null,
      },
      {
        key: 'team', icon: Users, title: 'Invite your team',
        description: 'Bring in teammates and give each one the right role.',
        link: '/app/users', done: gt(counts.team, 1), unavailable: counts.team === null,
      },
      {
        key: 'client', icon: UserPlus, title: 'Add your first client',
        description: 'Everything — projects, videos, invoices — hangs off a client record.',
        link: '/app/clients', done: gt(counts.clients), unavailable: counts.clients === null,
      },
      {
        key: 'subscription', icon: Repeat, title: 'Create a subscription',
        description: 'Set up recurring client billing so cycles and reminders run themselves.',
        link: '/app/finance/subscriptions',
        done: gt(counts.subscriptions), unavailable: !canSubscriptions || counts.subscriptions === null,
      },
      {
        key: 'project', icon: FolderKanban, title: 'Start your first project',
        description: 'Open a project under a client to organise the production work.',
        link: '/app/clients', done: gt(counts.projects), unavailable: counts.projects === null,
      },
      {
        key: 'recurring', icon: CalendarClock, title: 'Recurring expenses',
        description: 'Record rent, software and other fixed costs that repeat every month.',
        link: '/app/finance/settings',
        done: gt(counts.recurring), unavailable: !canExpenses || counts.recurring === null,
      },
      // Payroll is hidden entirely without finance.view_payroll — separation of duties.
      ...(canPayroll ? [{
        key: 'payroll', icon: Wallet, title: 'Payroll setup',
        description: 'Add employee compensation so monthly runs build themselves.',
        link: '/app/finance/payroll',
        done: gt(counts.payroll), unavailable: counts.payroll === null,
      }] : []),
    ]

    // Notifications: informational — done once anything else is done or skipped.
    const anyDone = base.some((s) => s.done || skipped[s.key])
    base.push({
      key: 'notifications', icon: Bell, title: 'Notifications',
      description: 'Payment reminders, approvals and renewals alert you automatically — nothing to configure.',
      link: '/app/notifications', done: anyDone, unavailable: false,
    })

    return base.map((s) => ({ ...s, skipped: !!skipped[s.key] }))
  }, [agency?.name, counts, skipped, canSubscriptions, canExpenses, canPayroll])

  const available = steps.filter((s) => !s.unavailable)
  const completedCount = available.filter((s) => s.done || s.skipped).length
  const progress = available.length ? Math.round((completedCount / available.length) * 100) : 0
  const allDone = available.length > 0 && completedCount === available.length

  // ─── Actions ────────────────────────────────────────────────────────────────

  const skipStep = async (key: string) => {
    if (!agencyId || savingKey) return
    setSavingKey(key); setActionError('')
    const next = { ...(settings?.onboarding_steps ?? {}), ...skipped, [key]: true }
    try {
      await financeService.updateSettings(agencyId, { onboarding_steps: next })
      setSkipped(next)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save your preference.')
    } finally {
      setSavingKey(null)
    }
  }

  const finishSetup = async () => {
    if (!agencyId || finishing) return
    setFinishing(true); setActionError('')
    try {
      await financeService.updateSettings(agencyId, { onboarding_completed: true })
      setCompleted(true)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not mark setup as complete.')
    } finally {
      setFinishing(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!agencyId) {
    return (
      <div>
        <FinancePageHeader title="Get started" />
        <Panel>
          <EmptyState icon="🏢" title="No workspace selected"
            description="Your account is not linked to an agency workspace yet." />
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <FinancePageHeader
        title="Get started"
        subtitle="A quick checklist to set up your workspace. Nothing is required — skip anything and come back later."
      />

      {loading ? (
        <Panel><FinanceSkeleton rows={8} /></Panel>
      ) : (
        <div className="space-y-5 max-w-3xl">
          {/* Progress */}
          <Panel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                {completedCount} of {available.length} steps complete
              </span>
              <span className="text-xs font-black text-white">{progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }}
              />
            </div>
            {completed && (
              <p className="text-[11px] text-green-400 mt-3">
                ✓ Setup is marked as finished. You can still complete any remaining steps below.
              </p>
            )}
          </Panel>

          {actionError && (
            <div className="px-3 py-2.5 rounded-xl text-xs text-red-400"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {actionError}
            </div>
          )}

          {/* Steps */}
          <Panel>
            <div className="divide-y divide-white/5">
              {steps.map((step) => {
                const Icon = step.icon
                const complete = step.done || step.skipped
                return (
                  <div key={step.key} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: step.done ? 'rgba(52,211,153,0.10)' : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${step.done ? 'rgba(52,211,153,0.25)' : 'rgba(59,130,246,0.18)'}`,
                      }}
                    >
                      {step.done
                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                        : <Icon className={`w-4 h-4 ${step.unavailable ? 'text-slate-600' : 'text-blue-400'}`} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${step.done ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>
                          {step.title}
                        </span>
                        {step.done && (
                          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Done</span>
                        )}
                        {!step.done && step.skipped && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Skipped</span>
                        )}
                        {step.unavailable && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-slate-500"
                            style={{ background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.18)' }}>
                            Unavailable for your role
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!complete && !step.unavailable && (
                        <button
                          onClick={() => skipStep(step.key)}
                          disabled={savingKey !== null}
                          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                        >
                          {savingKey === step.key ? 'Saving…' : 'Skip for now'}
                        </button>
                      )}
                      {!step.unavailable && (
                        <Link to={step.link} className="btn-secondary py-1.5 px-3 text-xs">
                          Go <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Finish */}
          {!completed && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-500">
                {allDone
                  ? 'Everything is set up — you are ready to run the agency.'
                  : 'You can finish now and come back to the remaining steps any time.'}
              </p>
              <button className="btn-primary py-2.5 px-5 text-sm" onClick={finishSetup} disabled={finishing}>
                {finishing ? 'Saving…' : 'Finish setup'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
