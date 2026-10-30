-- ============================================================================
-- EZ Marketing Agency — 022 · SECURITY HOTFIX
-- RUN AFTER: 021_invited_users_join_agency.sql
--
-- Found by the rolled-back role-matrix test (tests/db/role_matrix.report.sql):
--
-- 1. CRITICAL — self-promotion / workspace takeover.
--    The profiles policy "Users can update their own profile" has no column
--    limits, so ANY signed-in user (even a client or a viewer) could set their
--    own role to agency_admin, or move themselves into another agency by
--    setting agency_id. With public sign-up on, a stranger could join EZ as an
--    admin. A BEFORE trigger now limits self-service edits to personal fields
--    (name, phone, avatar, colour, job title, department, username).
--    Kept: the one-time bootstrap where a profile with NO agency attaches
--    itself to a brand-new, EMPTY agency and becomes its admin (sign-up repair
--    path in AuthContext). Service-role paths (admin API, triggers) unchanged.
-- 2. HIGH — cross-agency permission writes. user_permissions / user_clients
--    policies checked the permission but not the agency, so an admin of ANY
--    agency could grant/revoke EZ users' permissions or client assignments.
--    Now scoped to users (and clients) of the caller's agency, and nobody can
--    edit their own permission overrides.
-- 3. HIGH — client portal showed nothing for clients created in User
--    Management. Portal policies looked only at clients.portal_user_id, which
--    nothing sets; the admin API links client users through profiles.client_id.
--    Portal policies now accept either link (portal_client_ids()).
-- 4. HARDENING — every SECURITY DEFINER function in public gets a fixed
--    search_path (public, extensions, pg_temp), and logged-out visitors (anon)
--    can no longer execute SECURITY DEFINER functions (none is used before
--    sign-in).
-- SAFETY: functions, one trigger, ALTER POLICY (no DROP), ALTER FUNCTION,
-- REVOKE. No data changed.
-- ============================================================================

-- ── 1. Profile self-service guard ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_self_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_uid       UUID := auth.uid();
  v_super     BOOLEAN;
  v_bootstrap BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;          -- service role / triggers / admin API
  v_super := is_super_admin();

  IF TG_OP = 'INSERT' THEN
    IF NOT v_super AND (NEW.id IS DISTINCT FROM v_uid
         OR NEW.agency_id IS NOT NULL
         OR COALESCE(NEW.role, 'viewer') <> 'viewer'
         OR NEW.client_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A new profile can only be your own, without a workspace or role.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'A profile id cannot change.';
  END IF;

  v_bootstrap := OLD.id = v_uid
             AND OLD.agency_id IS NULL
             AND NEW.agency_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.agency_id = NEW.agency_id AND p.id <> OLD.id);

  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id AND NOT v_bootstrap THEN
    RAISE EXCEPTION 'A profile cannot be moved to another workspace.';
  END IF;

  IF v_super THEN RETURN NEW; END IF;                -- protect_super_admin still applies

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT (v_bootstrap AND NEW.role = 'agency_admin') THEN
    RAISE EXCEPTION 'Roles are changed by an administrator in User Management.';
  END IF;
  IF NEW.status         IS DISTINCT FROM OLD.status
  OR NEW.client_id      IS DISTINCT FROM OLD.client_id
  OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
  OR NEW.email          IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Only an administrator can change account status, client link or email.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_self_guard ON profiles;
CREATE TRIGGER profiles_self_guard
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_self_guard();

-- ── 2. Permission overrides & client assignments: own agency only ────────────
ALTER POLICY "Manage user permissions" ON user_permissions
  USING (has_permission('users.manage_roles') AND user_id <> auth.uid()
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_permissions.user_id AND p.agency_id = get_my_agency_id()))
  WITH CHECK (has_permission('users.manage_roles') AND user_id <> auth.uid()
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_permissions.user_id AND p.agency_id = get_my_agency_id()));

ALTER POLICY "Read own or managed user permissions" ON user_permissions
  USING (user_id = auth.uid()
         OR (has_permission('users.view')
             AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_permissions.user_id AND p.agency_id = get_my_agency_id())));

ALTER POLICY "manage assignments" ON user_clients
  USING (has_permission('users.edit')
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_clients.user_id AND p.agency_id = get_my_agency_id())
         AND EXISTS (SELECT 1 FROM clients c WHERE c.id = user_clients.client_id AND c.agency_id = get_my_agency_id()))
  WITH CHECK (has_permission('users.edit')
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_clients.user_id AND p.agency_id = get_my_agency_id())
         AND EXISTS (SELECT 1 FROM clients c WHERE c.id = user_clients.client_id AND c.agency_id = get_my_agency_id()));

ALTER POLICY "read own or managed assignments" ON user_clients
  USING (user_id = auth.uid()
         OR (has_permission('users.view')
             AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_clients.user_id AND p.agency_id = get_my_agency_id())));

-- ── 3. Client portal: accept profiles.client_id as well as portal_user_id ────
CREATE OR REPLACE FUNCTION public.portal_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
  SELECT c.id FROM clients c WHERE c.portal_user_id = auth.uid()
  UNION
  SELECT p.client_id FROM profiles p
   WHERE p.id = auth.uid() AND p.role = 'client' AND p.status = 'active' AND p.client_id IS NOT NULL;
$function$;
REVOKE EXECUTE ON FUNCTION public.portal_client_ids() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.portal_client_ids() TO authenticated;

DO $$
DECLARE
  pol RECORD;
  v_old TEXT := '(clients.portal_user_id = auth.uid())';
  v_new TEXT := '((clients.portal_user_id = auth.uid()) OR (clients.id IN ( SELECT portal_client_ids() AS portal_client_ids)))';
BEGIN
  FOR pol IN
    SELECT tablename, policyname, qual FROM pg_policies
     WHERE schemaname = 'public' AND qual LIKE '%' || v_old || '%' AND qual NOT LIKE '%portal_client_ids%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', pol.policyname, pol.tablename, replace(pol.qual, v_old, v_new));
  END LOOP;
END $$;

ALTER POLICY "Client users see only their own record" ON clients
  USING ((portal_user_id = auth.uid()) OR (id IN (SELECT portal_client_ids())));

-- ── 4. Hardening: fixed search_path, no anon execution of definer functions ─
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, pg_get_function_result(p.oid) AS res
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND p.prokind = 'f'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc q WHERE q.oid = f.sig::oid AND q.proconfig IS NOT NULL) THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.sig);
    END IF;
    IF f.res <> 'trigger' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    END IF;
  END LOOP;
END $$;

-- 019 revoked these from browser roles on purpose — keep them service-role only.
REVOKE EXECUTE ON FUNCTION public.generate_subscription_cycles(integer)    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_expenses(integer)     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_user(uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.task_final_approvers(uuid)               FROM authenticated;
