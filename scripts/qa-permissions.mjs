/**
 * Role-matrix test (§ role model acceptance) — asserts the effective
 * frontend permission mirror for the key roles: allowed AND denied actions.
 * The database mirror is seeded from the same matrix (002/010); the QA flow
 * script (qa-flows.mjs) covers the DB side via has_permission()/RLS.
 *
 * Run: node scripts/qa-permissions.mjs   (exit 1 on any failure)
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Compile the TS roles config to a temp JS module so we test the REAL file.
const tmp = mkdtempSync(join(tmpdir(), 'ez-roles-'))
execSync(
  `npx tsc src/config/roles.ts --outDir "${tmp}" --module commonjs --target es2020 --moduleResolution node --skipLibCheck`,
  { cwd: process.cwd(), stdio: 'inherit' }
)
const require = createRequire(import.meta.url)
const roles = require(join(tmp, 'roles.js'))
const { roleHasPermission, ROLE_SCOPES, normalizeRole } = roles

let pass = 0, fail = 0
function expect(role, permission, expected) {
  const actual = roleHasPermission(role, permission)
  const ok = actual === expected
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${role.padEnd(22)} ${permission.padEnd(28)} expected=${expected} actual=${actual}`)
}
function expectScope(role, scope) {
  const ok = ROLE_SCOPES[role] === scope
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${role.padEnd(22)} scope=${ROLE_SCOPES[role]} expected=${scope}`)
}

// ── super_admin: everything ──
expect('super_admin', 'finance.manage_payroll', true)
expect('super_admin', 'users.manage_roles', true)
expect('super_admin', 'audit.view', true)
expectScope('super_admin', 'agency')

// ── agency_admin: everything EXCEPT payroll ──
expect('agency_admin', 'finance.view', true)
expect('agency_admin', 'users.create', true)
expect('agency_admin', 'finance.view_payroll', false)
expect('agency_admin', 'finance.manage_payroll', false)
expectScope('agency_admin', 'agency')

// ── finance_manager: full finance incl. payroll; no video management ──
expect('finance_manager', 'finance.view_payroll', true)
expect('finance_manager', 'finance.close_period', true)
expect('finance_manager', 'subscriptions.manage', true)
expect('finance_manager', 'videos.manage', false)
expect('finance_manager', 'users.manage_roles', false)
expectScope('finance_manager', 'agency')

// ── marketing_manager: content/AI yes; finance/payroll/users no ──
expect('marketing_manager', 'ai.use', true)
expect('marketing_manager', 'calendar.manage', true)
expect('marketing_manager', 'finance.view', false)
expect('marketing_manager', 'finance.view_payroll', false)
expect('marketing_manager', 'users.create', false)
expectScope('marketing_manager', 'assigned')

// ── project_manager: delivery yes; finance/payroll no; assigned scope ──
expect('project_manager', 'projects.create', true)
expect('project_manager', 'videos.review', true)
expect('project_manager', 'finance.view', false)
expect('project_manager', 'finance.view_payroll', false)
expectScope('project_manager', 'assigned')

// ── video_editor: pipeline yes; clients.create/finance no; assigned scope ──
expect('video_editor', 'videos.manage', true)
expect('video_editor', 'tasks.manage', true)
expect('video_editor', 'clients.create', false)
expect('video_editor', 'finance.view', false)
expect('video_editor', 'users.view', false)
expectScope('video_editor', 'assigned')

// ── hr_manager: payroll yes, revenue/profit NO (separation of duties) ──
expect('hr_manager', 'finance.manage_payroll', true)
expect('hr_manager', 'finance.view_revenue', false)
expect('hr_manager', 'finance.view_profit', false)

// ── accountant: bookkeeping yes; payroll/close no ──
expect('accountant', 'finance.manage', true)
expect('accountant', 'finance.view_payroll', false)
expect('accountant', 'finance.close_period', false)

// ── client: portal ONLY ──
expect('client', 'portal.access', true)
expect('client', 'dashboard.view', false)
expect('client', 'clients.view', false)
expect('client', 'finance.view', false)
expectScope('client', 'own')

// ── viewer (Read Only): views only, no manage anywhere ──
expect('viewer', 'clients.view', true)
expect('viewer', 'tasks.view', true)
expect('viewer', 'videos.manage', false)
expect('viewer', 'finance.view', false)
expectScope('viewer', 'agency')

// ── legacy spellings still resolve ──
const legacy = [['owner', 'super_admin'], ['admin', 'agency_admin'], ['editor', 'video_editor']]
for (const [raw, canonical] of legacy) {
  const ok = normalizeRole(raw) === canonical
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  normalizeRole('${raw}') → ${normalizeRole(raw)} (expected ${canonical})`)
}

rmSync(tmp, { recursive: true, force: true })
console.log(`\n===== ${pass}/${pass + fail} assertions passed =====`)
if (fail > 0) process.exitCode = 1
