# EZ Marketing Agency — Finance Module

Complete reference for the finance layer: architecture, routes, lifecycles,
security, storage and automation. Setup steps live in `FINANCE_SETUP.md`;
access control detail lives in `ROLES_AND_PERMISSIONS.md`.

---

## Principles

1. **One ledger.** Every movement of money is a row in `finance_transactions`
   (income, expense, transfer, refund, adjustment). Invoices, subscriptions and
   payroll *reference* the ledger — they never duplicate it.
2. **No fabricated numbers.** Aggregates are computed in Postgres from real
   rows. When a metric cannot be computed honestly (e.g. break-even with under
   two months of history) the API returns `has_sufficient_data = false` and the
   UI says so instead of showing a guess.
3. **Currency is never mixed.** Totals are grouped by currency everywhere
   (SQL and UI). There is no exchange-rate table yet, so nothing ever sums EGP
   and USD into one figure.
4. **The database is the security boundary.** The sidebar hiding a page is UX;
   Row Level Security calling `has_permission()` is what actually protects the
   data (see `006_finance_rls.sql`).

---

## Routes

| Route | Page | Permission |
|---|---|---|
| `/app/finance` | Overview (KPIs, trend, break-even, expense mix, upcoming, insights) | `finance.view` |
| `/app/finance/revenue` | Income ledger + entry | `finance.view_revenue` |
| `/app/finance/expenses` | Expense ledger + entry (+ receipt upload) | `finance.view_expenses` |
| `/app/finance/subscriptions` | Subscription list, KPIs, reminders | `subscriptions.view` |
| `/app/finance/subscriptions/:id` | Subscription detail: cycles, timeline, actions | `subscriptions.view` |
| `/app/billing` | Invoices | `invoices.view` |
| `/app/finance/payroll` | Compensation, payroll runs, history | `finance.view_payroll` |
| `/app/finance/receivables` | Per-client outstanding / overdue | `finance.view_revenue` |
| `/app/finance/cashflow` | Per-account opening/inflow/outflow/closing + trends | `finance.view_cashflow` |
| `/app/finance/profitability` | Client / project / service profitability | `finance.view_profit` |
| `/app/finance/reports` | P&L, revenue/expense analysis, subscription revenue | `finance.view_profit` |
| `/app/finance/reports/month-close` | Period checklist, close / reopen | `finance.close_period` |
| `/app/finance/approvals` | Expense approval queue | `finance.approve_expenses` |
| `/app/finance/settings` | Accounts, categories, services, targets, recurring expenses, preferences | `finance.manage` |
| `/client/finance` | Client portal: own package, subscription, cycles, invoices | `portal.access` |

---

## Data model (migrations 003–005, 009)

- `agency_services` — the service catalogue (revenue streams).
- `finance_accounts` — cash/bank/card/wallet/gateway. Balances are **derived**
  from the ledger (`finance_account_balances`), never stored.
- `finance_categories` — income & expense categories; `cost_type='fixed'`
  drives break-even, `is_payroll=true` marks the payroll category.
- `finance_transactions` — the ledger. `amount` vs `amount_paid` drives
  receivables and partial payments; a trigger derives `paid / partially_paid /
  overdue` status and blocks edits in closed periods. Soft-deleted via
  `deleted_at`.
- `financial_periods` — monthly open/closed state.
- `agency_finance_settings` — base currency, targets, approval policy,
  onboarding progress.
- `client_subscriptions` → `subscription_cycles` (one row per billing period,
  unique per `(subscription_id, period_start)`) → `payment_reminders`
  (unique `dedupe_key`).
- `recurring_expenses` — templates that auto-generate expense rows.
- `employee_compensation` → `payroll_runs` → `payroll_items`
  (`net_salary` is a generated column — it can never disagree with its parts).
- `audit_logs` — written by database triggers on every sensitive table.

---

## Subscription lifecycle

```
create (active) ──► cycle generated ──► reminders scheduled ──► due ──► paid
      │                (cron or manual)      (7/3/1/0 days)      │
      ├─ pause / resume                                          ├─ partially_paid
      └─ cancel / expire                                         └─ overdue → subscription flagged
```

1. **Create** at `/app/finance/subscriptions` — client, service, amount,
   currency, frequency (weekly → annual or custom N days), start/next billing
   date, grace period, reminder ladder, auto-renew.
