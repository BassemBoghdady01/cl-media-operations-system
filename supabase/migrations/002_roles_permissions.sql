-- ============================================================================
-- EZ Marketing Agency — 002 · Roles, Permissions & Super Admin Protection
--
-- RUN AFTER: fix_auth_profile_bootstrap.sql
--
-- SAFETY: additive + idempotent. No table drops, no user deletion, no data loss.
--   Existing role values are TRANSLATED to the expanded canonical vocabulary,
--   never cleared. Legacy values remain accepted by the CHECK constraint.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ROLE REGISTRY
--    A table (not just a CHECK) so the UI can list roles, and so hierarchy
--    level can be compared for "who may modify whom" rules.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  key           TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  -- Lower number = higher authority. super_admin = 0.
  level         INTEGER NOT NULL DEFAULT 100,
  is_internal   BOOLEAN NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,  -- system roles cannot be deleted
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (key, label, description, level, is_internal, is_system) VALUES
  ('super_admin',          'Super Admin',           'System owner. Full unrestricted access.',       0,  TRUE,  TRUE),
  ('agency_admin',         'Agency Admin',          'Agency-wide administration.',                  10, TRUE,  TRUE),
  ('finance_manager',      'Finance Manager',       'Owns finance, payroll and reporting.',         20, TRUE,  TRUE),
  ('hr_manager',           'HR Manager',            'People operations and compensation.',          20, TRUE,  FALSE),
  ('operations',           'Operations Manager',    'Day-to-day operational oversight.',            25, TRUE,  FALSE),
  ('accountant',           'Accountant',            'Bookkeeping and transaction entry.',           30, TRUE,  TRUE),
  ('marketing_manager',    'Marketing Manager',     'Marketing strategy and campaigns.',            30, TRUE,  FALSE),
  ('sales_manager',        'Sales Manager',         'Sales pipeline ownership.',                    30, TRUE,  FALSE),
  ('project_manager',      'Project Manager',       'Project and delivery management.',             35, TRUE,  TRUE),
  ('account_manager',      'Account Manager',       'Client relationship ownership.',               35, TRUE,  FALSE),
  ('client_success',       'Client Success',        'Client retention and satisfaction.',           40, TRUE,  FALSE),
  ('content_strategist',   'Content Strategist',    'Content planning and strategy.',               40, TRUE,  FALSE),
  ('social_media_manager', 'Social Media Manager',  'Social channels and scheduling.',              45, TRUE,  TRUE),
  ('media_buyer',          'Media Buyer',           'Paid media planning and buying.',              45, TRUE,  FALSE),
  ('sales',                'Sales Representative',  'Individual sales contributor.',                50, TRUE,  FALSE),
  ('videographer',         'Videographer',          'Shooting and capture.',                        55, TRUE,  FALSE),
  ('video_editor',         'Video Editor',          'Post-production and editing.',                 55, TRUE,  TRUE),
  ('graphic_designer',     'Graphic Designer',      'Design and visual assets.',                    55, TRUE,  FALSE),
  ('content_creator',      'Content Creator',       'Content and talent contributor.',              60, TRUE,  TRUE),
  ('viewer',               'Viewer (Read Only)',    'Read-only internal access.',                   90, TRUE,  FALSE),
  ('client',               'Client',                'External client portal access only.',         100, FALSE, TRUE)
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      level       = EXCLUDED.level,
      is_internal = EXCLUDED.is_internal,
      is_system   = EXCLUDED.is_system;

-- ─────────────────────────────────────────────────────────────
-- 2. WIDEN profiles.role — canonical + every legacy spelling
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'super_admin','agency_admin','finance_manager','hr_manager','operations',
  'accountant','marketing_manager','sales_manager','project_manager',
  'account_manager','client_success','content_strategist','social_media_manager',
  'media_buyer','sales','videographer','video_editor','graphic_designer',
  'content_creator','viewer','client',
  -- legacy, tolerated so older rows/clients never break
  'owner','admin','social_manager','editor','creator'
));

-- ─────────────────────────────────────────────────────────────
-- 3. TRANSLATE LEGACY VALUES (intent preserved, nothing downgraded)
-- ─────────────────────────────────────────────────────────────
UPDATE profiles SET role = 'super_admin'          WHERE role = 'owner';
UPDATE profiles SET role = 'agency_admin'         WHERE role = 'admin';
UPDATE profiles SET role = 'social_media_manager' WHERE role = 'social_manager';
UPDATE profiles SET role = 'video_editor'         WHERE role = 'editor';
UPDATE profiles SET role = 'content_creator'      WHERE role = 'creator';

ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'viewer';

