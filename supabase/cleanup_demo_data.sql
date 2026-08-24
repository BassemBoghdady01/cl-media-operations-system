-- ============================================================================
-- EZ Marketing Agency — Remove seed.sql DEMO rows from production
--
-- WHY: supabase/seed.sql (development-only) was run against the production
-- database. It inserted 5 demo clients + 4 demo packages (summing to the
-- $18,300 "Monthly Revenue" you see) under agency
--   a1000000-0000-0000-0000-000000000001
-- Your own login profile is attached to that SAME agency, so the agency row
-- and your profile are kept — only the demo business records are removed.
--
-- HOW TO USE (Supabase → SQL Editor):
--   1. Run PART 1 alone. Review every result set.
--   2. If — and only if — the preview shows exactly the demo records you
--      expect to lose, run PART 2.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PART 1 · PREVIEW — run this first, deletes nothing
-- ────────────────────────────────────────────────────────────────────────────

-- 1a. The demo clients (fixed UUIDs written by seed.sql)
SELECT id, name, brand_name, contact_name, email
  FROM clients
 WHERE id IN (
   'c1000000-0000-0000-0000-000000000001',  -- Nile Brands Co.
   'c1000000-0000-0000-0000-000000000002',  -- Cairo Eats
   'c1000000-0000-0000-0000-000000000003',  -- TechVision Egypt
   'c1000000-0000-0000-0000-000000000004',  -- Desert Palm Hotel
   'c1000000-0000-0000-0000-000000000005'   -- FitZone Gym
 );

-- 1b. Everything that will disappear with them (FK CASCADE or explicit delete)
SELECT 'packages'          AS tbl, COUNT(*) FROM packages          WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'videos',            COUNT(*) FROM videos            WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'invoices',          COUNT(*) FROM invoices          WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'bookings',          COUNT(*) FROM bookings          WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'assets',            COUNT(*) FROM assets            WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'content_calendar',  COUNT(*) FROM content_calendar  WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'tasks (unlinked, deleted explicitly)', COUNT(*) FROM tasks WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'client_subscriptions', COUNT(*) FROM client_subscriptions WHERE client_id::text LIKE 'c1000000-%'
UNION ALL SELECT 'finance_transactions (client-linked)', COUNT(*) FROM finance_transactions WHERE client_id::text LIKE 'c1000000-%';

-- 1c. Profiles in the demo agency — REVIEW ONLY. Your real login must be here
--     and must NOT be deleted. Any leftover fake profiles from seed.sql would
--     also show here; delete those manually only if you recognise them as fake.
SELECT id, email, full_name, role, created_at
  FROM profiles
 WHERE agency_id = 'a1000000-0000-0000-0000-000000000001'
 ORDER BY created_at;

-- 1d. Safety check: demo clients must belong ONLY to the demo agency
SELECT COUNT(*) AS demo_clients_outside_demo_agency
  FROM clients
 WHERE id::text LIKE 'c1000000-%'
   AND agency_id <> 'a1000000-0000-0000-0000-000000000001';   -- expect 0

-- ────────────────────────────────────────────────────────────────────────────
-- PART 2 · DELETE — run ONLY after reviewing Part 1
-- ────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- Tasks reference clients with ON DELETE SET NULL — remove the demo ones
-- explicitly so no orphaned demo tasks survive.
DELETE FROM tasks WHERE client_id::text LIKE 'c1000000-%';

-- Ledger rows attached to demo clients (expected revenue from demo subs, etc.)
DELETE FROM finance_transactions WHERE client_id::text LIKE 'c1000000-%';

-- The demo clients. CASCADE removes their packages, videos, invoices,
-- bookings, assets, calendar entries, subscriptions, cycles and reminders.
DELETE FROM clients WHERE id IN (
  'c1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000005'
);

COMMIT;
*/

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY after Part 2:
--   SELECT COUNT(*) FROM clients;              -- your real clients only
--   SELECT COUNT(*) FROM packages;             -- demo packages gone
--   The Clients page KPIs recompute automatically from the remaining rows.
-- ────────────────────────────────────────────────────────────────────────────
