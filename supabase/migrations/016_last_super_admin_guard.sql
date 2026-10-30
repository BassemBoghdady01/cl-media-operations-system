-- ============================================================================
-- EZ Marketing Agency — 016 · Last-Super-Admin guard (database level)
-- RUN AFTER: 015_task_audit.sql
--
-- protect_super_admin() already stopped non-super-admins from touching a
-- Super Admin, and stopped demoting the last one. Two gaps remained:
--   • a Super Admin could DEACTIVATE themselves while being the only active
--     Super Admin (locking the agency out of user management), and
--   • the "last one" count included inactive Super Admins.
-- Now: the last ACTIVE Super Admin can be neither demoted nor deactivated,
-- by anyone, from any signed-in path. Service-role paths (auth.uid() IS NULL:
-- migrations, the admin API which runs its own identical check) are unchanged.
-- SAFETY: CREATE OR REPLACE of one function. No tables, policies or data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_is_super BOOLEAN := is_super_admin();
  v_other_active   INTEGER;
BEGIN
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
    IF NEW.role = 'super_admin' AND OLD.role <> 'super_admin' AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role.';
    END IF;

    IF OLD.role = 'super_admin'
       AND (NEW.role <> 'super_admin' OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'active')) THEN
      IF NOT v_actor_is_super THEN
        RAISE EXCEPTION 'Only a Super Admin can change or deactivate a Super Admin.';
      END IF;
      SELECT COUNT(*) INTO v_other_active
        FROM profiles
       WHERE role = 'super_admin' AND status = 'active' AND id <> OLD.id;
      IF v_other_active = 0 THEN
        RAISE EXCEPTION 'This is the last active Super Admin — it cannot be demoted or deactivated.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' AND NOT v_actor_is_super THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin') THEN
      RAISE EXCEPTION 'Only a Super Admin can create another Super Admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