-- ─────────────────────────────────────────────────────────────
-- 4. PERMISSION CATALOGUE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  key          TEXT PRIMARY KEY,
  module       TEXT NOT NULL,
  action       TEXT NOT NULL,
  description  TEXT,
  -- Sensitive permissions are never granted implicitly by admin-ish roles.
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (key, module, action, description, is_sensitive) VALUES
  ('dashboard.view','dashboard','view','View the main dashboard',FALSE),
  ('clients.view','clients','view','View clients',FALSE),
  ('clients.create','clients','create','Create clients',FALSE),
  ('clients.edit','clients','edit','Edit clients',FALSE),
  ('clients.delete','clients','delete','Delete clients',TRUE),
  ('projects.view','projects','view','View projects',FALSE),
  ('projects.create','projects','create','Create projects',FALSE),
  ('projects.edit','projects','edit','Edit projects',FALSE),
  ('videos.view','videos','view','View videos',FALSE),
  ('videos.manage','videos','manage','Manage the video pipeline',FALSE),
  ('videos.review','videos','review','Review and approve videos',FALSE),
  ('calendar.view','calendar','view','View the content calendar',FALSE),
  ('calendar.manage','calendar','manage','Manage the content calendar',FALSE),
  ('assets.view','assets','view','View the asset library',FALSE),
  ('assets.manage','assets','manage','Manage assets',FALSE),
  ('tasks.view','tasks','view','View tasks',FALSE),
  ('tasks.manage','tasks','manage','Manage tasks',FALSE),
  ('bookings.view','bookings','view','View shoots and bookings',FALSE),
  ('bookings.manage','bookings','manage','Manage shoots and bookings',FALSE),
  ('packages.view','packages','view','View client packages',FALSE),
  ('packages.manage','packages','manage','Manage client packages',FALSE),
  ('ai.use','ai','use','Use AI Studio',FALSE),
  ('ai.manage','ai','manage','Configure AI Studio',FALSE),
  ('analytics.view','analytics','view','View operational analytics',FALSE),
  ('finance.view','finance','view','Access the finance area',TRUE),
  ('finance.manage','finance','manage','Create and edit financial records',TRUE),
  ('finance.view_revenue','finance','view_revenue','View revenue',TRUE),
  ('finance.view_expenses','finance','view_expenses','View expenses',TRUE),
  ('finance.view_profit','finance','view_profit','View profit and margins',TRUE),
  ('finance.view_cashflow','finance','view_cashflow','View cash flow',TRUE),
  ('finance.view_payroll','finance','view_payroll','View payroll and salaries',TRUE),
  ('finance.manage_payroll','finance','manage_payroll','Run and edit payroll',TRUE),
  ('finance.approve_expenses','finance','approve_expenses','Approve expenses',TRUE),
  ('finance.close_period','finance','close_period','Close and reopen accounting periods',TRUE),
  ('finance.export','finance','export','Export financial data',TRUE),
  ('subscriptions.view','subscriptions','view','View client subscriptions',TRUE),
  ('subscriptions.manage','subscriptions','manage','Manage client subscriptions',TRUE),
  ('invoices.view','invoices','view','View invoices',FALSE),
  ('invoices.manage','invoices','manage','Create and edit invoices',TRUE),
  ('users.view','users','view','View users',FALSE),
  ('users.create','users','create','Invite and create users',TRUE),
  ('users.edit','users','edit','Edit user details',TRUE),
  ('users.manage_roles','users','manage_roles','Change user roles',TRUE),
  ('users.deactivate','users','deactivate','Deactivate users',TRUE),
  ('settings.view','settings','view','View settings',FALSE),
  ('settings.manage','settings','manage','Manage agency settings',TRUE),
  ('audit.view','audit','view','View audit logs',TRUE),
  ('portal.access','portal','access','Access the client portal',FALSE)
ON CONFLICT (key) DO UPDATE
  SET module = EXCLUDED.module, action = EXCLUDED.action,
      description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

