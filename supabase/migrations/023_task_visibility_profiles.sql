-- ============================================================================
-- EZ Marketing Agency — 023 · Explicit task visibility · staff privacy ·
--                              admin edits of department / job title
-- RUN AFTER: 022_security_hotfix.sql
--
-- 1. TASKS — assignment-based visibility. Before: any task without a client
--    was visible to every internal user, and anyone with tasks.manage (which
--    editors, designers and videographers have) could edit or delete any task.
--    Now a task is visible to:
--      • its assignee, reviewer and creator — always;
--      • final approvers (tasks.approve: owner, partners, agency admins);
--      • agency-wide managers (tasks.manage + agency scope, e.g. operations);
--      • assigned-scope staff with tasks.manage — only for clients they are
--        assigned to (never other people's internal, client-less tasks).
--    Edit/delete need visibility as well; the workflow guard is unchanged.
--    Submissions, reviews, files and comments follow can_see_task() already.
-- 2. PROFILES — client accounts see only their own profile (no staff emails or
--    phones). Internal staff still see their agency's directory.
-- 3. admin_update_profile() — lets an administrator (users.edit) change a
--    colleague's name, department, job title and colour inside their own
--    agency; a Super Admin profile only by a Super Admin. Role / status /
--    agency stay with the admin API. Self-service keeps working.
-- SAFETY: CREATE OR REPLACE + ALTER POLICY. No data changed.
-- ============================================================================

-- ── 1. Tasks ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_see_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.id = p_task
       AND t.agency_id = get_my_agency_id()
       AND is_internal_user()
       AND (   t.assigned_to = auth.uid()
            OR t.reviewer_id = auth.uid()
            OR t.created_by  = auth.uid()
            OR has_permission('tasks.approve')
            OR (has_permission('tasks.manage') AND my_role_scope() = 'agency')
            OR (has_permission('tasks.manage') AND t.client_id IS NOT NULL AND client_in_scope(t.client_id)))
  );
$function$;

ALTER POLICY "Internal users see tasks in scope" ON tasks
  USING ((agency_id = get_my_agency_id()) AND can_see_task(id));

ALTER POLICY "Task participants update tasks" ON tasks
  USING ((agency_id = get_my_agency_id()) AND can_see_task(id)
         AND (has_permission('tasks.manage') OR assigned_to = auth.uid() OR reviewer_id = auth.uid()))
  WITH CHECK (agency_id = get_my_agency_id());

ALTER POLICY "Managers delete tasks" ON tasks
  USING ((agency_id = get_my_agency_id()) AND has_permission('tasks.manage') AND can_see_task(id));

-- ── 2. Profiles: clients see only themselves ────────────────────────────────
ALTER POLICY "Users can view own profile or profiles in their agency" ON profiles
  USING ((id = auth.uid()) OR ((agency_id = get_my_agency_id()) AND is_internal_user()));

-- ── 3. Administrator edits of non-privileged profile fields ────────────────
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user UUID,
  p_full_name TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_clear_department BOOLEAN DEFAULT FALSE,
  p_clear_job_title BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  t profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO t FROM profiles WHERE id = p_user FOR UPDATE;
  IF t.id IS NULL OR t.agency_id IS DISTINCT FROM get_my_agency_id() THEN
    RAISE EXCEPTION 'User not found in your workspace.';
  END IF;
  IF p_user <> auth.uid() THEN
    IF NOT has_permission('users.edit') THEN
      RAISE EXCEPTION 'You do not have permission to edit team members.';
    END IF;
    IF t.role = 'super_admin' AND NOT is_super_admin() THEN
      RAISE EXCEPTION 'Only a Super Admin can edit a Super Admin profile.';
    END IF;
  END IF;
  UPDATE profiles SET
    full_name  = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
    department = CASE WHEN p_clear_department THEN NULL ELSE COALESCE(NULLIF(TRIM(p_department), ''), department) END,
    job_title  = CASE WHEN p_clear_job_title  THEN NULL ELSE COALESCE(NULLIF(TRIM(p_job_title), ''), job_title) END,
    color      = COALESCE(NULLIF(TRIM(p_color), ''), color),
    updated_at = NOW()
  WHERE id = p_user;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
