-- ============================================================================
-- EZ Marketing Agency — 015 · Task workflow in the Audit Log
-- RUN AFTER: 014_client_video_review.sql
--
-- Tasks, submissions and reviews are written to audit_logs by the same
-- write_audit_log() trigger the finance tables use (actor, before/after).
-- SAFETY: additive — three triggers, no data changed.
-- ============================================================================

DROP TRIGGER IF EXISTS audit_tasks ON tasks;
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_task_submissions ON task_submissions;
CREATE TRIGGER audit_task_submissions AFTER INSERT OR UPDATE OR DELETE ON task_submissions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_task_reviews ON task_reviews;
CREATE TRIGGER audit_task_reviews AFTER INSERT OR UPDATE OR DELETE ON task_reviews
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