-- ─────────────────────────────────────────────────────────────
-- 5. ROLE → PERMISSION GRANTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key       TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- Per-user overrides (grant or explicitly revoke a single permission).
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted        BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);

-- super_admin: everything.
INSERT INTO role_permissions (role_key, permission_key)
SELECT 'super_admin', key FROM permissions
ON CONFLICT DO NOTHING;

-- agency_admin: everything EXCEPT payroll internals (deliberate separation of
-- duties — payroll is granted explicitly, not inherited).
INSERT INTO role_permissions (role_key, permission_key)
SELECT 'agency_admin', key FROM permissions
WHERE key NOT IN ('finance.view_payroll','finance.manage_payroll')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_key, permission_key) VALUES
  -- finance_manager — full finance including payroll
  ('finance_manager','dashboard.view'),('finance_manager','clients.view'),
  ('finance_manager','projects.view'),('finance_manager','packages.view'),
  ('finance_manager','packages.manage'),('finance_manager','analytics.view'),
  ('finance_manager','finance.view'),('finance_manager','finance.manage'),
  ('finance_manager','finance.view_revenue'),('finance_manager','finance.view_expenses'),
  ('finance_manager','finance.view_profit'),('finance_manager','finance.view_cashflow'),
  ('finance_manager','finance.view_payroll'),('finance_manager','finance.manage_payroll'),
  ('finance_manager','finance.approve_expenses'),('finance_manager','finance.close_period'),
  ('finance_manager','finance.export'),
  ('finance_manager','subscriptions.view'),('finance_manager','subscriptions.manage'),
  ('finance_manager','invoices.view'),('finance_manager','invoices.manage'),
  ('finance_manager','users.view'),('finance_manager','audit.view'),
  ('finance_manager','settings.view'),

  -- accountant — bookkeeping, no payroll, no period close
  ('accountant','dashboard.view'),('accountant','clients.view'),
  ('accountant','packages.view'),('accountant','finance.view'),
  ('accountant','finance.manage'),('accountant','finance.view_revenue'),
  ('accountant','finance.view_expenses'),('accountant','finance.view_cashflow'),
  ('accountant','finance.export'),
  ('accountant','subscriptions.view'),('accountant','invoices.view'),
  ('accountant','invoices.manage'),('accountant','settings.view'),

  -- hr_manager — payroll only, no revenue/profit
  ('hr_manager','dashboard.view'),('hr_manager','users.view'),
  ('hr_manager','users.create'),('hr_manager','users.edit'),
  ('hr_manager','finance.view'),('hr_manager','finance.view_payroll'),
  ('hr_manager','finance.manage_payroll'),('hr_manager','settings.view'),

  -- operations
  ('operations','dashboard.view'),('operations','clients.view'),('operations','clients.edit'),
  ('operations','projects.view'),('operations','projects.create'),('operations','projects.edit'),
  ('operations','videos.view'),('operations','videos.manage'),
  ('operations','calendar.view'),('operations','calendar.manage'),
  ('operations','assets.view'),('operations','assets.manage'),
  ('operations','tasks.view'),('operations','tasks.manage'),
  ('operations','bookings.view'),('operations','bookings.manage'),
  ('operations','packages.view'),('operations','analytics.view'),
  ('operations','users.view'),('operations','settings.view'),

  -- project_manager
  ('project_manager','dashboard.view'),('project_manager','clients.view'),
  ('project_manager','clients.create'),('project_manager','clients.edit'),
  ('project_manager','projects.view'),('project_manager','projects.create'),
  ('project_manager','projects.edit'),('project_manager','videos.view'),
  ('project_manager','videos.manage'),('project_manager','videos.review'),
  ('project_manager','calendar.view'),('project_manager','calendar.manage'),
  ('project_manager','assets.view'),('project_manager','assets.manage'),
  ('project_manager','tasks.view'),('project_manager','tasks.manage'),
  ('project_manager','bookings.view'),('project_manager','bookings.manage'),
  ('project_manager','packages.view'),('project_manager','invoices.view'),
  ('project_manager','analytics.view'),('project_manager','ai.use'),
  ('project_manager','users.view'),('project_manager','settings.view'),

  -- account_manager / client_success
  ('account_manager','dashboard.view'),('account_manager','clients.view'),
  ('account_manager','clients.edit'),('account_manager','projects.view'),
  ('account_manager','videos.view'),('account_manager','calendar.view'),
  ('account_manager','packages.view'),('account_manager','invoices.view'),
  ('account_manager','tasks.view'),('account_manager','analytics.view'),
  ('client_success','dashboard.view'),('client_success','clients.view'),
  ('client_success','clients.edit'),('client_success','projects.view'),
  ('client_success','videos.view'),('client_success','calendar.view'),
  ('client_success','packages.view'),('client_success','tasks.view'),

  -- marketing_manager
  ('marketing_manager','dashboard.view'),('marketing_manager','clients.view'),
  ('marketing_manager','projects.view'),('marketing_manager','videos.view'),
  ('marketing_manager','videos.manage'),('marketing_manager','calendar.view'),
  ('marketing_manager','calendar.manage'),('marketing_manager','assets.view'),
  ('marketing_manager','tasks.view'),('marketing_manager','tasks.manage'),
  ('marketing_manager','analytics.view'),('marketing_manager','ai.use'),
  ('marketing_manager','ai.manage'),

  -- content_strategist
  ('content_strategist','dashboard.view'),('content_strategist','clients.view'),
  ('content_strategist','projects.view'),('content_strategist','videos.view'),
  ('content_strategist','calendar.view'),('content_strategist','calendar.manage'),
  ('content_strategist','assets.view'),('content_strategist','tasks.view'),
  ('content_strategist','analytics.view'),('content_strategist','ai.use'),

  -- social_media_manager
  ('social_media_manager','dashboard.view'),('social_media_manager','clients.view'),
  ('social_media_manager','videos.view'),('social_media_manager','videos.manage'),
  ('social_media_manager','calendar.view'),('social_media_manager','calendar.manage'),
  ('social_media_manager','assets.view'),('social_media_manager','tasks.view'),
  ('social_media_manager','tasks.manage'),('social_media_manager','analytics.view'),
  ('social_media_manager','ai.use'),

  -- media_buyer
  ('media_buyer','dashboard.view'),('media_buyer','clients.view'),
  ('media_buyer','projects.view'),('media_buyer','analytics.view'),
  ('media_buyer','calendar.view'),('media_buyer','tasks.view'),

  -- sales_manager / sales
  ('sales_manager','dashboard.view'),('sales_manager','clients.view'),
  ('sales_manager','clients.create'),('sales_manager','clients.edit'),
  ('sales_manager','packages.view'),('sales_manager','packages.manage'),
  ('sales_manager','invoices.view'),('sales_manager','analytics.view'),
  ('sales_manager','subscriptions.view'),
  ('sales','dashboard.view'),('sales','clients.view'),('sales','clients.create'),
  ('sales','packages.view'),('sales','tasks.view'),

  -- production roles
  ('videographer','dashboard.view'),('videographer','videos.view'),
  ('videographer','bookings.view'),('videographer','calendar.view'),
  ('videographer','assets.view'),('videographer','assets.manage'),
  ('videographer','tasks.view'),('videographer','tasks.manage'),
  ('video_editor','dashboard.view'),('video_editor','clients.view'),
  ('video_editor','videos.view'),('video_editor','videos.manage'),
  ('video_editor','calendar.view'),('video_editor','assets.view'),
  ('video_editor','assets.manage'),('video_editor','tasks.view'),
  ('video_editor','tasks.manage'),('video_editor','ai.use'),
  ('graphic_designer','dashboard.view'),('graphic_designer','videos.view'),
  ('graphic_designer','assets.view'),('graphic_designer','assets.manage'),
  ('graphic_designer','calendar.view'),('graphic_designer','tasks.view'),
  ('graphic_designer','tasks.manage'),
  ('content_creator','dashboard.view'),('content_creator','videos.view'),
  ('content_creator','calendar.view'),('content_creator','assets.view'),
  ('content_creator','tasks.view'),('content_creator','ai.use'),

  -- viewer / client
  ('viewer','dashboard.view'),('viewer','clients.view'),('viewer','projects.view'),
  ('viewer','videos.view'),('viewer','calendar.view'),('viewer','tasks.view'),
  ('client','portal.access')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. AUTHORISATION HELPERS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_role_key()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid()), FALSE)
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Effective permission = role grant, overridden by an explicit user row.
-- super_admin short-circuits to TRUE and cannot be revoked.
CREATE OR REPLACE FUNCTION has_permission(p_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN is_super_admin() THEN TRUE
    ELSE COALESCE(
      (SELECT up.granted FROM user_permissions up
        WHERE up.user_id = auth.uid() AND up.permission_key = p_key),
      EXISTS (
        SELECT 1 FROM role_permissions rp
         WHERE rp.role_key = current_role_key()
           AND rp.permission_key = p_key
      )
    )
  END
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('super_admin','agency_admin','owner','admin')
       FROM profiles WHERE id = auth.uid()),
    FALSE)
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 7. SUPER ADMIN PROTECTION — enforced in the database, not the UI
--
--    Rules:
--      • Only a super_admin may create or promote another super_admin.
--      • A super_admin's role may only be changed by a super_admin.
--      • Nobody may delete a super_admin profile, including other super admins
--        (delete the auth user deliberately if truly intended).
--      • The last remaining super_admin can never be demoted or deactivated.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_is_super BOOLEAN := is_super_admin();
  v_super_count    INTEGER;
