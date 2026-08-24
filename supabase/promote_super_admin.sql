-- ============================================================================
-- Promote YOUR account to super_admin
--
-- Your sidebar shows "Agency Admin" because your profiles.role is
-- 'agency_admin' (or legacy 'admin'). agency_admin deliberately does NOT get
-- payroll access, and only super_admin can edit the role→permission matrix.
--
-- Run in Supabase → SQL Editor. Step 1 identifies the account; step 2
-- promotes exactly that one account. The protect_super_admin trigger permits
-- this because SQL-editor sessions have no auth.uid() (service path).
-- ============================================================================

-- 1. Confirm this is you (check id, email, agency):
SELECT id, email, full_name, role, agency_id, status
  FROM profiles
 WHERE email = 'elboghdadybassem@gmail.com';

-- 2. Promote (edit the email first if step 1 showed a different address):
UPDATE profiles
   SET role = 'super_admin'
 WHERE email = 'elboghdadybassem@gmail.com';

-- 3. Verify:
SELECT email, role FROM profiles WHERE role = 'super_admin';   -- exactly you

-- Then log out and back in (or hard-refresh) — the sidebar will show
-- Super Admin and expose Payroll, Users, Roles & Permissions and Audit Log.
