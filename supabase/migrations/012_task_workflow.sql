-- ============================================================================
-- EZ Marketing Agency — 012 · Task Delivery & Two-Stage Review
-- RUN AFTER: 011_partners.sql
--
-- Flow
--   todo ─► in_progress ─► submitted ─► in_final_review ─► done
--             ▲                │  (team leader)   │  (owner / partner)
--             └── changes_requested ◄─────────────┘
--
--   • The assignee submits work: a note, links (Drive, Canva, Figma…) and
--     uploaded files (private bucket `task-files`). Every submission is a
--     numbered version; nothing is overwritten.
--   • Stage 1 — the task's reviewer (team leader) approves or requests changes.
--   • Stage 2 — someone with `tasks.approve` gives final approval.
--     A task without a reviewer goes straight to stage 2; a task with
--     requires_final_approval = false is done after stage 1.
--   • Nobody can approve their own submission.
--   • Review/submit transitions happen only through the RPCs below; a trigger
--     blocks setting those statuses by hand (except for `tasks.approve`).
--   • Every step writes an in-app notification to the next person.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. PERMISSION
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, module, action, description, is_sensitive) VALUES
  ('tasks.approve', 'tasks', 'approve', 'Give final approval on submitted task work', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('agency_admin', 'tasks.approve'),
  ('partner',      'tasks.approve')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. TASK COLUMNS + STATUSES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN (
  'todo','in_progress','submitted','in_final_review','changes_requested','done','waiting','blocked'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewer_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_reviewer_id_fkey') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_final_approval BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS revision_count INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS tasks_reviewer_idx ON tasks (reviewer_id);

-- ─────────────────────────────────────────────────────────────
-- 3. SUBMISSIONS, FILES, REVIEWS, COMMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version      INT  NOT NULL,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note         TEXT,
  links        JSONB NOT NULL DEFAULT '[]'::JSONB,   -- [{ "url": "...", "label": "..." }]
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','leader_approved','approved','changes_requested')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, version)
);
CREATE INDEX IF NOT EXISTS task_submissions_task_idx ON task_submissions (task_id, version DESC);

CREATE TABLE IF NOT EXISTS task_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'submission' CHECK (kind IN ('brief','submission')),
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  size_bytes    BIGINT,
  mime_type     TEXT,
  uploaded_by   UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_files_task_idx ON task_files (task_id);
CREATE INDEX IF NOT EXISTS task_files_submission_idx ON task_files (submission_id);

CREATE TABLE IF NOT EXISTS task_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE,
  reviewer_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage         TEXT NOT NULL CHECK (stage IN ('leader','final')),
  decision      TEXT NOT NULL CHECK (decision IN ('approved','changes_requested')),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_reviews_task_idx ON task_reviews (task_id, created_at);

CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. VISIBILITY HELPER + TASK POLICIES
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_see_task(p_task UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.id = p_task
       AND t.agency_id = get_my_agency_id()
       AND is_internal_user()
       AND (t.client_id IS NULL
            OR client_in_scope(t.client_id)
            OR t.assigned_to = auth.uid()
            OR t.reviewer_id = auth.uid()
            OR t.created_by  = auth.uid()
            OR has_permission('tasks.approve'))
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Internal users see tasks in scope" ON tasks;
CREATE POLICY "Internal users see tasks in scope" ON tasks FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_id IS NULL
              OR client_in_scope(client_id)
              OR assigned_to = auth.uid()
              OR reviewer_id = auth.uid()
              OR created_by  = auth.uid()
              OR has_permission('tasks.approve')));

-- Writes: managers create/delete; managers, the assignee and the reviewer may
-- update (the guard trigger limits what non-managers can change).
DROP POLICY IF EXISTS "Team can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Managers create tasks" ON tasks;
CREATE POLICY "Managers create tasks" ON tasks FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('tasks.manage'));
DROP POLICY IF EXISTS "Task participants update tasks" ON tasks;
CREATE POLICY "Task participants update tasks" ON tasks FOR UPDATE
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (has_permission('tasks.manage') OR assigned_to = auth.uid() OR reviewer_id = auth.uid()))
  WITH CHECK (agency_id = get_my_agency_id());
DROP POLICY IF EXISTS "Managers delete tasks" ON tasks;
CREATE POLICY "Managers delete tasks" ON tasks FOR DELETE
  USING (agency_id = get_my_agency_id() AND has_permission('tasks.manage'));

