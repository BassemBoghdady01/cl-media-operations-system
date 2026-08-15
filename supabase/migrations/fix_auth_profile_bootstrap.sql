-- ============================================================================
-- EZ Marketing Agency — Fix Auth Profile Bootstrap & Role Vocabulary
--
-- PURPOSE
--   Repairs the role vocabulary mismatch that caused a blank screen after login,
--   and hardens the profile bootstrap so an auth user can never exist without a
--   usable profile.
--
-- SAFETY
--   • ADDITIVE and IDEMPOTENT — safe to run more than once.
--   • Does NOT drop tables, does NOT delete users, does NOT reset anything.
--   • Preserves existing role assignments (values are translated, not cleared).
--   • Preserves existing agencies (no agency is ever deleted or reassigned).
--
-- BACKGROUND
--   profiles.role allowed:  owner | admin | project_manager | editor |
--                           social_media_manager | accountant | client | creator
--   the application used:   super_admin | agency_admin | project_manager | editor |
--                           social_manager | accountant | client | creator
--
--   Three values disagreed. A profile carrying 'admin' or 'owner' produced a role
--   the route guards did not recognise; the guard redirected to /app/dashboard,
--   which the same guard protects, so the app looped until React unmounted.
--
--   Additionally the app wrote role='agency_admin' during first-login recovery,
--   which the old CHECK constraint rejected — leaving profiles unlinked.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. WIDEN THE ROLE CONSTRAINT (accept canonical + legacy)
--    Done before the data migration so no row is ever in violation mid-flight.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  -- canonical (what the application uses)
  'super_admin', 'agency_admin', 'project_manager', 'editor',
  'social_manager', 'creator', 'accountant', 'client',
  -- legacy (tolerated so pre-migration rows and old clients keep working)
  'owner', 'admin', 'social_media_manager'
));

-- ─────────────────────────────────────────────────────────────
-- 2. MIGRATE EXISTING ROLE VALUES TO CANONICAL
--    Role INTENT is preserved: an owner stays the most privileged, an admin
--    stays an agency admin. Nothing is downgraded and nothing is cleared.
-- ─────────────────────────────────────────────────────────────
UPDATE profiles SET role = 'super_admin'    WHERE role = 'owner';
UPDATE profiles SET role = 'agency_admin'   WHERE role = 'admin';
UPDATE profiles SET role = 'social_manager' WHERE role = 'social_media_manager';

-- Anything unrecognised (hand-edited, imported, or NULL) becomes the safest
-- non-privileged internal role rather than being left unusable.
UPDATE profiles
SET role = 'editor'
WHERE role IS NULL
   OR role NOT IN (
     'super_admin', 'agency_admin', 'project_manager', 'editor',
     'social_manager', 'creator', 'accountant', 'client'
   );

-- ─────────────────────────────────────────────────────────────
-- 3. DEFAULT ROLE FOR NEW PROFILES
--    'editor' = least-privilege internal member. The first user of a brand-new
--    agency is promoted to agency_admin in step 5.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'editor';

-- ─────────────────────────────────────────────────────────────
-- 4. HELPER FUNCTIONS — align with canonical vocabulary
--    Keep legacy values in the IN-lists so the helpers stay correct even if a
--    stray legacy row reappears from an old client.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('super_admin', 'agency_admin', 'owner', 'admin')
     FROM profiles WHERE id = auth.uid()),
    FALSE
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role <> 'client' FROM profiles WHERE id = auth.uid()),
    FALSE
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 5. REPAIR THE SIGNUP TRIGGER
--    The old handle_new_user() inserted only (id, email, full_name), so every
--    new profile arrived with agency_id NULL and relied on the client to repair
--    it. This version provisions the agency in the same transaction.
--
--    SECURITY DEFINER lets it write regardless of RLS.
--    EXCEPTION guard: a failure here must never block user creation.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_agency_id   UUID;
  v_full_name   TEXT;
  v_agency_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_agency_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_name'), ''),
    v_full_name || '''s Agency'
  );

  -- Create the workspace this user will own.
  INSERT INTO agencies (name, plan)
  VALUES (v_agency_name, 'starter')
  RETURNING id INTO v_agency_id;

  -- First user of a new agency owns it.
  INSERT INTO profiles (id, email, full_name, agency_id, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_agency_id, 'agency_admin')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation. Fall back to a bare profile; the app's
  -- bootstrap path (AuthContext.resolveSession) completes the repair on login.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 6. BACKFILL — auth users with no profile row
--    Existing users are never touched; only genuinely missing rows are created.
-- ─────────────────────────────────────────────────────────────
INSERT INTO profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(u.email, '@', 1)
  ),
  'editor'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 7. BACKFILL — profiles with no agency
--    Documented bootstrap strategy: a profile with no agency gets its OWN new
--    agency and becomes that agency's admin. This is the safe choice — joining
--    them to someone else's existing agency would leak another tenant's data.
--    Existing agency assignments are never modified.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  v_agency   UUID;
BEGIN
  FOR r IN
    SELECT id, full_name, email FROM profiles WHERE agency_id IS NULL
  LOOP
    INSERT INTO agencies (name, plan)
    VALUES (
      COALESCE(NULLIF(TRIM(r.full_name), ''), SPLIT_PART(r.email, '@', 1)) || '''s Agency',
      'starter'
    )
    RETURNING id INTO v_agency;

    -- Promote to agency_admin ONLY if they are still on the default role.
    -- A deliberate assignment (accountant, client, …) is preserved as-is.
    UPDATE profiles
    SET agency_id = v_agency,
        role      = CASE WHEN role = 'editor' THEN 'agency_admin' ELSE role END
    WHERE id = r.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — ensure self-read / self-insert / self-update survive
--    Re-asserted idempotently; these are what let a user bootstrap themselves.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile or profiles in their agency" ON profiles;
CREATE POLICY "Users can view own profile or profiles in their agency"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR agency_id = get_my_agency_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile or admins can insert any" ON profiles;
CREATE POLICY "Users can insert own profile or admins can insert any"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Authenticated users can create their agency" ON agencies;
CREATE POLICY "Authenticated users can create their agency"
  ON agencies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own agency" ON agencies;
CREATE POLICY "Users can view their own agency"
  ON agencies FOR SELECT
  USING (id = get_my_agency_id());

COMMIT;

-- ============================================================================
-- VERIFICATION — run these after the migration; all should return 0 rows.
-- ============================================================================
-- Profiles still carrying a non-canonical role:
--   SELECT id, email, role FROM profiles
--   WHERE role NOT IN ('super_admin','agency_admin','project_manager','editor',
--                      'social_manager','creator','accountant','client');
--
-- Auth users with no profile:
--   SELECT u.id, u.email FROM auth.users u
--   LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL;
--
-- Profiles with no agency:
--   SELECT id, email FROM profiles WHERE agency_id IS NULL;
--
-- Review the resulting role distribution:
--   SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY 2 DESC;
-- ============================================================================
