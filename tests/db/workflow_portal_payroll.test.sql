-- ============================================================================
-- Regression test — task approval workflow across distinct identities,
-- client review portal, payroll RPCs (migration 019), cross-agency isolation.
--
-- ONE transaction that always ends in an exception: the temporary users,
-- client, task, video and payroll rows it creates are NEVER committed.
-- Result: the final error lists every check as ok:/FAIL:.
-- Edit A (agency) and B (an active super_admin of that agency) if needed.
-- ============================================================================
DO $T$
DECLARE
  A   UUID := 'a1000000-0000-0000-0000-000000000001';
  B   UUID := 'eea39cc8-a9a4-427d-a0ad-dd2fee9ed49c';
  E   UUID := gen_random_uuid();   -- employee (video_editor)
  E2  UUID := gen_random_uuid();   -- another employee, not on this client
  TL  UUID := gen_random_uuid();   -- team leader (reviewer on the task)
  V   UUID := gen_random_uuid();   -- viewer
  CL  UUID := gen_random_uuid();   -- client portal user
  OUTS UUID := gen_random_uuid();  -- outsider: fresh public sign-up, own agency
  qc  UUID; tsk UUID; vid UUID; run UUID; real_client UUID;
  r TEXT := ''; n INT; s TEXT; ok BOOLEAN; x NUMERIC;
