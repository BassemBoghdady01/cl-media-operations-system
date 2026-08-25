-- ============================================================================
-- EZ Marketing Agency — 010 · Data Scopes & Assignments
-- RUN AFTER: 009_finance_ops.sql
--
-- PERMISSION says WHAT a user may do. SCOPE says WHICH records.
-- This migration adds the scope layer:
--
--   roles.scope           'agency'   → sees the whole agency (managers/finance)
--                         'assigned' → sees only assigned clients/projects/work
--                         'own'      → portal clients: their own record only
--   user_clients          explicit client assignments (the scope source used
--                         by User Management → "Assign clients")
--
-- Scope resolution for an 'assigned' role — a client is in scope when ANY of:
--   • a user_clients row assigns it
--   • the user is the client's account manager (clients.assigned_manager_id)
--   • the user is on the team of one of the client's projects (team_ids)
-- Work items add their own direct-assignment paths (video editor sees videos
-- assigned to them, videographer sees shoots they're on, etc.).
--
-- SAFETY: replaces the broad "internal users see everything" SELECT policies
-- with scope-aware ones. Client-portal policies are unchanged. Roles with
-- scope 'agency' behave exactly as before.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ROLE SCOPES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE roles ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'agency'
  CHECK (scope IN ('agency', 'assigned', 'own'));

UPDATE roles SET scope = 'agency'   WHERE key IN
  ('super_admin','agency_admin','operations','finance_manager','accountant',
   'hr_manager','sales_manager','viewer');
UPDATE roles SET scope = 'assigned' WHERE key IN
  ('project_manager','account_manager','client_success','marketing_manager',
   'social_media_manager','media_buyer','content_strategist','content_creator',
   'videographer','video_editor','graphic_designer','sales');
UPDATE roles SET scope = 'own'      WHERE key = 'client';

-- ─────────────────────────────────────────────────────────────
-- 2. CLIENT ASSIGNMENTS (User Management → Assign clients)
--    Project assignments live on projects.team_ids (already used by the UI);
--    both feed the scope functions below.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_clients (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS user_clients_client_idx ON user_clients (client_id);

ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own or managed assignments" ON user_clients;
CREATE POLICY "read own or managed assignments" ON user_clients FOR SELECT
  USING (user_id = auth.uid() OR has_permission('users.view'));

DROP POLICY IF EXISTS "manage assignments" ON user_clients;
CREATE POLICY "manage assignments" ON user_clients FOR ALL
  USING (has_permission('users.edit'))
  WITH CHECK (has_permission('users.edit'));

-- ─────────────────────────────────────────────────────────────
-- 3. SCOPE FUNCTIONS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION my_role_scope()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT r.scope FROM profiles p JOIN roles r ON r.key = p.role
      WHERE p.id = auth.uid()),
    -- Legacy role spellings (owner/admin/editor/…) are not in the roles table;
    -- they were always agency-wide before this migration. Unknown → 'agency'
    -- keeps them working; permissions still gate what they can DO.
    'agency'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION client_in_scope(p_client UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE my_role_scope()
    WHEN 'agency' THEN TRUE
    WHEN 'own'    THEN p_client = my_client_id()
    ELSE
      EXISTS (SELECT 1 FROM user_clients uc
               WHERE uc.user_id = auth.uid() AND uc.client_id = p_client)
      OR EXISTS (SELECT 1 FROM clients c
               WHERE c.id = p_client AND c.assigned_manager_id = auth.uid())
      OR EXISTS (SELECT 1 FROM projects pr
               WHERE pr.client_id = p_client AND auth.uid() = ANY(pr.team_ids))
  END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION project_in_scope(p_project UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE my_role_scope()
    WHEN 'agency' THEN TRUE
    WHEN 'own'    THEN EXISTS (SELECT 1 FROM projects pr
                        WHERE pr.id = p_project AND pr.client_id = my_client_id())
    ELSE
      EXISTS (SELECT 1 FROM projects pr
               WHERE pr.id = p_project
                 AND (auth.uid() = ANY(pr.team_ids) OR client_in_scope(pr.client_id)))
  END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 4. SCOPE-AWARE SELECT POLICIES
--    (replacing the broad "internal users see everything" versions)
-- ─────────────────────────────────────────────────────────────

-- CLIENTS
DROP POLICY IF EXISTS "Internal users see all clients in their agency" ON clients;
CREATE POLICY "Internal users see clients in scope" ON clients FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user() AND client_in_scope(id));

-- PROJECTS
DROP POLICY IF EXISTS "Internal users see projects in their agency" ON projects;
CREATE POLICY "Internal users see projects in scope" ON projects FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (auth.uid() = ANY(team_ids) OR client_in_scope(client_id)));

-- VIDEOS — client scope OR directly assigned work
DROP POLICY IF EXISTS "Internal users see all videos in their agency" ON videos;
CREATE POLICY "Internal users see videos in scope" ON videos FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_in_scope(client_id)
              OR assigned_editor_id = auth.uid()
              OR assigned_manager_id = auth.uid()
              OR created_by = auth.uid()));