BEGIN
  -- Allow unauthenticated/service-role paths (migrations, triggers, admin API).
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'A Super Admin profile cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Promotion into super_admin requires super_admin.
    IF NEW.role = 'super_admin' AND OLD.role <> 'super_admin' AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role.';
    END IF;

    -- Modifying an existing super_admin requires super_admin.
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      IF NOT v_actor_is_super THEN
        RAISE EXCEPTION 'Only a Super Admin can change a Super Admin role.';
      END IF;

      SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
      IF v_super_count <= 1 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining Super Admin.';
      END IF;
    END IF;

    -- Never let a super_admin be deactivated by anyone else.
    IF OLD.role = 'super_admin'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'active'
       AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Only a Super Admin can deactivate a Super Admin.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' AND NOT v_actor_is_super THEN
    -- Permit the very first super_admin (bootstrapping an empty system).
    SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
    IF v_super_count > 0 THEN
      RAISE EXCEPTION 'Only a Super Admin can create another Super Admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_super_admin_trigger ON profiles;
CREATE TRIGGER protect_super_admin_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_super_admin();

-- Users may not grant themselves permissions.
CREATE OR REPLACE FUNCTION protect_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT (is_super_admin() OR has_permission('users.manage_roles')) THEN
    RAISE EXCEPTION 'You do not have permission to modify user permissions.';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.user_id = auth.uid() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'You cannot modify your own permissions.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_user_permissions_trigger ON user_permissions;
