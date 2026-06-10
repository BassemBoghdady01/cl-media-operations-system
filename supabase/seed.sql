-- ============================================================
-- CL — Seed Data for Supabase
-- Run AFTER schema.sql + rls-policies.sql + storage.sql
--
-- IMPORTANT:
--   Auth users must be created via the Supabase Dashboard or Auth API.
--   You cannot directly insert into auth.users from SQL.
--
-- After creating users in the Dashboard, copy their UUIDs and
-- update the profile inserts below.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Step 1: Create Agency
-- ─────────────────────────────────────────────────────────────
INSERT INTO agencies (id, name, email, plan, status)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'CL Agency',
  'hello@cl.agency',
  'growth',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Step 2: Profiles
-- Replace UUIDs with real auth.users UUIDs from Supabase Dashboard
-- See supabase/README.md for how to create auth users
-- ─────────────────────────────────────────────────────────────

/*
-- Example (fill in real UUIDs after creating users in Supabase Dashboard):

INSERT INTO profiles (id, agency_id, full_name, email, role, color)
VALUES
  ('REPLACE-WITH-ADMIN-UUID',      'a1000000-0000-0000-0000-000000000001', 'Agency Admin',    'admin@cl.agency',     'admin',           '#3B82F6'),
  ('REPLACE-WITH-MANAGER-UUID',    'a1000000-0000-0000-0000-000000000001', 'Project Manager', 'manager@cl.agency',   'project_manager', '#8B5CF6'),
  ('REPLACE-WITH-EDITOR-UUID',     'a1000000-0000-0000-0000-000000000001', 'Senior Editor',   'editor@cl.agency',    'editor',          '#06B6D4'),
  ('REPLACE-WITH-ACCOUNTANT-UUID', 'a1000000-0000-0000-0000-000000000001', 'Accountant',      'finance@cl.agency',   'accountant',      '#F59E0B'),
  ('REPLACE-WITH-CLIENT-UUID',     'a1000000-0000-0000-0000-000000000001', 'Client Portal',   'client@cl.agency',    'client',          '#10B981')
ON CONFLICT (id) DO NOTHING;
*/

-- ─────────────────────────────────────────────────────────────
-- Step 3: Seed Clients
-- ─────────────────────────────────────────────────────────────
INSERT INTO clients (id, agency_id, name, brand_name, industry, contact_name, email, phone, status, color, portal_access_enabled)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Nile Brands Co.', 'Nile Brands', 'Fashion & Lifestyle', 'Farida Hassan', 'farida@nilebrands.com', '+20 100 123 4567', 'active', '#3B82F6', true),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Cairo Eats', 'Cairo Eats', 'Food & Beverage', 'Karim Nasser', 'karim@cairoeats.com', '+20 112 987 6543', 'active', '#F59E0B', true),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'TechVision Egypt', 'TechVision', 'Technology', 'Mona Khalil', 'mona@techvision.eg', '+20 122 456 7890', 'active', '#8B5CF6', true),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Desert Palm Hotel', 'Desert Palm', 'Hospitality', 'Ahmed Al-Rashid', 'ahmed@desertpalm.com', '+20 100 111 2222', 'active', '#10B981', false),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'FitZone Gym', 'FitZone', 'Health & Fitness', 'Sara Ali', 'sara@fitzone.com', '+20 115 333 4444', 'active', '#EF4444', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Step 4: Seed Packages
-- ─────────────────────────────────────────────────────────────
INSERT INTO packages (agency_id, client_id, name, monthly_price, currency, included_videos, consumed_videos, included_revisions, consumed_revisions, included_shooting_days, consumed_shooting_days, renewal_date, status)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Content Machine — 12', 4500, 'USD', 12, 10, 24, 18, 2, 2, '2024-06-01', 'active'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Starter — 8 Reels', 2800, 'USD', 8, 7, 16, 10, 1, 1, '2024-06-01', 'active'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Enterprise — 20 Videos', 7200, 'USD', 20, 12, 40, 14, 3, 1, '2024-06-01', 'active'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'Content Machine — 12', 3800, 'USD', 12, 11, 24, 22, 2, 2, '2024-06-01', 'active')
ON CONFLICT DO NOTHING;
