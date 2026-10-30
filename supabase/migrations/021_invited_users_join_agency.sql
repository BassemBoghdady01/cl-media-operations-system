-- ============================================================================
-- EZ Marketing Agency — 021 · Admin-created users join the inviting agency
-- RUN AFTER: 020_bill_overdue_subscriptions.sql
--
-- handle_new_user() created a brand-new agency for EVERY new auth user. When a
-- Super Admin adds an employee through /api/admin/users, the API then moved
-- the profile into EZ — leaving one empty orphan agency per employee.
-- Now, when the auth user carries app_metadata.agency_id (app_metadata can
-- only be written with the service role, never by a public sign-up), the
-- profile is created directly in that agency and no agency is created.
-- Public sign-ups are unchanged (user_metadata is ignored for this).
-- SAFETY: CREATE OR REPLACE of one trigger function. No data changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_agency_id   UUID;
  v_full_name   TEXT;
  v_agency_name TEXT;
  v_invited     UUID;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Service-role path (admin API): join the existing agency, no new workspace.
  BEGIN
    v_invited := NULLIF(NEW.raw_app_meta_data->>'agency_id', '')::UUID;
  EXCEPTION WHEN others THEN v_invited := NULL;
  END;
  IF v_invited IS NOT NULL AND EXISTS (SELECT 1 FROM agencies WHERE id = v_invited) THEN
    INSERT INTO profiles (id, email, full_name, agency_id, role, status)
    VALUES (NEW.id, NEW.email, v_full_name, v_invited, 'viewer', 'active')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;   -- the admin API sets the real role/department right after
  END IF;

  v_agency_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_name'), ''),
    v_full_name || '''s Agency'
  );

  INSERT INTO agencies (name, plan)
  VALUES (v_agency_name, 'starter')
  RETURNING id INTO v_agency_id;

  INSERT INTO profiles (id, email, full_name, agency_id, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_agency_id, 'agency_admin')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, v_full_name)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user fallback also failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
