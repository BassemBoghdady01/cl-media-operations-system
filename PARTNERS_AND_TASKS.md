# Partners & Profit Sharing · Task Delivery & Review

Two modules added on top of the finance ERP (migrations **011** and **012**).

---

## 1. Partners & Profits — `/app/partners`

Visible only with `partners.view` (role **Partner** and **Super Admin**).
Agency Admins do **not** see it — partner equity is owners-only.

### Ownership
- **Direct partner** — owns a % of the company (e.g. Bassem 33.33%).
- **Group** — owns a % of the company and has **members** who split the group
  (e.g. *Capital* 66.67% → 3 members × 33.33% of the group = 22.22% each).
- Effective share = group % × member %. Company shares must total 100%, and
  each group's members must total 100% — a warning shows until they do, and
  distributions are blocked until fixed.
- A partner can be linked to a login; give that user the **Partner** role in
  /app/users to let them sign in and see everything, including their statement.
- *Quick setup* creates "you + a group with N equal members" in one step.

### Money rules
| Type | Direction | Effect |
|---|---|---|
| Capital in | into company | raises the partner's capital; raises the account balance |
| Capital returned | out | lowers capital and the account balance |
| Drawing / advance | out | lowers what the company owes the partner |
| Profit payout | out | pays an approved distribution |

Partner money is **equity, never an expense** — the P&L stays the real
operating profit. When an entry is tied to a finance account, that account's
balance and the cash-flow page include it.

**Balance owed to a partner = allocated profit − payouts − drawings.**
Negative = the partner drew ahead of profit.

### Monthly profit distribution
1. Record the month's revenue and expenses in Finance as usual.
2. *Profit distribution → New distribution*: pick a month / quarter / range and
   currency. Net profit = revenue collected − expenses paid (same numbers as
   Reports). Optionally keep a reserve % in the company, or enter a fixed amount.
3. A **draft** is created with one line per partner at their effective share
   (rounding cents go to the largest holder so lines sum exactly).
4. **Approve** → the amounts count as owed to each partner.
5. **Pay out remaining** → one payout per partner from the chosen account.
   Partial/manual payouts can be recorded in *Capital & drawings*.
   Status becomes **Paid** automatically when every line is settled.

Every partner, payout and distribution change is written to the audit log.

---

## 2. Task delivery — `/app/tasks`

```
To Do → In Progress → Team Leader Review → Final Approval → Approved
              ▲                 │                  │
              └──── Changes Requested ◄────────────┘
```

- **Create** (needs `tasks.manage`): brief, attachments, assignee, **team
  leader** (1st review), client, due date, and whether final approval is needed.
  The assignee is notified.
- **Submit** (assignee): upload files (up to 50 MB each, private bucket
  `task-files`) and/or paste links (Drive, Canva, Figma…), plus a note. Every
  submission is a new version — nothing is overwritten.
- **Review 1 — team leader**: Approve → goes to final approval. Request
  changes → back to the assignee with the comment (required).
- **Review 2 — final** (`tasks.approve`: Super Admin, Partner, Agency Admin):
  Approve → task is done. Request changes → back to the assignee; the team
  leader is notified too.
- No team leader set → submission goes straight to final approval.
  Final approval off → the team leader's approval completes the task.
- Nobody can approve their own submission.
- *Needs my action* tab shows exactly what each person has to do now;
  cards needing your action are highlighted.
- Comments on a task notify the assignee, reviewer and creator.

Statuses Submitted / Final review / Changes requested / Approved can only be
set through Submit and Review — the database rejects setting them by hand
(except for `tasks.approve` holders). Team members who aren't managers can
only move their own task between To Do / In Progress / Waiting / Blocked.
