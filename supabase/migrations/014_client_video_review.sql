-- ============================================================================
-- EZ Marketing Agency — 014 · Client portal: approve / request revision
-- RUN AFTER: 013_partner_advance_offsets.sql
--
-- The client portal showed "Action required — review now" but clients had no
-- way to act: they have no UPDATE policy on videos (by design). This adds ONE
-- narrow, permission-checked RPC instead of opening the table:
--   • caller must be the portal user of the video's client (my_client_id())
--   • the video must be in client_review
--   • approve → status approved / approval_status client_approved
--   • revision → status revision / approval_status revision_requested,
--     revision_count + 1, and the client's comment saved in review_comments
--   • the account manager and editor get an in-app notification
-- SAFETY: additive (one function). No tables, policies or data changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION client_review_video(p_video UUID, p_decision TEXT, p_comment TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v videos%ROWTYPE;
  v_next TEXT;
  v_name TEXT;
  r UUID;
BEGIN
  IF p_decision NOT IN ('approved','revision') THEN
    RAISE EXCEPTION 'Decision must be approved or revision.';
  END IF;
  SELECT * INTO v FROM videos WHERE id = p_video FOR UPDATE;
  IF v.id IS NULL OR my_client_id() IS NULL OR v.client_id IS DISTINCT FROM my_client_id() THEN
    RAISE EXCEPTION 'Video not found.';
  END IF;
  IF v.status <> 'client_review' THEN
    RAISE EXCEPTION 'This video is not waiting for your review.';
  END IF;
  IF p_decision = 'revision' AND COALESCE(TRIM(p_comment), '') = '' THEN
    RAISE EXCEPTION 'Tell us what to change.';
  END IF;

  IF p_decision = 'approved' THEN
    v_next := 'approved';
    UPDATE videos SET status = 'approved', approval_status = 'client_approved' WHERE id = p_video;
  ELSE
    v_next := 'revision';
    UPDATE videos SET status = 'revision', approval_status = 'revision_requested',
                      revision_count = COALESCE(revision_count, 0) + 1
     WHERE id = p_video;
  END IF;

  IF COALESCE(TRIM(p_comment), '') <> '' THEN
    INSERT INTO review_comments (agency_id, video_id, user_id, comment, is_internal)
    VALUES (v.agency_id, p_video, auth.uid(), TRIM(p_comment), FALSE);
  END IF;

  SELECT name INTO v_name FROM clients WHERE id = v.client_id;
  FOR r IN SELECT DISTINCT u FROM UNNEST(ARRAY[v.assigned_manager_id, v.assigned_editor_id]) u WHERE u IS NOT NULL LOOP
    INSERT INTO notifications (agency_id, user_id, title, message, type, action_url)
    VALUES (v.agency_id, r,
            CASE WHEN v_next = 'approved' THEN 'Client approved a video' ELSE 'Client requested a revision' END,
            COALESCE(v_name, 'The client') || ' — "' || v.title || '"'
              || CASE WHEN v_next = 'revision' THEN ': ' || LEFT(TRIM(p_comment), 140) ELSE '' END,
            CASE WHEN v_next = 'approved' THEN 'approval' ELSE 'revision_request' END,
            '/app/pipeline/' || v.id);
  END LOOP;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
