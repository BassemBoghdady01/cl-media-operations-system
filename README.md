# EZ Marketing Agency — Media Operations System

End-to-end operations platform for the agency: clients, video pipeline,
calendar, AI studio, tasks, bookings — plus a full **finance ERP layer**
(ledger, subscriptions, payroll, receivables, cash flow, P&L, monthly close),
**user & role management** and an **audit log**. Production only: every screen
reads real Supabase data; there is no demo mode.

---

## Quick Start

```bash
npm install       # install dependencies
npm run dev       # start dev server → http://localhost:5173
npm run build     # typecheck + production build
npm run preview   # preview the production build
```

---

## Authentication

Handled entirely by **Supabase Auth** — there are no demo or seed
credentials. Requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_ENABLE_REAL_AUTH=true`; without them, login fails with a configuration
error instead of admitting anyone.

**Sign-in accepts:**

| Input | Resolves to |
|-------|-------------|
| Full email (`omar@ezmarketing.agency`) | used verbatim |
| Bare username (`omar`) | `omar@ezmarketing.agency`, then `omar@cl.agency` on rejection |

The `@cl.agency` retry is temporary backward compatibility — see
**HANDOVER.md → Email Domain Migration**.

**Creating users:** in-app at `/app/users` (secure server-side API using the
service-role key), or self-signup at `/signup`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_ENABLE_REAL_AUTH=true
VITE_ENABLE_AI=false
VITE_APP_URL=https://your-app.vercel.app

# Server-side only — NEVER prefix with VITE_
SUPABASE_SERVICE_ROLE_KEY=...   # admin user API + cron
CRON_SECRET=...                 # protects /api/cron/finance-reminders
OPENAI_API_KEY=sk-...           # AI Studio
```

---

## Database Setup

1. Base schema: `supabase/schema.sql` → `rls-policies.sql` → `storage.sql`
   (`seed.sql` is for local development only — **never production**).
2. Migrations, in the exact order in **`PRODUCTION_MIGRATION.md`**:
   `fix_auth_profile_bootstrap` → `002_roles_permissions` →
   `003_finance_core` → `004_subscriptions_recurring` → `005_payroll` →
   `006_finance_rls` → `007_finance_functions` → `008_finance_defaults` →
   `009_finance_ops`.
3. Promote the first Super Admin (one-liner in the runbook), then finish
   setup from **/app/onboarding**.

---

## Deployment (Vercel)

Build `npm run build`, output `dist`, framework Vite. Set the env vars above,
then verify the daily cron (`/api/cron/finance-reminders`, 06:00 UTC — see
`vercel.json`) with
`curl "https://YOUR-DOMAIN/api/cron/finance-reminders?secret=$CRON_SECRET"`.

---

## Project Structure

```
src/
├── components/
│   ├── auth/            # ProtectedRoute, RoleGuard, PermissionGuard
│   ├── finance/         # FinanceKit UI primitives, AttachmentField
│   ├── layout/          # AppLayout, ClientLayout, Sidebar, Navbar
│   └── system/          # Error boundaries and states
├── config/              # app.ts (flags/buckets), roles.ts (roles+permissions mirror)
├── contexts/            # AuthContext (Supabase Auth only)
├── dev/fixtures/        # OLD demo data — imported by NOTHING in production
├── hooks/               # useNotifications
├── lib/                 # supabase client, finance formatters, database row types
├── pages/               # dashboard, clients, pipeline, calendar, finance/*,
│                        # users/*, audit, onboarding, client portal
├── services/            # Data layer — real Supabase only, throws on failure
└── types/               # App-level TypeScript types

api/
├── admin/users.ts       # Secure user creation/role/deactivation (service role)
├── ai/generate.ts       # AI Studio serverless function
└── cron/finance-reminders.ts  # Daily billing/reminder/notification job

supabase/
├── schema.sql · rls-policies.sql · storage.sql · seed.sql (dev only)
└── migrations/          # 002–009 + auth bootstrap fix (run in order)
```

---

## Documentation

| File | Purpose |
|------|---------|
| `FINANCE_SETUP.md` | First-time production setup, step by step |
| `FINANCE_MODULE.md` | Finance architecture, routes, lifecycles, storage, cron |
| `ROLES_AND_PERMISSIONS.md` | 21 roles, 48 permissions, RLS, secure user creation |
| `PRODUCTION_MIGRATION.md` | Exact SQL run order, env vars, cron, rollback |
| `HANDOVER.md` | Complete system documentation |
| `CLIENT_PRESENTATION_CHECKLIST.md` | Walkthrough script |
| `supabase/README.md` | Supabase base-schema setup |