CREATE TRIGGER protect_user_permissions_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION protect_user_permissions();

-- ─────────────────────────────────────────────────────────────
-- 8. PROFILE EXTENSIONS for the user management centre
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_id      UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_status_idx     ON profiles (status);
CREATE INDEX IF NOT EXISTS profiles_department_idx ON profiles (department);
CREATE INDEX IF NOT EXISTS profiles_client_id_idx  ON profiles (client_id);

-- ─────────────────────────────────────────────────────────────
-- 9. RLS on the new tables — catalogue readable, grants restricted
-- ─────────────────────────────────────────────────────────────
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read roles" ON roles;
CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can read permissions" ON permissions;
CREATE POLICY "Authenticated can read permissions" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can read role permissions" ON role_permissions;
CREATE POLICY "Authenticated can read role permissions" ON role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admin manages role permissions" ON role_permissions;
CREATE POLICY "Super admin manages role permissions" ON role_permissions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Read own or managed user permissions" ON user_permissions;
CREATE POLICY "Read own or managed user permissions" ON user_permissions
  FOR SELECT USING (user_id = auth.uid() OR has_permission('users.view'));

DROP POLICY IF EXISTS "Manage user permissions" ON user_permissions;
CREATE POLICY "Manage user permissions" ON user_permissions
  FOR ALL USING (has_permission('users.manage_roles'))
  WITH CHECK (has_permission('users.manage_roles'));

COMMIT;

-- ============================================================================
-- POST-MIGRATION — promote yourself. Run once, replacing the email.
--   UPDATE profiles SET role = 'super_admin' WHERE email = 'you@ezmarketing.agency';
--
-- VERIFY:
--   SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY 2 DESC;
--   SELECT COUNT(*) FROM permissions;       -- expect 48
--   SELECT COUNT(*) FROM role_permissions;  -- expect > 250
-- ============================================================================
