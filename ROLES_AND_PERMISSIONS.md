# EZ Marketing Agency — Roles & Permissions

How access control works, end to end. The database is authoritative
(`002_roles_permissions.sql`); the frontend mirror lives in
`src/config/roles.ts` and only decides what to *render*.

---

## Architecture

```
roles (21)  ──┐
              ├── role_permissions (role → permission grants)
permissions (48) ─┘         │
                            ▼
user_permissions (per-user override: grant OR revoke one permission)
                            │
                            ▼
        has_permission(key)  ← called by every RLS policy
```

- `has_permission()` resolves: **super_admin → always true**, otherwise a
  per-user override wins, otherwise the role grant applies.
- Every finance/RBAC table's RLS policy calls `has_permission()` **and**
  scopes by `agency_id`. A user who edits the frontend still receives zero
  rows.
- Payroll-linked ledger rows additionally require `finance.view_payroll`, so
  salary data never leaks through general expense queries.

## The 21 roles

| Role | Level | Notes |
|---|---|---|
| `super_admin` | 0 | Every permission, cannot be revoked, protected by trigger |
| `agency_admin` | 10 | Everything **except payroll** (deliberate separation of duties) |
| `finance_manager` | 20 | Full finance including payroll, approvals, close |
| `hr_manager` | 20 | Payroll + user management; **no revenue/profit access** |
| `operations` | 25 | Operational oversight |
| `accountant` | 30 | Bookkeeping; no payroll, no period close, no profit view |
| `marketing_manager` | 30 | Marketing, calendar, AI |
| `sales_manager` | 30 | Clients, packages, subscriptions (view) |
| `project_manager` | 35 | Delivery management |
| `account_manager` | 35 | Client relationships |
| `client_success` | 40 | Retention |
| `content_strategist` | 40 | Planning |
| `social_media_manager` | 45 | Channels & scheduling |
| `media_buyer` | 45 | Paid media |
| `sales` | 50 | Individual contributor |
| `videographer` / `video_editor` / `graphic_designer` | 55 | Production |
| `content_creator` | 60 | Content contributor |
| `viewer` | 90 | Read-only internal |
| `client` | 100 | Portal only (`portal.access`) — sees exclusively their own data |

**Level** (lower = more authority) gates who may manage whom: the admin API
refuses creating/changing/deactivating users at or above your own level unless
you are super_admin.

## The 48 permissions

Modules: dashboard, clients, projects, videos, calendar, assets, tasks,
bookings, packages, ai, analytics, finance (11 keys incl. `view_payroll`,
`manage_payroll`, `approve_expenses`, `close_period`, `export`),
subscriptions, invoices, users (5 keys), settings, audit, portal.
Sensitive permissions (`is_sensitive`) are marked in the catalogue and shown
with an amber tag in the UI; they are never granted implicitly.

Full list: `SELECT * FROM permissions ORDER BY module, action;` or the
matrix at **/app/roles**.

## Super Admin protection (database triggers)

- Only a super_admin can create or promote another super_admin.
- A super_admin can only be modified/deactivated by a super_admin.
- The **last remaining super_admin can never be demoted or deactivated** —
  enforced by trigger *and* re-checked in the admin API.
- Nobody can delete a super_admin profile.
- Users cannot modify their own permission overrides.

## Managing access in the app

- **/app/users** (`users.view`): invite/create users, edit profile fields,
  change roles, deactivate/reactivate, assign clients (account manager) and
  projects, and set per-user permission overrides (`users.manage_roles`).
- **/app/roles** (`users.manage_roles`): the full role × permission matrix.
  Only a super_admin can toggle grants (RLS enforces this server-side); the
  super_admin row itself is locked.
- **/app/audit** (`audit.view`): every change to roles, permissions, finance
  and payroll — actor, action, before/after values.

## Secure user creation

Privileged operations go through **`POST /api/admin/users`** (Vercel
function):

1. Verifies the caller's Supabase access token server-side.
2. Loads the caller's profile and re-implements the permission check
   (override → role grant, super_admin bypass).
3. Enforces the authority-level and super-admin rules above.
4. Uses `SUPABASE_SERVICE_ROLE_KEY` — **server-side only, never shipped to
   the browser** — to create the auth user (`create`), update the role
   (`change_role`), or ban/unban sign-in (`deactivate`/`reactivate`).
5. Writes an `audit_logs` row for every action.

`create` accepts email, full name, role, optional department, optional
client link (required for `client` role) and an optional initial password;
otherwise a temporary password is generated and shown **once** to the admin.

## Adding a permission (checklist)

1. Insert into `permissions` + grant rows in `role_permissions` (SQL).
2. Add the key to `PERMISSIONS` and the role arrays in `src/config/roles.ts`.
3. Reference it in RLS if it guards data, and in `PermissionGuard`/sidebar if
   it guards a page.
