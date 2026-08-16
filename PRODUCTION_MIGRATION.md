# EZ Marketing Agency — Production Migration Runbook

Apply in this **exact order** in Supabase → SQL Editor. Every file is additive
and idempotent: no table is dropped, no user is deleted, no data is destroyed.
Re-running a file is safe.

Take a database backup first (Supabase → Database → Backups) regardless.

## Run order

| # | File | What it does |
|---|------|--------------|
| 1 | `supabase/migrations/fix_auth_profile_bootstrap.sql` | Repairs the profile/agency bootstrap trigger. **Run this first if you have not already.** |
| 2 | `supabase/migrations/002_roles_permissions.sql` | Roles registry, permission catalogue, role grants, Super Admin protection triggers, profile columns |
| 3 | `supabase/migrations/003_finance_core.sql` | Services, accounts, categories, transaction ledger, periods, finance settings, audit log |
| 4 | `supabase/migrations/004_subscriptions_recurring.sql` | Subscriptions, billing cycles, reminders, recurring expenses, generator functions |
| 5 | `supabase/migrations/005_payroll.sql` | Compensation, payroll runs and items, payroll RPCs |
| 6 | `supabase/migrations/006_finance_rls.sql` | Row Level Security for every finance table |
| 7 | `supabase/migrations/007_finance_functions.sql` | Aggregation functions (summary, MRR, receivables, profitability, break-even, forecast) |
| 8 | `supabase/migrations/008_finance_defaults.sql` | Default categories, service templates, finance settings row. **No fake transactions.** |
| 9 | `supabase/migrations/009_finance_ops.sql` | Operational RPCs (manual cycle generation, mark cycle paid, expense approve/reject, payroll pay-out, cash flow, last-login stamp), audit triggers for subscriptions/payroll items, and the private `finance-attachments` storage bucket + policies |

> **Do NOT run `supabase/seed.sql` in production.** It inserts sample
> operational data for local development only. Production starts empty and
> every figure comes from data you enter.

## Immediately after migration 2

Promote yourself. Nothing else grants Super Admin, and the protection trigger
allows the first one through only while none exists.

```sql
UPDATE profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL_HERE';
```

## Verification

```sql
-- No profile left on a legacy role value
SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY 2 DESC;

-- Catalogue loaded
SELECT COUNT(*) FROM roles;             -- 21
SELECT COUNT(*) FROM permissions;       -- 48
SELECT COUNT(*) FROM role_permissions;  -- > 250

-- Configuration seeded, but no invented money
SELECT kind, COUNT(*) FROM finance_categories GROUP BY kind;  -- 21 expense / 10 income
SELECT COUNT(*) FROM agency_services;                          -- 12 per agency
SELECT COUNT(*) FROM finance_transactions;                     -- 0

-- Every auth user has a profile and an agency
SELECT u.id, u.email FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL;      -- 0 rows
SELECT id, email FROM profiles WHERE agency_id IS NULL;        -- 0 rows

-- Permission check works for you
SELECT has_permission('finance.view_payroll');                 -- true for super_admin
```

## Environment variables

Set in **Vercel → Settings → Environment Variables**, then redeploy.
`VITE_*` values are inlined at build time, so a change needs a rebuild.

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client | yes | Already set |
| `VITE_SUPABASE_ANON_KEY` | client | yes | Publishable key — safe in the browser |
| `VITE_ENABLE_REAL_AUTH` | client | yes | Must be `true` |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | yes | Used by `/api/cron/finance-reminders` and `/api/admin/users` (secure user creation). **Never** prefix with `VITE_` — that would ship it to browsers |
| `CRON_SECRET` | **server only** | new | Long random string. Vercel Cron sends it as `Authorization: Bearer` |
| `OPENAI_API_KEY` | server only | existing | AI Studio serverless function |

Generate a cron secret:

```bash
openssl rand -hex 32
```

## Cron

`vercel.json` registers `/api/cron/finance-reminders` at `0 6 * * *` (06:00 UTC).
Vercel Cron is available on Pro and above; on Hobby, call the URL from any
external scheduler with `?secret=<CRON_SECRET>`.

**Timezone:** Vercel Cron and Postgres `CURRENT_DATE` both run in UTC. The
business operates in Egypt (UTC+2/+3), so 06:00 UTC = 08:00–09:00 in Cairo —
the calendar date is identical in both zones at that hour, which keeps DATE
based due-date logic unambiguous. If you ever change the schedule, keep it
between roughly 03:00 and 21:00 UTC.

The job: generates due subscription cycles (+ expected-revenue ledger rows +
the reminder ladder), generates recurring company expenses, marks overdue
cycles and flags their subscriptions, dispatches in-app notifications to
finance-role users, and creates task-due / shoot-tomorrow notifications. All
of it is idempotent via unique keys and same-day dedupe checks.

Manual test after deploy:

```bash
curl -s "https://YOUR-DOMAIN/api/cron/finance-reminders?secret=YOUR_CRON_SECRET" | jq
```

Expected: `200` with counters. `401` means the secret is wrong or missing.
The job is idempotent — running it twice creates nothing twice.

## Rollback

These migrations are additive; the safest rollback is to leave the new tables in
place and stop using them. If you must remove the finance layer entirely:

```sql
-- Destroys ALL finance data. Operational tables are untouched.
DROP TABLE IF EXISTS payroll_items, payroll_runs, employee_compensation,
  payment_reminders, subscription_cycles, client_subscriptions,
  recurring_expenses, finance_transactions, finance_categories,
  finance_accounts, agency_services, financial_periods,
  agency_finance_settings, audit_logs CASCADE;
```

Do **not** drop `roles`, `permissions`, `role_permissions` or the profile
columns — the application depends on them for access control.
