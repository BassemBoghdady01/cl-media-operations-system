-- ============================================================================
-- Role matrix report — what each of the 22 roles can SEE and DO at the
-- database level (RLS + RPC checks), without any persistent account.
--
-- Everything runs in ONE transaction that always ends in an exception, so
-- the temporary users/profiles it creates are NEVER committed. It needs the
-- EZ agency id (set below) and reads real rows only to COUNT them.
-- Output: one line per role in the final error message.
--   seen: rows visible per table · perms: key permission checks ·
--   escalate: whether the role can make itself super_admin (must be "blocked")
-- ============================================================================
DO $T$
DECLARE
  A   UUID := 'a1000000-0000-0000-0000-000000000001';
  rk  TEXT;
  uid UUID;
  out TEXT := '';
  line TEXT;
  n INT;
  t TEXT;
BEGIN
  FOR rk IN SELECT key FROM roles ORDER BY level, key LOOP
    uid := gen_random_uuid();
    -- temporary auth user (handle_new_user gives it its own agency) …
    INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'role-matrix-' || rk || '@example.test', jsonb_build_object('full_name', 'Matrix ' || rk), now(), now());
    -- … moved into EZ with the role under test (service path: auth.uid() is NULL here)
    UPDATE profiles SET agency_id = A, role = rk, status = 'active' WHERE id = uid;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    SET LOCAL ROLE authenticated;

    line := rk || ' seen[';
    FOREACH t IN ARRAY ARRAY['clients','client_subscriptions','invoices','finance_transactions','payroll_runs',
                             'partners','profiles','audit_logs','tasks','videos'] LOOP
      BEGIN
        EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
        line := line || t || '=' || n || ' ';
      EXCEPTION WHEN others THEN line := line || t || '=ERR ';
      END;
    END LOOP;
    line := line || '] perms[finance.view=' || has_permission('finance.view')
         || ' partners.view=' || has_permission('partners.view')
         || ' users.manage=' || has_permission('users.manage')
         || ' tasks.approve=' || has_permission('tasks.approve') || ']';
    BEGIN
      UPDATE profiles SET role = 'super_admin' WHERE id = uid;
      GET DIAGNOSTICS n = ROW_COUNT;
      line := line || CASE WHEN n = 0 THEN ' escalate=blocked(RLS)' ELSE ' escalate=ALLOWED!' END;
    EXCEPTION WHEN others THEN line := line || ' escalate=blocked';
    END;

    RESET ROLE;
    out := out || E'\n' || line;
  END LOOP;
  RAISE EXCEPTION 'ROLE MATRIX (rolled back):%', out;
END $T$;
