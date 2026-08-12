-- ============================================================
-- EZ Marketing Agency — Row Level Security Policies
-- Run AFTER schema.sql
--
-- IDEMPOTENT: every policy is dropped before (re-)creation so this
-- file can be re-run safely on an existing Supabase project.
--
-- CRITICAL FIX (2024-06):
--   • profiles SELECT now includes `id = auth.uid()` so users can
--     always read their own row even when agency_id is NULL.
--   • agencies INSERT added for first-time onboarding auto-recovery.
--   • is_admin() now includes 'agency_admin'.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- HELPERS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
  SELECT role NOT IN ('client') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- FIX: added 'agency_admin' — the schema uses this role name
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('owner', 'admin', 'agency_admin') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE agencies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_profiles  ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- AGENCIES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own agency"             ON agencies;
DROP POLICY IF EXISTS "Authenticated users can create their agency" ON agencies;
DROP POLICY IF EXISTS "Admins can update their agency"              ON agencies;

CREATE POLICY "Users can view their own agency"
  ON agencies FOR SELECT
  USING (id = get_my_agency_id());

-- Needed for first-time onboarding: app auto-creates an agency when
-- a user's profile.agency_id is NULL.
CREATE POLICY "Authenticated users can create their agency"
  ON agencies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update their agency"
  ON agencies FOR UPDATE
  USING (id = get_my_agency_id() AND is_admin());

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view profiles in their agency"                ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or profiles in their agency" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile"                     ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles"                             ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admins can insert any"  ON profiles;

-- FIX: The old policy "agency_id = get_my_agency_id()" evaluated to
-- NULL = NULL (false) when agency_id was not yet set → blank screen after login.
CREATE POLICY "Users can view own profile or profiles in their agency"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR agency_id = get_my_agency_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Allow users to insert their own profile (recovery when trigger fails)
CREATE POLICY "Users can insert own profile or admins can insert any"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR is_admin());

-- ─────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see all clients in their agency" ON clients;
DROP POLICY IF EXISTS "Client users see only their own record"         ON clients;
DROP POLICY IF EXISTS "Admins and managers can manage clients"         ON clients;

CREATE POLICY "Internal users see all clients in their agency"
  ON clients FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see only their own record"
  ON clients FOR SELECT
  USING (portal_user_id = auth.uid());

CREATE POLICY "Admins and managers can manage clients"
  ON clients FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'project_manager'));

-- ─────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see projects in their agency"  ON projects;
DROP POLICY IF EXISTS "Client users see their own projects"          ON projects;
DROP POLICY IF EXISTS "Admins and managers can manage projects"      ON projects;

CREATE POLICY "Internal users see projects in their agency"
  ON projects FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their own projects"
  ON projects FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Admins and managers can manage projects"
  ON projects FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'project_manager'));

-- ─────────────────────────────────────────────────────────────
-- VIDEOS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see all videos in their agency"  ON videos;
DROP POLICY IF EXISTS "Client users see their approved/posted videos"  ON videos;
DROP POLICY IF EXISTS "Admins and managers can manage videos"          ON videos;
DROP POLICY IF EXISTS "Editors can update assigned videos"             ON videos;

CREATE POLICY "Internal users see all videos in their agency"
  ON videos FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their approved/posted videos"
  ON videos FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
    AND status IN ('client_review', 'approved', 'scheduled', 'posted')
  );

CREATE POLICY "Admins and managers can manage videos"
  ON videos FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'project_manager'));

CREATE POLICY "Editors can update assigned videos"
  ON videos FOR UPDATE
  USING (
    agency_id = get_my_agency_id()
    AND assigned_editor_id = auth.uid()
    AND get_my_role() IN ('editor', 'creator')
  );

-- ─────────────────────────────────────────────────────────────
-- VIDEO VERSIONS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see versions in their agency"   ON video_versions;
DROP POLICY IF EXISTS "Client users see versions of their videos"     ON video_versions;
DROP POLICY IF EXISTS "Team can insert video versions"                ON video_versions;

CREATE POLICY "Internal users see versions in their agency"
  ON video_versions FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see versions of their videos"
  ON video_versions FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND video_id IN (
      SELECT id FROM videos
      WHERE client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
    )
  );

CREATE POLICY "Team can insert video versions"
  ON video_versions FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- REVIEW COMMENTS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see all comments in their agency"             ON review_comments;