BEGIN
  -- ── Setup (service path) ──────────────────────────────────────────────────
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', em, jsonb_build_object('full_name', nm), now(), now()
    FROM (VALUES (E,'qa-e@example.test','QA Employee'), (E2,'qa-e2@example.test','QA Employee 2'),
                 (TL,'qa-tl@example.test','QA Team Leader'), (V,'qa-v@example.test','QA Viewer'),
                 (CL,'qa-cl@example.test','QA Client'), (OUTS,'qa-out@example.test','QA Outsider')) v(u,em,nm);
  INSERT INTO clients (agency_id, name, status) VALUES (A, 'QA Temp Client', 'active') RETURNING id INTO qc;
  SELECT id INTO real_client FROM clients WHERE agency_id = A AND id <> qc ORDER BY created_at LIMIT 1;
  UPDATE profiles SET agency_id = A, role = 'video_editor',    status = 'active' WHERE id = E;
  UPDATE profiles SET agency_id = A, role = 'graphic_designer', status = 'active' WHERE id = E2;
  UPDATE profiles SET agency_id = A, role = 'project_manager',  status = 'active' WHERE id = TL;
  UPDATE profiles SET agency_id = A, role = 'viewer',           status = 'active' WHERE id = V;
  UPDATE profiles SET agency_id = A, role = 'client', client_id = qc, status = 'active' WHERE id = CL;
  INSERT INTO user_clients (user_id, client_id) VALUES (E, qc), (TL, qc);

  -- ── 1. Super Admin creates the task ───────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO tasks (agency_id, client_id, title, assigned_to, reviewer_id, requires_final_approval, created_by)
  VALUES (A, qc, '[QA] Edit reel', E, TL, TRUE, B) RETURNING id INTO tsk;
  r := r || ' | ok:task created';
  RESET ROLE;
  SELECT count(*) INTO n FROM notifications WHERE user_id = E AND action_url LIKE '%' || tsk || '%';
  r := r || CASE WHEN n >= 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'employee notified of assignment (' || n || ')';

  -- ── 2. Unassigned employee / viewer / client cannot reach it ──────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E2, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E2::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM tasks WHERE id = tsk;
  r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'other employee cannot see the task';
  UPDATE tasks SET title = 'hijack' WHERE id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'other employee cannot edit it';
  BEGIN PERFORM submit_task_work(tsk, 'x', '[]', NULL); r := r || ' | FAIL:other employee submitted';
  EXCEPTION WHEN others THEN r := r || ' | ok:other employee cannot submit'; END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', CL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', CL::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM tasks; r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'client sees no internal tasks';
  RESET ROLE;

  -- ── 3. Employee: cannot bypass, then submits ──────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM tasks WHERE id = tsk; r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'employee sees own task';
  BEGIN UPDATE tasks SET reviewer_id = E WHERE id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
    SELECT reviewer_id = TL INTO ok FROM tasks WHERE id = tsk;
    r := r || CASE WHEN ok THEN ' | ok:' ELSE ' | FAIL:' END || 'employee cannot change own reviewer';
  EXCEPTION WHEN others THEN r := r || ' | ok:employee cannot change own reviewer'; END;
  BEGIN UPDATE tasks SET requires_final_approval = FALSE WHERE id = tsk;
    SELECT requires_final_approval INTO ok FROM tasks WHERE id = tsk;
    r := r || CASE WHEN ok THEN ' | ok:' ELSE ' | FAIL:' END || 'employee cannot drop final approval';
  EXCEPTION WHEN others THEN r := r || ' | ok:employee cannot drop final approval'; END;
  BEGIN UPDATE tasks SET status = 'done' WHERE id = tsk;
    SELECT status <> 'done' INTO ok FROM tasks WHERE id = tsk;
    r := r || CASE WHEN ok THEN ' | ok:' ELSE ' | FAIL:' END || 'employee cannot complete without approval';
  EXCEPTION WHEN others THEN r := r || ' | ok:employee cannot complete without approval'; END;
  BEGIN PERFORM submit_task_work(tsk, '', '[]', NULL); r := r || ' | FAIL:empty submission accepted';
  EXCEPTION WHEN others THEN r := r || ' | ok:empty submission rejected'; END;
  PERFORM submit_task_work(tsk, 'v1', '[{"url":"https://example.test/v1","label":"draft"}]', NULL);
  SELECT status INTO s FROM tasks WHERE id = tsk; r := r || CASE WHEN s = 'submitted' THEN ' | ok:' ELSE ' | FAIL:' END || 'submitted → ' || coalesce(s,'NULL');
  BEGIN PERFORM review_task_work(tsk, 'approved', NULL); r := r || ' | FAIL:self-approval allowed';
  EXCEPTION WHEN others THEN r := r || ' | ok:self-approval blocked'; END;
  RESET ROLE;
  SELECT count(*) INTO n FROM notifications WHERE user_id = TL AND action_url LIKE '%' || tsk || '%';
  r := r || CASE WHEN n >= 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'team leader notified (' || n || ')';

  -- ── 4. Team Leader requests changes, employee resubmits ───────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', TL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', TL::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM review_task_work(tsk, 'changes_requested', ''); r := r || ' | FAIL:changes without comment';
  EXCEPTION WHEN others THEN r := r || ' | ok:changes need a comment'; END;
  PERFORM review_task_work(tsk, 'changes_requested', 'Tighten the intro');
  SELECT status || '/rev' || revision_count INTO s FROM tasks WHERE id = tsk; r := r || ' | ok:TL changes → ' || coalesce(s,'NULL');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM submit_task_work(tsk, 'v2', '[{"url":"https://example.test/v2"}]', NULL);
  RESET ROLE;

  -- ── 5. Team Leader approves → final review ────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', TL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', TL::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM review_task_work(tsk, 'approved', NULL);
  SELECT status INTO s FROM tasks WHERE id = tsk; r := r || CASE WHEN s = 'in_final_review' THEN ' | ok:' ELSE ' | FAIL:' END || 'TL approval → ' || coalesce(s,'NULL');
  ok := has_permission('tasks.approve');
  BEGIN PERFORM review_task_work(tsk, 'approved', NULL);
    r := r || ' | NOTE:team leader (project_manager) can ALSO give final approval (has tasks.approve=' || coalesce(ok::text,'NULL') || ')';
    RAISE EXCEPTION 'undo';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'undo' THEN NULL; ELSE r := r || ' | ok:TL cannot give final approval'; END IF;
  END;
  RESET ROLE;
  SELECT count(*) INTO n FROM notifications WHERE user_id = B AND action_url LIKE '%' || tsk || '%';
  r := r || CASE WHEN n >= 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'final approver notified (' || n || ')';

  -- ── 6. Final approver sends back, then approves ───────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM review_task_work(tsk, 'changes_requested', 'Logo too small');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM submit_task_work(tsk, 'v3', '[{"url":"https://example.test/v3"}]', NULL);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', TL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', TL::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM review_task_work(tsk, 'approved', NULL);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM review_task_work(tsk, 'approved', NULL);
  SELECT status || ' approved_by_owner=' || (approved_by = B) || ' completed=' || (completed_at IS NOT NULL) || ' rev=' || revision_count
    INTO s FROM tasks WHERE id = tsk;
  r := r || CASE WHEN s LIKE 'done approved_by_owner=true completed=true%' THEN ' | ok:' ELSE ' | FAIL:' END || 'final → ' || coalesce(s,'NULL');
  RESET ROLE;

  -- ── 7. Approved work cannot be altered by the employee ────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE task_submissions SET note = 'edited after approval' WHERE task_id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'approved submission not editable (' || n || ' rows)';
  EXCEPTION WHEN others THEN r := r || ' | ok:approved submission not editable'; END;
  BEGIN DELETE FROM task_submissions WHERE task_id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'submissions not deletable (' || n || ')';
  EXCEPTION WHEN others THEN r := r || ' | ok:submissions not deletable'; END;
  BEGIN DELETE FROM task_reviews WHERE task_id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'reviews not deletable (' || n || ')';
  EXCEPTION WHEN others THEN r := r || ' | ok:reviews not deletable'; END;
  BEGIN UPDATE tasks SET status = 'in_progress' WHERE id = tsk;
    SELECT status = 'done' INTO ok FROM tasks WHERE id = tsk;
    r := r || CASE WHEN ok THEN ' | ok:' ELSE ' | FAIL:' END || 'done task not reopened by employee';
  EXCEPTION WHEN others THEN r := r || ' | ok:done task not reopened by employee'; END;
  RESET ROLE;

  -- ── 8. History and audit ──────────────────────────────────────────────────
  SELECT count(*) INTO n FROM task_submissions WHERE task_id = tsk; r := r || ' | history: submissions=' || n;
  SELECT count(*) INTO n FROM task_reviews WHERE task_id = tsk; r := r || ' reviews=' || n;
  SELECT count(*) INTO n FROM audit_logs WHERE entity_id = tsk OR (entity_type IN ('task_submissions','task_reviews') AND created_at >= now());
  r := r || CASE WHEN n > 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'audit rows=' || n;

  -- ── 9. Viewer ─────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE tasks SET title = 'viewer edit' WHERE id = tsk; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'viewer cannot edit tasks';
  BEGIN INSERT INTO clients (agency_id, name) VALUES (A, 'viewer client'); r := r || ' | FAIL:viewer created a client';
  EXCEPTION WHEN others THEN r := r || ' | ok:viewer cannot create clients'; END;
  SELECT count(*) INTO n FROM finance_transactions; r := r || ' | viewer sees finance rows=' || n;
  RESET ROLE;

  -- ── 10. Client portal ─────────────────────────────────────────────────────
  INSERT INTO videos (agency_id, client_id, title, status, assigned_editor_id) VALUES (A, qc, '[QA] Reel v1', 'client_review', E) RETURNING id INTO vid;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', CL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', CL::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM clients; r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'client sees only own client record (' || n || ')';
  SELECT count(*) INTO n FROM videos WHERE client_id IS DISTINCT FROM qc; r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'client sees no other clients'' videos';
  SELECT count(*) INTO n FROM invoices WHERE client_id IS DISTINCT FROM qc; r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'client sees no other invoices';
  SELECT count(*) INTO n FROM finance_transactions; r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'client sees no ledger';
  BEGIN PERFORM client_review_video(vid, 'revision', ''); r := r || ' | FAIL:revision without comment';
  EXCEPTION WHEN others THEN r := r || ' | ok:revision needs a comment'; END;
  PERFORM client_review_video(vid, 'revision', 'Please change the music');
  SELECT status || '/' || approval_status INTO s FROM videos WHERE id = vid; r := r || ' | ok:client revision → ' || coalesce(s,'NULL');
  BEGIN UPDATE videos SET status = 'approved' WHERE id = vid; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'client cannot edit videos directly';
  EXCEPTION WHEN others THEN r := r || ' | ok:client cannot edit videos directly'; END;
  RESET ROLE;
  SELECT count(*) INTO n FROM notifications WHERE user_id = E AND action_url = '/app/pipeline/' || vid;
  r := r || CASE WHEN n >= 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'editor notified of client revision';
  UPDATE videos SET status = 'client_review' WHERE id = vid;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', CL, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', CL::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM client_review_video(vid, 'approved', NULL);
  SELECT status || '/' || approval_status INTO s FROM videos WHERE id = vid;
  r := r || CASE WHEN s = 'approved/client_approved' THEN ' | ok:' ELSE ' | FAIL:' END || 'client approval → ' || coalesce(s,'NULL');
  BEGIN PERFORM client_review_video(vid, 'approved', NULL); r := r || ' | FAIL:approved twice';
  EXCEPTION WHEN others THEN r := r || ' | ok:cannot approve twice'; END;
  RESET ROLE;

  -- ── 11. Payroll (migration 019) ───────────────────────────────────────────
  INSERT INTO employee_compensation (agency_id, user_id, base_salary, currency, status) VALUES (A, E, 12000, 'EGP', 'active');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SET LOCAL ROLE authenticated;
  run := build_payroll_run(A, 2030, 1);
  SELECT count(*) INTO n FROM payroll_items WHERE payroll_run_id = run; r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'payroll run built (' || n || ' item)';
  IF build_payroll_run(A, 2030, 1) = run THEN r := r || ' | ok:rebuild returns same run'; ELSE r := r || ' | FAIL:second run'; END IF;
  SELECT count(*) INTO n FROM payroll_items WHERE payroll_run_id = run; r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'no duplicate items';
  BEGIN PERFORM post_payroll_run(run, NULL); r := r || ' | FAIL:posted a draft run';
  EXCEPTION WHEN others THEN r := r || ' | ok:draft run cannot be posted'; END;
  RESET ROLE;
  UPDATE payroll_runs SET status = 'approved' WHERE id = run;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SET LOCAL ROLE authenticated;
  n := post_payroll_run(run, NULL); r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'posted ' || n || ' ledger row';
  n := post_payroll_run(run, NULL); r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 're-post adds ' || n;
  n := mark_payroll_paid(run, NULL); r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'paid ' || n;
  n := mark_payroll_paid(run, NULL); r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 're-pay settles ' || n;
  SELECT count(*), sum(amount) INTO n, x FROM finance_transactions WHERE payroll_item_id IN (SELECT id FROM payroll_items WHERE payroll_run_id = run);
  r := r || CASE WHEN n = 1 THEN ' | ok:' ELSE ' | FAIL:' END || 'ledger rows=' || n || ' amount=' || coalesce(x::text,'NULL');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM build_payroll_run(A, 2030, 2); r := r || ' | FAIL:employee ran payroll';
  EXCEPTION WHEN others THEN r := r || ' | ok:employee cannot run payroll'; END;
  SELECT count(*) INTO n FROM payroll_items WHERE user_id <> E; r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'employee sees no one else''s pay';
  RESET ROLE;

  -- ── 12. Outsider (own agency) ─────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OUTS, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', OUTS::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM build_payroll_run(A, 2030, 3); r := r || ' | FAIL:outsider ran EZ payroll';
  EXCEPTION WHEN others THEN r := r || ' | ok:outsider cannot run EZ payroll'; END;
  BEGIN PERFORM mark_payroll_paid(run, NULL); r := r || ' | FAIL:outsider paid EZ payroll';
  EXCEPTION WHEN others THEN r := r || ' | ok:outsider cannot pay EZ payroll'; END;
  BEGIN PERFORM review_task_work(tsk, 'approved', NULL); r := r || ' | FAIL:outsider reviewed EZ task';
  EXCEPTION WHEN others THEN r := r || ' | ok:outsider cannot review EZ tasks'; END;
  SELECT (SELECT count(*) FROM tasks) + (SELECT count(*) FROM clients) + (SELECT count(*) FROM payroll_runs) + (SELECT count(*) FROM finance_transactions) INTO n;
  r := r || CASE WHEN n = 0 THEN ' | ok:' ELSE ' | FAIL:' END || 'outsider sees no EZ rows (' || n || ')';
  RESET ROLE;

  RAISE EXCEPTION 'WORKFLOW/PORTAL/PAYROLL (rolled back):%', coalesce(r,'<r became NULL>');
END $T$;
