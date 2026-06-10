# CL — Database Schema
# PostgreSQL / Supabase

## Design Principles
- Multi-tenant: every table has `agency_id` for SaaS isolation
- Soft deletes: `deleted_at` timestamp (not hard delete)
- Files stored as URLs in Supabase Storage — not binary in DB
- All timestamps in UTC

---

## Tables

### agencies
```sql
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  logo_url TEXT,
  plan VARCHAR(20) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  owner_id UUID REFERENCES users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_agencies_owner ON agencies(owner_id);
```

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN (
    'super_admin', 'agency_admin', 'project_manager',
    'editor', 'social_manager', 'creator', 'accountant', 'client'
  )),
  avatar_url TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  availability VARCHAR(15) DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'off')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_agency ON users(agency_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
```

### clients
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  brand_name VARCHAR(200),
  industry VARCHAR(100),
  contact_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  color VARCHAR(7) DEFAULT '#3B82F6',
  portal_access BOOLEAN DEFAULT FALSE,
  portal_password_hash TEXT,
  account_manager_id UUID REFERENCES users(id),
  social_links JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_clients_agency ON clients(agency_id);
CREATE INDEX idx_clients_status ON clients(status);
```

### projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  type VARCHAR(100),
  status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  start_date DATE,
  due_date DATE,
  description TEXT,
  progress SMALLINT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_agency ON projects(agency_id);
CREATE INDEX idx_projects_client ON projects(client_id);
```

### videos
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(500) NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'idea' CHECK (status IN (
    'idea', 'script', 'shooting', 'editing', 'internal_review',
    'client_review', 'revision', 'approved', 'scheduled', 'posted', 'archived'
  )),
  platform VARCHAR(15) CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin')),
  format VARCHAR(15) CHECK (format IN ('reel', 'short', 'ad', 'story', 'longform', 'podcast')),
  aspect_ratio VARCHAR(5) DEFAULT '9:16',
  duration_seconds SMALLINT,
  priority VARCHAR(8) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  version SMALLINT DEFAULT 1,
  revision_count SMALLINT DEFAULT 0,
  approval_status VARCHAR(10) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  assigned_editor_id UUID REFERENCES users(id),
  assigned_script_writer_id UUID REFERENCES users(id),
  assigned_social_manager_id UUID REFERENCES users(id),
  script TEXT,
  hook TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT[],
  notes TEXT,
  due_date DATE,
  scheduled_date TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  posted_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_videos_agency ON videos(agency_id);
CREATE INDEX idx_videos_client ON videos(client_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_due ON videos(due_date);
CREATE INDEX idx_videos_editor ON videos(assigned_editor_id);
```

### video_files
```sql
CREATE TABLE video_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  version SMALLINT NOT NULL DEFAULT 1,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  file_format VARCHAR(20),
  label VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_files_video ON video_files(video_id);
```

### review_comments
```sql
CREATE TABLE review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  text TEXT NOT NULL,
  timestamp_seconds INT,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  is_internal BOOLEAN DEFAULT FALSE,
  parent_id UUID REFERENCES review_comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_video ON review_comments(video_id);
CREATE INDEX idx_comments_status ON review_comments(status);
```

### packages
```sql
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  name VARCHAR(200) NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  included_videos SMALLINT DEFAULT 0,
  consumed_videos SMALLINT DEFAULT 0,
  included_revisions SMALLINT DEFAULT 0,
  consumed_revisions SMALLINT DEFAULT 0,
  included_shooting_days SMALLINT DEFAULT 0,
  consumed_shooting_days SMALLINT DEFAULT 0,
  platforms TEXT[],
  extra_video_price NUMERIC(8,2) DEFAULT 0,
  extra_revision_price NUMERIC(8,2) DEFAULT 0,
  status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date DATE NOT NULL,
  renewal_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_client ON packages(client_id);
CREATE INDEX idx_packages_status ON packages(status);
```

### invoices
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  package_id UUID REFERENCES packages(id),
  subtotal NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status VARCHAR(10) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
```

### bookings
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_hours NUMERIC(4,1) NOT NULL,
  location TEXT NOT NULL,
  studio VARCHAR(100),
  status VARCHAR(15) DEFAULT 'requested' CHECK (status IN (
    'requested', 'confirmed', 'deposit_paid', 'scheduled', 'completed', 'cancelled', 'rescheduled'
  )),
  shot_list TEXT[],
  notes TEXT,
  deposit_amount NUMERIC(8,2),
  deposit_paid BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: bookings ↔ team members
CREATE TABLE booking_team (
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, user_id)
);

CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_date ON bookings(date);
```

### assets
```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  type VARCHAR(15) CHECK (type IN ('logo', 'color', 'font', 'intro', 'music', 'image', 'video', 'document', 'other')),
  name VARCHAR(300) NOT NULL,
  file_url TEXT NOT NULL,
  folder VARCHAR(200),
  file_size_bytes BIGINT,
  file_format VARCHAR(20),
  is_approved BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id),
  tags TEXT[],
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_assets_client ON assets(client_id);
CREATE INDEX idx_assets_type ON assets(type);
```

### tasks
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(12) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'waiting', 'done', 'blocked')),
  priority VARCHAR(8) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  client_id UUID REFERENCES clients(id),
  video_id UUID REFERENCES videos(id),
  project_id UUID REFERENCES projects(id),
  tags TEXT[],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(25) NOT NULL,
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  client_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifs_user ON notifications(user_id);
CREATE INDEX idx_notifs_read ON notifications(is_read);
```

### activity_logs
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(200) NOT NULL,
  target VARCHAR(300),
  target_type VARCHAR(20),
  target_id UUID,
  client_name VARCHAR(200),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_agency ON activity_logs(agency_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
```

### ai_generations
```sql
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  user_id UUID REFERENCES users(id),
  tool VARCHAR(30) NOT NULL,  -- 'content_ideas', 'reel_script', 'caption', 'hooks', 'angles', 'calendar'
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  tokens_used INT,
  model VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agency ON ai_generations(agency_id);
CREATE INDEX idx_ai_tool ON ai_generations(tool);
```

### content_calendar
```sql
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  video_id UUID REFERENCES videos(id),
  title VARCHAR(300) NOT NULL,
  platform VARCHAR(15),
  scheduled_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(15) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed', 'cancelled')),
  caption TEXT,
  hashtags TEXT[],
  posted_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_agency ON content_calendar(agency_id);
CREATE INDEX idx_calendar_date ON content_calendar(scheduled_date);
CREATE INDEX idx_calendar_client ON content_calendar(client_id);
```

---

## Row Level Security (Supabase RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Example policy: users can only see data from their agency
CREATE POLICY "agency_isolation" ON videos
  FOR ALL USING (agency_id = (SELECT agency_id FROM users WHERE id = auth.uid()));
```

---

## Notes
- All video files stored in Supabase Storage, referenced by URL
- Supabase Auth handles passwords — no passwords stored in `users` table
- `agency_id` on every table enables multi-tenant isolation via RLS
- Use PostgREST auto-generated API via Supabase client
