# EZ Marketing Agency — Finance Setup Guide

From an empty database to running the agency. Do these once, in order.
Migration detail: `PRODUCTION_MIGRATION.md`. Concepts: `FINANCE_MODULE.md`.

---

## 1. Database

Run the migrations in the exact order listed in `PRODUCTION_MIGRATION.md`
(`fix_auth_profile_bootstrap` → `002` → … → `009`), then promote yourself:

```sql
UPDATE profiles SET role = 'super_admin' WHERE email = 'you@ezmarketing.agency';
```

Do **not** run `supabase/seed.sql` in production.

## 2. Environment (Vercel → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | publishable key |
| `VITE_ENABLE_REAL_AUTH` | `true` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — **no `VITE_` prefix, ever** |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `OPENAI_API_KEY` | optional, AI Studio |

Redeploy after setting them (`VITE_*` values are baked in at build time).

## 3. First sign-in

Log in → you land on the dashboard as Super Admin. Open **/app/onboarding**
— it tracks real completeness (it checks the actual tables, nothing is
hardcoded) and every step links to the right screen. Steps can be skipped and
finished later.

## 4. Finance Settings (`/app/finance/settings`)

1. **Accounts** — create your real accounts (Cash box, Bank, Wallet, …) with
   opening balances as of today. Balances derive from the ledger afterwards.
2. **Categories** — 21 expense + 10 income categories are pre-seeded. Adjust
   names/`fixed`-vs-`variable` to your reality; `fixed` feeds break-even.
3. **Services** — 12 service templates are pre-seeded without prices. Set
   default prices or archive what you don't sell.
4. **Targets** — monthly revenue / profit / MRR / new-client targets.
5. **Recurring expenses** — rent, software, internet… with next due dates.
   The cron books them automatically as `expected` expenses.
6. **Preferences** — base currency (EGP default), reminder ladder, and
   whether expenses require approval (plus the threshold).

## 5. Team & payroll

1. **/app/users** — invite your team with the right roles (see
   `ROLES_AND_PERMISSIONS.md`). Payroll visibility is limited to
   super_admin / finance_manager / hr_manager by default.
2. **/app/finance/payroll → Employees** — add each employee's compensation
   (base salary, currency, payment day, defaults).
3. End of month: **Run payroll** → review/edit bonuses & deductions →
   Submit → Approve → **Mark as paid** (posts to the ledger exactly once).

## 6. Clients & subscriptions

1. **/app/clients** — create clients. For portal access, create a `client`
   role user in /app/users and link it to the client record.
2. **/app/finance/subscriptions** — create each retainer: amount, currency,
   frequency, billing day, grace period, reminder ladder.
3. The daily cron generates billing cycles, expected revenue and reminders.
   You can always "Generate next cycle" manually on the detail page.
4. When money arrives: open the subscription → **Mark paid** on the cycle
   (choose account + method). Receivables, cash flow and P&L update from that
   single action.

## 7. Day-to-day

- **Income** that isn't subscription-based: `/app/finance/revenue` → Add.
- **Expenses**: `/app/finance/expenses` → Add (attach the receipt). If
  approval is enabled, submit → a `finance.approve_expenses` holder approves
  at `/app/finance/approvals` → then record payment.
- **Invoices**: `/app/billing`, or generate straight from a billing cycle.

## 8. Month end

`/app/finance/reports/month-close` → run the checklist (payroll posted,
drafts, approvals, uncategorised) → **Close month**. Reopening later requires
a reason and is audit-logged.

## 9. Verify automation

```bash
curl -s "https://YOUR-DOMAIN/api/cron/finance-reminders?secret=$CRON_SECRET" | jq
```

Expect HTTP 200 with counters (`cyclesCreated`, `remindersCreated`,
`overdueMarked`, `recurringExpensesCreated`, `remindersDispatched`). Running
it twice must not create anything twice.

## 10. What the client sees

Portal users (`client` role) get `/client` with videos, calendar, bookings,
assets, package — and **/client/finance**: their subscription, next payment,
billing history, paid/remaining and invoices. RLS guarantees they can never
see agency revenue, costs, payroll, margins or other clients.