2. **Cycle generation** — the daily cron (`generate_subscription_cycles`)
   creates the next cycle up to 45 days ahead; "Generate next cycle" on the
   detail page does the same for one subscription via
   `generate_cycle_for_subscription`. Both are idempotent — a period can only
   ever exist once, and each cycle writes one `expected` income row to the
   ledger so forecasts see it immediately.
3. **Reminders** — one row per (cycle, offset) with a unique dedupe key. The
   cron turns due reminders into in-app notifications for finance-role users
   and marks them `sent`/`failed`. Channels other than in-app are stored but
   displayed as **In-App Only** until an email/WhatsApp integration exists —
   the system never pretends an external message was sent.
4. **Payment** — "Mark paid" calls `mark_cycle_paid`, which settles the cycle
   AND its linked ledger row in one transaction (account + payment method
   recorded). Partial amounts produce `partially_paid`.
5. **Invoice** — "Create invoice" generates an invoice from the cycle and
   links it (`invoice_id`), flipping an `expected` cycle to `invoiced`.
6. **Overdue** — past-due unpaid cycles are marked `overdue` by the cron, an
   overdue reminder is queued, and the parent subscription is flagged.

## Payroll lifecycle

```
compensation (per employee) ──► build run (draft) ──► review edits ──►
pending_approval ──► approved ──► paid (ledger rows settled)
```

1. **Employees** tab: one active `employee_compensation` row per person —
   base salary, currency, payment day, default allowances/deductions.
2. **Run payroll** for a month → `build_payroll_run` RPC copies active
   compensation into `payroll_items`. Re-running only **adds missing people**;
   it never overwrites manual edits.
3. While the run is `draft`/`pending_approval`, bonus / allowance / deduction
   are editable inline.
4. **Approve** stamps `approved_by/approved_at`.
5. **Mark paid** → `mark_payroll_paid` RPC: posts one salary expense per item
   to the ledger (skipping already-posted items — **payroll can never
   double-post**), settles the transactions, marks items and the run `paid`.
6. Payroll ledger rows carry `payroll_item_id`, so RLS hides them from anyone
   without `finance.view_payroll` even inside general expense queries.

## Expense approval

`draft → pending → approved → paid`, or `rejected` (stored as `cancelled` +
`rejection_reason`). Approve/Reject run through database RPCs that require
`finance.approve_expenses`, record `approved_by/approved_at`, forbid
self-approval, and are audit-logged. The queue lives at `/app/finance/approvals`.

## Monthly close

`/app/finance/reports/month-close` shows every period with a pre-close
checklist (payroll posted, draft transactions, pending approvals,
uncategorised rows). Closing requires `finance.close_period`; once closed, the
`finance_transaction_guard` trigger blocks inserts/updates in that month for
everyone without that permission. Reopening requires a written reason; both
actions are audit-logged by trigger.

## Cash flow

`finance_cashflow(agency, from, to)` returns, per active account: opening
balance (opening + settled net before the period), inflow, outflow, payroll
portion, net and closing. Only settled money (`amount_paid > 0`) moves cash —
expected revenue never inflates balances.

## Reports

`/app/finance/reports`: P&L (current vs previous period with differences and
margin %), revenue analysis, expense breakdown, subscription revenue (MRR
normalised monthly per currency), and client/project/service profitability.
CSV export requires `finance.export`. Custom date ranges supported.

## Receipts & documents

Private bucket **`finance-attachments`** (20 MB, images + PDF), path
`{agency_id}/{entity}/{timestamp}-{filename}`. Storage policies (009) require
the caller's own agency prefix plus `finance.view` to read and
`finance.manage` to write/delete. The app stores a `storage:` reference on
`finance_transactions.attachment_url` and opens files through **1-hour signed
URLs** — attachments are never public.

## Automation (cron)

`/api/cron/finance-reminders`, daily at 06:00 UTC (see `vercel.json` and
`PRODUCTION_MIGRATION.md` for the timezone rationale). Secured by
`CRON_SECRET`; uses the service-role key server-side only. Each step is
idempotent, so re-runs create nothing twice.

## Multi-currency

Per-transaction currency, per-currency aggregation, currency tabs in the UI.
No conversion exists yet — adding it means an exchange-rate table plus a
conversion layer in the aggregation functions, not the UI.
