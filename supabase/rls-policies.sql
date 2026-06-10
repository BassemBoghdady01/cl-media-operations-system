-- ============================================================
-- CL — Row Level Security Policies
-- Run AFTER schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- HELPER: get current user's agency_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- HELPER: get current user's role
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- HELPER: check if user is internal (not a client)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
  SELECT role NOT IN ('client') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- HELPER: check if user is admin/owner
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('owner', 'admin') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- ENABLE RLS on all tables
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
CREATE POLICY "Users can view their own agency"
  ON agencies FOR SELECT
  USING (id = get_my_agency_id());

CREATE POLICY "Admins can update their agency"
  ON agencies FOR UPDATE
  USING (id = get_my_agency_id() AND is_admin());

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view profiles in their agency"
  ON profiles FOR SELECT
  USING (agency_id = get_my_agency_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal users see all clients in their agency"
  ON clients FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Client users see only their own record"
  ON clients FOR SELECT
  USING (portal_user_id = auth.uid());

CREATE POLICY "Admins and managers can manage clients"
  ON clients FOR ALL
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'project_manager'));

-- ─────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────
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
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'project_manager'));

-- ─────────────────────────────────────────────────────────────
-- VIDEOS
-- ─────────────────────────────────────────────────────────────
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
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'project_manager'));

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
    -- Clients can only add non-internal comments
    AND (is_internal_user() OR is_internal = FALSE)
  );

CREATE POLICY "Users can update their own comments"
  ON review_comments FOR UPDATE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- ASSETS
-- ─────────────────────────────────────────────────────────────
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
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'accountant'));

-- ─────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────
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
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'accountant'));

-- ─────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────
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
CREATE POLICY "Internal users see tasks in their agency"
  ON tasks FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Team can manage tasks"
  ON tasks FOR ALL
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users see their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (mark read)"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY LOGS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal users see activity in their agency"
  ON activity_logs FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- AI GENERATIONS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal users see AI generations in their agency"
  ON ai_generations FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Team can insert AI generations"
  ON ai_generations FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND is_internal_user());

-- ─────────────────────────────────────────────────────────────
-- BRAND VOICE PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal users see brand voice profiles in their agency"
  ON brand_voice_profiles FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user());

CREATE POLICY "Admins can manage brand voice profiles"
  ON brand_voice_profiles FOR ALL
  USING (agency_id = get_my_agency_id() AND get_my_role() IN ('owner', 'admin', 'project_manager'));