-- CONTENT CALENDAR
DROP POLICY IF EXISTS "Internal users see all calendar in their agency" ON content_calendar;
CREATE POLICY "Internal users see calendar in scope" ON content_calendar FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_in_scope(client_id) OR assigned_to = auth.uid()));

-- BOOKINGS — client scope OR on the shoot team
DROP POLICY IF EXISTS "Internal users see bookings in their agency" ON bookings;
CREATE POLICY "Internal users see bookings in scope" ON bookings FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_in_scope(client_id) OR auth.uid() = ANY(assigned_team_ids)));

-- TASKS — client scope OR mine (assigned/created) OR general (no client link)
DROP POLICY IF EXISTS "Internal users see tasks in their agency" ON tasks;
CREATE POLICY "Internal users see tasks in scope" ON tasks FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_id IS NULL
              OR client_in_scope(client_id)
              OR assigned_to = auth.uid()
              OR created_by = auth.uid()));

-- ASSETS
DROP POLICY IF EXISTS "Internal users see all assets in their agency" ON assets;
CREATE POLICY "Internal users see assets in scope" ON assets FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user() AND client_in_scope(client_id));

-- PACKAGES
DROP POLICY IF EXISTS "Internal users see packages in their agency" ON packages;
CREATE POLICY "Internal users see packages in scope" ON packages FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user() AND client_in_scope(client_id));

-- INVOICES (the 006 permission-gated policy and the portal policy remain;
-- this replaces only the broad internal read)
DROP POLICY IF EXISTS "Internal users see invoices in their agency" ON invoices;
CREATE POLICY "Internal users see invoices in scope" ON invoices FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND has_permission('invoices.view') AND client_in_scope(client_id));

-- ─────────────────────────────────────────────────────────────
-- 5. SCOPE THE BROAD MANAGE POLICIES (write side)
--    Managers with 'assigned' scope may only write within their scope.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and managers can manage clients" ON clients;
CREATE POLICY "Admins and managers can manage clients" ON clients FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('clients.edit')
         AND (my_role_scope() = 'agency' OR client_in_scope(id)))
  WITH CHECK (agency_id = get_my_agency_id()
         AND (has_permission('clients.create') OR has_permission('clients.edit')));

DROP POLICY IF EXISTS "Admins and managers can manage projects" ON projects;
CREATE POLICY "Admins and managers can manage projects" ON projects FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('projects.edit')
         AND (my_role_scope() = 'agency' OR auth.uid() = ANY(team_ids) OR client_in_scope(client_id)))
  WITH CHECK (agency_id = get_my_agency_id()
         AND (has_permission('projects.create') OR has_permission('projects.edit')));

DROP POLICY IF EXISTS "Admins and managers can manage videos" ON videos;
CREATE POLICY "Admins and managers can manage videos" ON videos FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('videos.manage')
         AND (my_role_scope() = 'agency' OR client_in_scope(client_id)
              OR assigned_editor_id = auth.uid()))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('videos.manage'));

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT key, scope FROM roles ORDER BY level;          -- scopes populated
--   SELECT client_in_scope('00000000-0000-0000-0000-000000000000');  -- runs
--   -- As a scoped user with no assignments: SELECT COUNT(*) FROM clients; → 0
--   -- After assigning a client in /app/users: that client becomes visible.
-- ============================================================================