-- ─────────────────────────────────────────────────────────────
-- 5. WORKFLOW GUARD
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tasks_workflow_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_rpc BOOLEAN := COALESCE(current_setting('app.task_workflow', TRUE), '') = 'on';
BEGIN
  IF auth.uid() IS NULL OR v_rpc THEN RETURN NEW; END IF;   -- service role / workflow RPC

  -- Non-managers (assignee, reviewer) may only move the status.
  IF NOT has_permission('tasks.manage') AND (
       NEW.title       IS DISTINCT FROM OLD.title OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR
       NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id OR
       NEW.due_date    IS DISTINCT FROM OLD.due_date OR
       NEW.priority    IS DISTINCT FROM OLD.priority OR
       NEW.client_id   IS DISTINCT FROM OLD.client_id OR
       NEW.requires_final_approval IS DISTINCT FROM OLD.requires_final_approval) THEN
    RAISE EXCEPTION 'Only a manager can edit task details.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT has_permission('tasks.approve') THEN
    IF NEW.status IN ('submitted','in_final_review','done','changes_requested')
       OR OLD.status IN ('submitted','in_final_review','done') THEN
      RAISE EXCEPTION 'Use Submit / Review for this step — the status "%" can''t be set by hand.', NEW.status;
    END IF;
  END IF;

  IF NEW.status = 'in_progress' AND OLD.status <> 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    NEW.approved_by  := COALESCE(NEW.approved_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_workflow_guard_trg ON tasks;
CREATE TRIGGER tasks_workflow_guard_trg BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_workflow_guard();

-- ─────────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_task_user(p_user UUID, p_task UUID, p_title TEXT, p_message TEXT)
RETURNS VOID AS $$
  INSERT INTO notifications (agency_id, user_id, title, message, type, action_url)
  SELECT t.agency_id, p_user, p_title, p_message, 'task', '/app/tasks?task=' || t.id
    FROM tasks t
   WHERE t.id = p_task AND p_user IS NOT NULL AND p_user IS DISTINCT FROM auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Everyone who can give final approval (active, same agency).
CREATE OR REPLACE FUNCTION task_final_approvers(p_agency UUID)
RETURNS SETOF UUID AS $$
  SELECT p.id FROM profiles p
   WHERE p.agency_id = p_agency
     AND COALESCE(p.status, 'active') = 'active'
     AND (p.role = 'super_admin'
          OR COALESCE(
               (SELECT up.granted FROM user_permissions up
                 WHERE up.user_id = p.id AND up.permission_key = 'tasks.approve'),
               EXISTS (SELECT 1 FROM role_permissions rp
                        WHERE rp.role_key = p.role AND rp.permission_key = 'tasks.approve')));
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION tasks_assignment_notify()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM notify_task_user(NEW.assigned_to, NEW.id, 'New task assigned',
      NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' · due ' || TO_CHAR(NEW.due_date, 'DD Mon') ELSE '' END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_assignment_notify_trg ON tasks;
CREATE TRIGGER tasks_assignment_notify_trg AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_assignment_notify();

-- ─────────────────────────────────────────────────────────────
-- 7. RPCs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_task_work(
  p_task UUID, p_note TEXT DEFAULT NULL, p_links JSONB DEFAULT '[]'::JSONB, p_file_ids UUID[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  t tasks%ROWTYPE;
  v_sub UUID;
  v_version INT;
  v_next TEXT;
  v_name TEXT;
  v_files INT;
  r UUID;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = p_task FOR UPDATE;
  IF t.id IS NULL OR NOT can_see_task(p_task) THEN RAISE EXCEPTION 'Task not found.'; END IF;
  IF auth.uid() IS DISTINCT FROM t.assigned_to AND NOT has_permission('tasks.manage') THEN
    RAISE EXCEPTION 'Only the person assigned to this task can submit it.';
  END IF;
  IF t.status IN ('submitted','in_final_review','done') THEN
    RAISE EXCEPTION 'This task is already % — wait for the review.', REPLACE(t.status, '_', ' ');
  END IF;

  SELECT COUNT(*) INTO v_files FROM task_files
   WHERE id = ANY(COALESCE(p_file_ids, '{}')) AND task_id = p_task AND submission_id IS NULL;
  IF COALESCE(TRIM(p_note), '') = '' AND jsonb_array_length(COALESCE(p_links, '[]'::JSONB)) = 0 AND v_files = 0 THEN
    RAISE EXCEPTION 'Add a file, a link or a note before submitting.';
  END IF;

  PERFORM set_config('app.task_workflow', 'on', TRUE);

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM task_submissions WHERE task_id = p_task;
  INSERT INTO task_submissions (agency_id, task_id, version, submitted_by, note, links)
  VALUES (t.agency_id, p_task, v_version, auth.uid(), NULLIF(TRIM(p_note), ''), COALESCE(p_links, '[]'::JSONB))
  RETURNING id INTO v_sub;

  UPDATE task_files SET submission_id = v_sub, kind = 'submission'
   WHERE id = ANY(COALESCE(p_file_ids, '{}')) AND task_id = p_task AND submission_id IS NULL;

  v_next := CASE
              WHEN t.reviewer_id IS NOT NULL AND t.reviewer_id IS DISTINCT FROM auth.uid() THEN 'submitted'
              WHEN t.requires_final_approval THEN 'in_final_review'
              ELSE 'submitted' END;
  -- No reviewer and no final approval configured → still needs someone to look.
  IF v_next = 'submitted' AND t.reviewer_id IS NULL THEN v_next := 'in_final_review'; END IF;

  UPDATE tasks SET status = v_next, submitted_at = NOW(),
                   started_at = COALESCE(started_at, NOW())
   WHERE id = p_task;

  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();
  IF v_next = 'submitted' THEN
    PERFORM notify_task_user(t.reviewer_id, p_task, 'Work submitted for your review',
      COALESCE(v_name, 'A team member') || ' submitted "' || t.title || '" (v' || v_version || ').');
  ELSE
    FOR r IN SELECT task_final_approvers(t.agency_id) LOOP
      PERFORM notify_task_user(r, p_task, 'Task waiting for final approval',
        COALESCE(v_name, 'A team member') || ' submitted "' || t.title || '" (v' || v_version || ').');
    END LOOP;
  END IF;
  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION review_task_work(p_task UUID, p_decision TEXT, p_comment TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  t tasks%ROWTYPE;
  s task_submissions%ROWTYPE;
  v_stage TEXT;
  v_next TEXT;
  v_is_approver BOOLEAN := has_permission('tasks.approve');
  v_name TEXT;
  r UUID;
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Decision must be approved or changes_requested.';
  END IF;
  SELECT * INTO t FROM tasks WHERE id = p_task FOR UPDATE;
  IF t.id IS NULL OR NOT can_see_task(p_task) THEN RAISE EXCEPTION 'Task not found.'; END IF;
  IF t.status NOT IN ('submitted','in_final_review') THEN
    RAISE EXCEPTION 'There is no submission waiting for review on this task.';
  END IF;

  SELECT * INTO s FROM task_submissions WHERE task_id = p_task ORDER BY version DESC LIMIT 1;
  IF s.submitted_by = auth.uid() THEN
    RAISE EXCEPTION 'You can''t review your own submission.';
  END IF;

  IF t.status = 'submitted' THEN
    IF auth.uid() IS DISTINCT FROM t.reviewer_id AND NOT v_is_approver THEN
      RAISE EXCEPTION 'Only the task reviewer can review this stage.';
    END IF;
    -- An owner reviewing at stage 1 decides for both stages.
    v_stage := CASE WHEN auth.uid() = t.reviewer_id THEN 'leader' ELSE 'final' END;
  ELSE
    IF NOT v_is_approver THEN
      RAISE EXCEPTION 'Final approval needs the tasks.approve permission.';
    END IF;
    v_stage := 'final';
  END IF;

  IF p_decision = 'changes_requested' AND COALESCE(TRIM(p_comment), '') = '' THEN
    RAISE EXCEPTION 'Write what needs to change.';
  END IF;

  PERFORM set_config('app.task_workflow', 'on', TRUE);

  INSERT INTO task_reviews (agency_id, task_id, submission_id, reviewer_id, stage, decision, comment)
  VALUES (t.agency_id, p_task, s.id, auth.uid(), v_stage, p_decision, NULLIF(TRIM(p_comment), ''));

  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();

  IF p_decision = 'changes_requested' THEN
    v_next := 'changes_requested';
    UPDATE task_submissions SET status = 'changes_requested' WHERE id = s.id;
    UPDATE tasks SET status = v_next, revision_count = revision_count + 1 WHERE id = p_task;
    PERFORM notify_task_user(t.assigned_to, p_task, 'Changes requested',
      COALESCE(v_name, 'Your reviewer') || ' asked for changes on "' || t.title || '": ' || LEFT(TRIM(p_comment), 140));
    IF v_stage = 'final' AND t.reviewer_id IS NOT NULL THEN
      PERFORM notify_task_user(t.reviewer_id, p_task, 'Final review sent back',
        '"' || t.title || '" needs changes: ' || LEFT(TRIM(p_comment), 140));
    END IF;
  ELSIF v_stage = 'leader' AND t.requires_final_approval THEN
    v_next := 'in_final_review';
    UPDATE task_submissions SET status = 'leader_approved' WHERE id = s.id;
    UPDATE tasks SET status = v_next WHERE id = p_task;
    FOR r IN SELECT task_final_approvers(t.agency_id) LOOP
      PERFORM notify_task_user(r, p_task, 'Task waiting for final approval',
        '"' || t.title || '" was approved by ' || COALESCE(v_name, 'the team leader') || '.');
    END LOOP;
  ELSE
    v_next := 'done';
    UPDATE task_submissions SET status = 'approved' WHERE id = s.id;
    UPDATE tasks SET status = 'done', completed_at = NOW(), approved_by = auth.uid() WHERE id = p_task;
    PERFORM notify_task_user(t.assigned_to, p_task, 'Task approved ✓',
      '"' || t.title || '" was approved by ' || COALESCE(v_name, 'management') || '.');
  END IF;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 8. RLS ON THE NEW TABLES
--    Submissions and reviews are written only by the RPCs above.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read submissions" ON task_submissions;
CREATE POLICY "read submissions" ON task_submissions FOR SELECT USING (can_see_task(task_id));

DROP POLICY IF EXISTS "read reviews" ON task_reviews;
CREATE POLICY "read reviews" ON task_reviews FOR SELECT USING (can_see_task(task_id));

DROP POLICY IF EXISTS "read task files" ON task_files;
CREATE POLICY "read task files" ON task_files FOR SELECT USING (can_see_task(task_id));
DROP POLICY IF EXISTS "add task files" ON task_files;
CREATE POLICY "add task files" ON task_files FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND can_see_task(task_id)
              AND uploaded_by = auth.uid() AND submission_id IS NULL);
DROP POLICY IF EXISTS "remove task files" ON task_files;
CREATE POLICY "remove task files" ON task_files FOR DELETE
  USING (can_see_task(task_id)
         AND ((uploaded_by = auth.uid() AND submission_id IS NULL) OR has_permission('tasks.manage')));

DROP POLICY IF EXISTS "read comments" ON task_comments;
CREATE POLICY "read comments" ON task_comments FOR SELECT USING (can_see_task(task_id));
DROP POLICY IF EXISTS "add comments" ON task_comments;
CREATE POLICY "add comments" ON task_comments FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND can_see_task(task_id) AND author_id = auth.uid());
DROP POLICY IF EXISTS "delete own comments" ON task_comments;
CREATE POLICY "delete own comments" ON task_comments FOR DELETE
  USING (author_id = auth.uid() OR has_permission('tasks.manage'));

-- Comment → notify the other people on the task.
CREATE OR REPLACE FUNCTION task_comments_notify()
RETURNS TRIGGER AS $$
DECLARE t tasks%ROWTYPE; v_name TEXT; r UUID;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = NEW.task_id;
  SELECT full_name INTO v_name FROM profiles WHERE id = NEW.author_id;
  FOR r IN SELECT DISTINCT u FROM UNNEST(ARRAY[t.assigned_to, t.reviewer_id, t.created_by]) u WHERE u IS NOT NULL LOOP
    PERFORM notify_task_user(r, t.id, 'New comment on "' || t.title || '"',
      COALESCE(v_name, 'Someone') || ': ' || LEFT(NEW.body, 140));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_comments_notify_trg ON task_comments;
CREATE TRIGGER task_comments_notify_trg AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION task_comments_notify();

-- ─────────────────────────────────────────────────────────────
-- 9. STORAGE — private bucket, path {agency_id}/{task_id}/{file}
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', FALSE, 52428800)   -- 50MB; bigger files go as links
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task files read" ON storage.objects;
CREATE POLICY "task files read" ON storage.objects FOR SELECT
  USING (bucket_id = 'task-files'
         AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
         AND can_see_task(((storage.foldername(name))[2])::UUID));

DROP POLICY IF EXISTS "task files write" ON storage.objects;
CREATE POLICY "task files write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-files'
              AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
              AND can_see_task(((storage.foldername(name))[2])::UUID));

DROP POLICY IF EXISTS "task files delete" ON storage.objects;
CREATE POLICY "task files delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'task-files'
         AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
         AND (owner = auth.uid() OR has_permission('tasks.manage')));

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'tasks_status_check';
--   SELECT proname FROM pg_proc WHERE proname IN ('submit_task_work','review_task_work','can_see_task');
--   SELECT id, public FROM storage.buckets WHERE id = 'task-files';
-- ============================================================================
