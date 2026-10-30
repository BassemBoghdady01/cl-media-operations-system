# Browser QA with temporary accounts

Run only after `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are set in Vercel
(Production + Preview) and production has been redeployed. Billing stays off:
**never** set `BILLING_CRON_ENABLED`.

## 0. Health checks (create nothing)
| Check | Expected |
|---|---|
| `GET /api/cron/finance-reminders` without a secret | `401 Unauthorized` (before the secret: `500 Server not configured`) |
| Vercel → Cron Jobs → **Run** is NOT used — the job stays disabled | — |
| From the signed-in Super Admin: `POST /api/admin/users` with `{ "action": "health" }` | `400 Unknown action "health"` = server key loaded and caller verified |

## 1. Temporary data (all marked so cleanup can find it)
Created by the Super Admin in the app (User Management → Add user; Clients → Add client):

| Item | Value |
|---|---|
| Client | `QA Temp Client (delete me)` |
| Employee | `qa-employee@example.test` · role **video_editor** · assigned to the QA client only |
| Team Leader | `qa-teamleader@example.test` · role **project_manager** · assigned to the QA client |
| Client user | `qa-client@example.test` · role **client** · linked to the QA client |
| Task | `[QA] Edit reel` · client QA · assignee employee · reviewer team leader · final approval on |
| Video | `[QA] Reel v1` · client QA · status client_review |

`example.test` addresses cannot receive mail; the admin API creates confirmed
accounts and shows a one-time password to the Super Admin — no invitation
email is sent. The owner types each password at login (the assistant never does).

## 2. Scenarios
1. **Employee** — sees only own task; cannot change reviewer / final approval; uploads a file and a link; submits.
2. **Team Leader** — requests changes (comment required) → employee resubmits → approves → task waits for final approval; cannot give final approval.
3. **Super Admin** — final approval → Done; history shows all submissions and reviews; audit log lists them.
4. **Client** — portal shows only the QA client; approves / requests a revision on the QA video; sees no internal tasks, no staff emails, no other client.
5. **Direct-URL checks** — employee opens `/app/finance`, `/app/users`, `/app/partners` → access denied, no data requests succeed.
6. **Admin API** — Super Admin changes the employee's role, deactivates and reactivates them; cannot demote / deactivate the last Super Admin.
7. **Mobile** — repeat 1 and 4 at 375 px width.

## 3. Cleanup
Run `tests/qa/cleanup.sql` (dry run first, then with `:commit`). It removes only
rows tied to the QA client and the `@example.test` accounts; audit-log history
is kept.