DROP POLICY IF EXISTS "Client users see only non-internal comments on their videos" ON review_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments on accessible videos" ON review_comments;
DROP POLICY IF EXISTS "Users can update their own comments"                         ON review_comments;

CREATE POLICY "Internal users see all comments in their agency"
  ON review_comments FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see only non-internal comments on their videos"
  ON review_comments FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND is_internal = FALSE
    AND video_id IN (
      SELECT id FROM videos
      WHERE client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert comments on accessible videos"
  ON review_comments FOR INSERT
  WITH CHECK (
    agency_id = get_my_agency_id()
    AND user_id = auth.uid()
    AND (is_internal_user() OR is_internal = FALSE)
  );

CREATE POLICY "Users can update their own comments"
  ON review_comments FOR UPDATE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- ASSETS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see all assets in their agency" ON assets;
DROP POLICY IF EXISTS "Client users see client-visible assets"        ON assets;
DROP POLICY IF EXISTS "Team can manage assets"                        ON assets;

CREATE POLICY "Internal users see all assets in their agency"
  ON assets FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see client-visible assets"
  ON assets FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND is_client_visible = TRUE
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Team can manage assets"
  ON assets FOR ALL
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- CONTENT CALENDAR
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see all calendar in their agency"              ON content_calendar;
DROP POLICY IF EXISTS "Client users see their scheduled/posted calendar items"       ON content_calendar;
DROP POLICY IF EXISTS "Team can manage calendar"                                     ON content_calendar;

CREATE POLICY "Internal users see all calendar in their agency"
  ON content_calendar FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their scheduled/posted calendar items"
  ON content_calendar FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND status IN ('scheduled', 'posted')
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Team can manage calendar"
  ON content_calendar FOR ALL
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- PACKAGES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see packages in their agency"       ON packages;
DROP POLICY IF EXISTS "Client users see their own package"                ON packages;
DROP POLICY IF EXISTS "Admins and accountants can manage packages"        ON packages;

CREATE POLICY "Internal users see packages in their agency"
  ON packages FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their own package"
  ON packages FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Admins and accountants can manage packages"
  ON packages FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'accountant'));

-- ─────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see invoices in their agency"      ON invoices;
DROP POLICY IF EXISTS "Client users see their own invoices"              ON invoices;
DROP POLICY IF EXISTS "Admins and accountants can manage invoices"       ON invoices;

CREATE POLICY "Internal users see invoices in their agency"
  ON invoices FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their own invoices"
  ON invoices FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Admins and accountants can manage invoices"
  ON invoices FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'accountant'));

-- ─────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see bookings in their agency" ON bookings;
DROP POLICY IF EXISTS "Client users see their own bookings"         ON bookings;
DROP POLICY IF EXISTS "Team can manage bookings"                    ON bookings;

CREATE POLICY "Internal users see bookings in their agency"
  ON bookings FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see their own bookings"
  ON bookings FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND client_id IN (SELECT id FROM clients WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "Team can manage bookings"
  ON bookings FOR ALL
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see tasks in their agency" ON tasks;
DROP POLICY IF EXISTS "Team can manage tasks"                    ON tasks;

CREATE POLICY "Internal users see tasks in their agency"
  ON tasks FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Team can manage tasks"
  ON tasks FOR ALL
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see their own notifications"                    ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark read)" ON notifications;

CREATE POLICY "Users see their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (mark read)"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY LOGS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see activity in their agency" ON activity_logs;

CREATE POLICY "Internal users see activity in their agency"
  ON activity_logs FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- AI GENERATIONS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see AI generations in their agency" ON ai_generations;
DROP POLICY IF EXISTS "Team can insert AI generations"                    ON ai_generations;

CREATE POLICY "Internal users see AI generations in their agency"
  ON ai_generations FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Team can insert AI generations"
  ON ai_generations FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- BRAND VOICE PROFILES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Internal users see brand voice profiles in their agency" ON brand_voice_profiles;
DROP POLICY IF EXISTS "Admins can manage brand voice profiles"                  ON brand_voice_profiles;

CREATE POLICY "Internal users see brand voice profiles in their agency"
  ON brand_voice_profiles FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Admins can manage brand voice profiles"
  ON brand_voice_profiles FOR ALL
  USING (agency_id = get_my_agency_id()
    AND get_my_role() IN ('owner', 'admin', 'agency_admin', 'project_manager'));
