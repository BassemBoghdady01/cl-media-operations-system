-- ============================================================
-- EZ Marketing Agency — Media Operations System
-- Supabase / PostgreSQL Schema
-- Version: 1.0.0
--
-- Run order:
--   1. schema.sql      (this file)
--   2. rls-policies.sql
--   3. storage.sql
--   4. seed.sql        (optional, for initial presentation data)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- ─────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 1. AGENCIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  logo_url     TEXT,
  website      TEXT,
  phone        TEXT,
  email        TEXT,
  plan         TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2. PROFILES (extends auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id    UUID REFERENCES agencies(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  username     TEXT UNIQUE,
  email        TEXT NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  color        TEXT DEFAULT '#3B82F6',
  role         TEXT NOT NULL DEFAULT 'editor' CHECK (role IN (
                 'owner', 'admin', 'project_manager', 'editor',
                 'social_media_manager', 'accountant', 'client', 'creator'
               )),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_agency_id_idx ON profiles (agency_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3. CLIENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id               UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  brand_name              TEXT,
  industry                TEXT,
  contact_name            TEXT,
  email                   TEXT,
  phone                   TEXT,
  website                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  color                   TEXT DEFAULT '#3B82F6',
  assigned_manager_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  portal_access_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  portal_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  social_links            JSONB DEFAULT '{}'::jsonb,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_agency_id_idx ON clients (agency_id);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients (status);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 4. PROJECTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  start_date   DATE,
  due_date     DATE,
  progress     INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_ids     UUID[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_agency_id_idx ON projects (agency_id);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_due_date_idx ON projects (due_date);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 5. VIDEOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  platform              TEXT CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin')),
  format                TEXT CHECK (format IN ('reel', 'short', 'ad', 'story', 'longform', 'podcast')),
  aspect_ratio          TEXT CHECK (aspect_ratio IN ('9:16', '1:1', '16:9')),
  duration              TEXT,
  priority              TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status                TEXT NOT NULL DEFAULT 'idea' CHECK (status IN (
                          'idea', 'script', 'shooting', 'editing',
                          'internal_review', 'client_review', 'revision',
                          'approved', 'scheduled', 'posted', 'archived'
                        )),
  approval_status       TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN (
                          'pending', 'internal_approved', 'client_approved',
                          'revision_requested', 'rejected'
                        )),
  assigned_editor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_manager_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date              DATE,
  scheduled_at          TIMESTAMPTZ,
  posted_at             TIMESTAMPTZ,
  published_url         TEXT,
  thumbnail_url         TEXT,
  final_file_url        TEXT,
  hook                  TEXT,
  script                TEXT,
  caption               TEXT,
  hashtags              TEXT[],
  cta                   TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  revision_count        INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS videos_agency_id_idx ON videos (agency_id);
CREATE INDEX IF NOT EXISTS videos_client_id_idx ON videos (client_id);
CREATE INDEX IF NOT EXISTS videos_project_id_idx ON videos (project_id);
CREATE INDEX IF NOT EXISTS videos_status_idx ON videos (status);
CREATE INDEX IF NOT EXISTS videos_approval_status_idx ON videos (approval_status);
CREATE INDEX IF NOT EXISTS videos_due_date_idx ON videos (due_date);
CREATE INDEX IF NOT EXISTS videos_scheduled_at_idx ON videos (scheduled_at);
CREATE INDEX IF NOT EXISTS videos_assigned_editor_id_idx ON videos (assigned_editor_id);

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 6. VIDEO VERSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id        UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  file_url        TEXT,
  thumbnail_url   TEXT,
  notes           TEXT,
  uploaded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, version_number)
);

CREATE INDEX IF NOT EXISTS video_versions_video_id_idx ON video_versions (video_id);
CREATE INDEX IF NOT EXISTS video_versions_agency_id_idx ON video_versions (agency_id);

-- ─────────────────────────────────────────────────────────────
-- 7. REVIEW COMMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  video_id          UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  version_id        UUID REFERENCES video_versions(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timestamp_seconds NUMERIC,
  comment           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_comments_video_id_idx ON review_comments (video_id);
CREATE INDEX IF NOT EXISTS review_comments_agency_id_idx ON review_comments (agency_id);
CREATE INDEX IF NOT EXISTS review_comments_user_id_idx ON review_comments (user_id);

CREATE TRIGGER review_comments_updated_at
  BEFORE UPDATE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 8. ASSETS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id          UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  type               TEXT CHECK (type IN ('logo', 'color', 'font', 'intro', 'music', 'image', 'video', 'document', 'other')),
  folder             TEXT DEFAULT 'General',
  file_url           TEXT,
  file_size          BIGINT,
  mime_type          TEXT,
  format             TEXT,
  tags               TEXT[],
  is_approved        BOOLEAN NOT NULL DEFAULT FALSE,
  is_client_visible  BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_agency_id_idx ON assets (agency_id);
CREATE INDEX IF NOT EXISTS assets_client_id_idx ON assets (client_id);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets (type);

-- ─────────────────────────────────────────────────────────────
-- 9. CONTENT CALENDAR
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_calendar (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  video_id       UUID REFERENCES videos(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  platform       TEXT CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin')),
  caption        TEXT,
  hashtags       TEXT[],
  scheduled_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                   'draft', 'scheduled', 'posted', 'cancelled'
                 )),
  published_url  TEXT,
  assigned_to    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_calendar_agency_id_idx ON content_calendar (agency_id);
CREATE INDEX IF NOT EXISTS content_calendar_client_id_idx ON content_calendar (client_id);
CREATE INDEX IF NOT EXISTS content_calendar_scheduled_at_idx ON content_calendar (scheduled_at);
CREATE INDEX IF NOT EXISTS content_calendar_status_idx ON content_calendar (status);

CREATE TRIGGER content_calendar_updated_at
  BEFORE UPDATE ON content_calendar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 10. PACKAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id                 UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id                 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  monthly_price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'USD',
  included_videos           INTEGER NOT NULL DEFAULT 0,
  consumed_videos           INTEGER NOT NULL DEFAULT 0,
  included_revisions        INTEGER NOT NULL DEFAULT 0,
  consumed_revisions        INTEGER NOT NULL DEFAULT 0,
  included_shooting_days    INTEGER NOT NULL DEFAULT 0,
  consumed_shooting_days    INTEGER NOT NULL DEFAULT 0,
  extra_video_price         NUMERIC(10,2) DEFAULT 0,
  extra_revision_price      NUMERIC(10,2) DEFAULT 0,
  platforms                 TEXT[],
  renewal_date              DATE,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS packages_agency_id_idx ON packages (agency_id);
CREATE INDEX IF NOT EXISTS packages_client_id_idx ON packages (client_id);
CREATE INDEX IF NOT EXISTS packages_renewal_date_idx ON packages (renewal_date);

CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 11. INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_id      UUID REFERENCES packages(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date        DATE,
  issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_at         TIMESTAMPTZ,
  file_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_agency_id_idx ON invoices (agency_id);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices (due_date);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 12. BOOKINGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  location          TEXT,
  studio            TEXT,
  booking_date      DATE NOT NULL,
  start_time        TIME,
  end_time          TIME,
  status            TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
                      'requested', 'confirmed', 'deposit_paid', 'scheduled',
                      'completed', 'cancelled', 'rescheduled'
                    )),
  assigned_team_ids UUID[],
  checklist         JSONB DEFAULT '[]'::jsonb,
  shot_list         TEXT[],
  deposit_amount    NUMERIC(10,2) DEFAULT 0,
  deposit_paid      BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_agency_id_idx ON bookings (agency_id);
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON bookings (client_id);
CREATE INDEX IF NOT EXISTS bookings_booking_date_idx ON bookings (booking_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 13. TASKS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  video_id     UUID REFERENCES videos(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'waiting', 'done', 'blocked')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date     DATE,
  tags         TEXT[],
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_agency_id_idx ON tasks (agency_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks (due_date);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 14. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN (
                 'video_review', 'revision_request', 'approval', 'invoice',
                 'package_limit', 'shooting', 'comment', 'task', 'file', 'scheduled', 'posted'
               )),
  read_at      TIMESTAMPTZ,
  action_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_agency_id_idx ON notifications (agency_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications (read_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 15. ACTIVITY LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type   TEXT NOT NULL CHECK (entity_type IN (
                  'video', 'client', 'invoice', 'task', 'project', 'asset', 'booking'
                )),
  entity_id     UUID,
  action        TEXT NOT NULL,
  description   TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_logs_agency_id_idx ON activity_logs (agency_id);
CREATE INDEX IF NOT EXISTS activity_logs_actor_id_idx ON activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS activity_logs_entity_type_idx ON activity_logs (entity_type);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 16. AI GENERATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_generations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tool_type    TEXT NOT NULL CHECK (tool_type IN (
                 'hooks', 'scripts', 'captions', 'ideas', 'angles', 'calendar'
               )),
  input        JSONB NOT NULL DEFAULT '{}'::jsonb,
  output       JSONB NOT NULL DEFAULT '{}'::jsonb,
  model        TEXT,
  tokens_used  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_generations_agency_id_idx ON ai_generations (agency_id);
CREATE INDEX IF NOT EXISTS ai_generations_client_id_idx ON ai_generations (client_id);
CREATE INDEX IF NOT EXISTS ai_generations_created_by_idx ON ai_generations (created_by);
CREATE INDEX IF NOT EXISTS ai_generations_tool_type_idx ON ai_generations (tool_type);

-- ─────────────────────────────────────────────────────────────
-- 17. BRAND VOICE PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_voice_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  tone              TEXT,
  target_audience   TEXT,
  forbidden_words   TEXT[],
  preferred_cta     TEXT,
  brand_description TEXT,
  competitors       TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brand_voice_profiles_agency_id_idx ON brand_voice_profiles (agency_id);
CREATE INDEX IF NOT EXISTS brand_voice_profiles_client_id_idx ON brand_voice_profiles (client_id);

CREATE TRIGGER brand_voice_profiles_updated_at
  BEFORE UPDATE ON brand_voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
