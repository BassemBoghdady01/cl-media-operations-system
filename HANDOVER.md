# EZ Marketing Agency — Media Operations System
## Client Handover Document

---

## What Was Built

A complete end-to-end **Media Operations Platform** for content agencies.

### Core Features

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI overview, activity feed, revenue charts, pipeline status |
| **Clients** | CRM with client profiles, status, portal access control |
| **Video Pipeline** | Full production workflow: Idea → Script → Shooting → Editing → Review → Approved → Posted |
| **Content Calendar** | Monthly calendar view with platform/status/client filters |
| **AI Studio** | Hook generator, script writer, caption generator, content ideas, campaign angles, calendar planner |
| **Asset Library** | Brand files organized by client and folder |
| **Packages** | Monthly retainer management with usage tracking |
| **Billing** | Invoice creation and payment tracking |
| **Team** | Team member management with availability and assignment |
| **Tasks** | Kanban-style task management with video/client linking |
| **Bookings** | Shoot scheduling with shot lists and team assignment |
| **Analytics** | Revenue, video status, and platform distribution charts |
| **Notifications** | Real in-app notifications (payment reminders, task deadlines, shoot reminders, review events) |
| **Client Portal** | Separate secure portal for clients to view their content, calendar, invoices, packages **and their own billing** |
| **Finance** | Full ERP finance layer: unified ledger, revenue/expenses, subscriptions & billing cycles, payment reminders, payroll, receivables, cash flow, profitability, P&L reports, expense approvals, monthly close, receipts storage — see `FINANCE_MODULE.md` |
| **User Management** | `/app/users` + `/app/roles`: invite/create users via a secure server API, change roles, deactivate, assign clients/projects, per-user permission overrides, full permission matrix — see `ROLES_AND_PERMISSIONS.md` |
| **Audit Log** | `/app/audit`: every sensitive change recorded by database triggers |

---

## User Roles

**21 canonical roles, 48 permissions** — the full model (levels, grants,
Super Admin protection, per-user overrides) is documented in
`ROLES_AND_PERMISSIONS.md` and visible in-app at `/app/roles`.
Highlights: `super_admin` (everything), `agency_admin` (everything except
payroll), `finance_manager` (full finance incl. payroll), `hr_manager`
(payroll + users, no revenue), `accountant` (bookkeeping, no payroll/close),
plus operational and production roles down to `viewer` and `client`
(portal only). Legacy values (`owner`, `admin`, `editor`, `creator`,
`social_manager`) are still accepted and normalised.

---

## Main Routes

### Internal Dashboard (`/app/*`)
| Route | Page |
|-------|------|
| `/app/dashboard` | Main operations overview |
| `/app/clients` | Client list |
| `/app/clients/:id` | Client profile |
| `/app/pipeline` | Video pipeline |
| `/app/pipeline/:id` | Video detail |
| `/app/calendar` | Content calendar |
| `/app/ai` | AI Studio |
| `/app/assets` | Asset library |
| `/app/packages` | Package management |
| `/app/billing` | Invoices |
| `/app/team` | Team management |
| `/app/tasks` | Task board |
| `/app/analytics` | Analytics |
| `/app/booking` | Shoot bookings |
| `/app/notifications` | Notifications |
| `/app/settings` | Settings |
| `/app/onboarding` | Production setup checklist (real completeness tracking) |
| `/app/users` | User management (invite, roles, deactivate, overrides) |
| `/app/roles` | Roles & permission matrix |
| `/app/audit` | Audit log viewer |
| `/app/finance` | Finance overview |
| `/app/finance/revenue` · `/expenses` | Income / expense ledger |
| `/app/finance/subscriptions` (+`/:id`) | Subscriptions, billing cycles, reminders |
| `/app/finance/payroll` | Compensation & payroll runs |
| `/app/finance/receivables` · `/cashflow` · `/profitability` | Receivables, cash flow, profitability |
| `/app/finance/reports` (+`/month-close`) | P&L & analysis, monthly close |
| `/app/finance/approvals` | Expense approval queue |
| `/app/finance/settings` | Accounts, categories, services, targets, recurring expenses |

### Client Portal (`/client/*`)
| Route | Page |
|-------|------|
| `/client` | Client dashboard |
| `/client/videos` | Client's videos |
| `/client/calendar` | Client's content calendar |
| `/client/bookings` | Client's bookings |
| `/client/assets` | Client's brand assets |
| `/client/package` | Client's package & usage |
| `/client/finance` | Client's billing: subscription, next payment, cycle history, paid/remaining |
| `/client/invoices` | Client's invoices |

---

## Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL files in order:
   - `supabase/schema.sql`
   - `supabase/rls-policies.sql`
   - `supabase/storage.sql`
   - `supabase/seed.sql` (**local development only — never in production**)
3. Run the migrations in `supabase/migrations/` in the exact order given in
   `PRODUCTION_MIGRATION.md` (bootstrap fix → 002 → … → 009)
4. Promote the first Super Admin (SQL one-liner in `PRODUCTION_MIGRATION.md`)
5. Create further users **from inside the app** at `/app/users` (secure
   server-side API) — no Dashboard SQL needed anymore

---

## Vercel Deployment

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel Dashboard:

| Variable | Where it goes | Description |
|----------|--------------|-------------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `VITE_ENABLE_REAL_AUTH` | Frontend | Must be `true` |
| `VITE_ENABLE_AI` | Frontend | Set `true` to enable AI Studio |
| `VITE_APP_URL` | Frontend | Your Vercel URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only** | Admin user API + cron (no VITE_ prefix!) |
| `CRON_SECRET` | **Server-side only** | Protects `/api/cron/finance-reminders` |
| `OPENAI_API_KEY` | **Server-side only** | OpenAI API key (no VITE_ prefix!) |

3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework: Vite

---

## OpenAI Setup

1. Get API key at [platform.openai.com](https://platform.openai.com)
2. Add `OPENAI_API_KEY=sk-...` in Vercel → Environment Variables (NOT prefixed with VITE_)
3. Set `VITE_ENABLE_AI=true` in Vercel → Environment Variables
4. The AI Studio will now call `/api/ai/generate` (Vercel serverless function)

---

## Storage Buckets

Created by `supabase/storage.sql`:

| Bucket | Purpose | Public |
|--------|---------|--------|
| `client-assets` | Logos, fonts, brand files | No |
| `raw-footage` | Raw video uploads | No |
| `video-versions` | Review copies | No |
| `final-deliveries` | Final exported videos | No |
| `thumbnails` | Video preview images | Yes |
| `invoices` | Invoice PDFs | No |
| `finance-attachments` | Expense receipts & payment proofs (migration 009; permission-gated, signed URLs) | No |

---

## How to Add First Real Client

1. Go to `/app/clients`
2. Click "Add Client"
3. Fill in client details
4. Toggle "Enable Portal Access" to give them a client login
5. Create a Supabase auth user with their email
6. Update their profile to `role = 'client'` and link `portal_user_id`

---

## How to Create Team Users

Go to **/app/users → Invite user** (requires `users.create`): enter email,
name, role and optional department. The secure server API creates the auth
user and profile, and shows a one-time temporary password. Role changes and
deactivation happen on the same page. No Dashboard SQL is needed.

---

## Email Domain Migration (`cl.agency` → `ezmarketing.agency`)

The rebrand changed the agency email domain. This affects **only** the
bare-username login shorthand — typing `admin` instead of `admin@…`.

**Who is affected**

| How the user signs in | Before rebrand | After rebrand | Broken? |
|---|---|---|---|
| Full email (`omar@cl.agency`) | used verbatim | used verbatim | No |
| Full email (`omar@ezmarketing.agency`) | used verbatim | used verbatim | No |
| Bare username (`omar`) | → `omar@cl.agency` | → `omar@ezmarketing.agency`, falls back to `omar@cl.agency` | No |

Supabase Auth records are **not** renamed by the rebrand. A user whose auth
record is `omar@cl.agency` keeps that address until you migrate it below.

**Backward compatibility (currently ON)**

`APP_CONFIG.auth.legacyEmailDomain` is set to `'cl.agency'`. On a bare-username
login the app tries the new domain first, and retries the legacy domain only if
Supabase rejects the credentials (HTTP 400). Rate limits, network errors, and
unconfirmed-email errors are *not* retried. Cost when a legacy user signs in:
one extra failed auth call.

**To migrate and turn the fallback off**

1. Inventory the accounts still on the old domain:
   ```sql
   SELECT id, email FROM auth.users WHERE email LIKE '%@cl.agency';
   ```
2. Update each address in Supabase Dashboard → Authentication → Users → Edit,
   or via the Admin API. Keep the local part; swap only the domain.
3. Update the matching profile rows:
   ```sql
   UPDATE profiles
   SET email = REPLACE(email, '@cl.agency', '@ezmarketing.agency')
   WHERE email LIKE '%@cl.agency';
   ```
4. Verify nothing remains:
   ```sql
   SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@cl.agency';  -- expect 0
   ```
5. Set `legacyEmailDomain: null` in [`src/config/app.ts`](src/config/app.ts) and
   delete the fallback branch in `login()` in
   [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx).

> Changing a user's email in Supabase may trigger a confirmation email
> depending on your Auth settings. Use the Admin API with
> `email_confirm: true` to migrate without prompting users.

---

## Demo Data — Removed

The application contains **no demo runtime data**. Every page loads real
Supabase rows, failures show an honest error state, and empty tables render
empty states — never fabricated activity. The old fixtures were moved to
`src/dev/fixtures/` for reference and are imported by nothing in production
(`supabase/seed.sql` likewise is for local development only).

---

## Known Limitations

1. **No real-time updates** — Data refreshes on page navigation plus a slow
   notification poll; Supabase Realtime can be added later
2. **No video player** — Video preview shows metadata only (use an external player URL)
3. **No email/WhatsApp sending** — Payment reminders are in-app only and are
   labelled "In-App Only"; the reminder rows already model other channels for
   a future integration
4. **No multi-currency conversion** — Totals are always per-currency; nothing
   is summed across currencies until an exchange-rate table exists
5. **No multi-agency UI** — Super admin panel for managing multiple agencies not built
6. **AI fallback** — When AI is disabled, the AI Studio shows template-based results

---

## Recommended Next Features

1. **Real-time notifications** — Supabase Realtime subscriptions
2. **Video player integration** — Mux or Cloudflare Stream for review
3. **Email automation** — Supabase Edge Functions + Resend/SendGrid
4. **Client approval workflows** — One-click approve/reject with email
5. **Multi-language support** — Arabic + English
6. **Mobile app** — React Native with the same Supabase backend
7. **Reporting exports** — PDF reports for clients and agency analytics
8. **Stripe integration** — Online invoice payment
