-- ============================================================================
-- QA cleanup — removes ONLY the temporary QA client, its records, and the
-- @example.test accounts. Audit-log rows are kept (audit integrity).
--
-- Step 1 (dry run): run as-is — it reports what would be deleted and rolls
--                   back.  Step 2: change the last line to COMMIT.
-- ============================================================================
BEGIN;

CREATE TEMP TABLE qa_users ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email LIKE '%@example.test';
CREATE TEMP TABLE qa_clients ON COMMIT DROP AS
  SELECT id FROM clients WHERE name = 'QA Temp Client (delete me)';

-- Task workflow records
DELETE FROM task_comments    WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '[QA]%' OR client_id IN (SELECT id FROM qa_clients));
DELETE FROM task_reviews     WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '[QA]%' OR client_id IN (SELECT id FROM qa_clients));
DELETE FROM task_files       WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '[QA]%' OR client_id IN (SELECT id FROM qa_clients));
DELETE FROM task_submissions WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '[QA]%' OR client_id IN (SELECT id FROM qa_clients));
DELETE FROM tasks            WHERE title LIKE '[QA]%' OR client_id IN (SELECT id FROM qa_clients);
-- Uploaded files of those tasks (storage objects under the task-files bucket)
DELETE FROM storage.objects  WHERE bucket_id = 'task-files'
   AND owner IN (SELECT id FROM qa_users);

-- Portal records
DELETE FROM review_comments  WHERE video_id IN (SELECT id FROM videos WHERE client_id IN (SELECT id FROM qa_clients));
DELETE FROM videos           WHERE client_id IN (SELECT id FROM qa_clients);
DELETE FROM user_clients     WHERE user_id IN (SELECT id FROM qa_users) OR client_id IN (SELECT id FROM qa_clients);
DELETE FROM user_permissions WHERE user_id IN (SELECT id FROM qa_users);
DELETE FROM notifications    WHERE user_id IN (SELECT id FROM qa_users);
DELETE FROM clients          WHERE id IN (SELECT id FROM qa_clients);

-- Accounts (profiles cascade from auth.users)
DELETE FROM auth.users       WHERE id IN (SELECT id FROM qa_users);
-- Any empty agency a QA account may have created
DELETE FROM agencies a WHERE a.name ILIKE 'QA%' AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.agency_id = a.id);

-- Verification — every count must be 0
SELECT
  (SELECT count(*) FROM auth.users WHERE email LIKE '%@example.test')                  AS qa_users_left,
  (SELECT count(*) FROM clients    WHERE name = 'QA Temp Client (delete me)')            AS qa_clients_left,
  (SELECT count(*) FROM tasks      WHERE title LIKE '[QA]%')                              AS qa_tasks_left,
  (SELECT count(*) FROM videos     WHERE title LIKE '[QA]%')                              AS qa_videos_left;

ROLLBACK;   -- change to COMMIT after reviewing the dry run
