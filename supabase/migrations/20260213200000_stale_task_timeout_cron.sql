-- =====================================================================
-- Auto-fail stale orchestrator tasks stuck "In Progress" for >24 hours
-- Created: 2026-02-13
-- Purpose: Workers may crash, leaving tasks permanently in progress.
--          This cron job auto-fails them hourly so they don't block UIs.
-- =====================================================================

-- Function to fail stale tasks
CREATE OR REPLACE FUNCTION public.auto_fail_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE tasks
  SET
    status = 'Failed'::task_status,
    error_message = 'Auto-failed: stuck in progress for >24 hours',
    updated_at = NOW()
  WHERE status = 'In Progress'::task_status
    AND updated_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  IF affected_count > 0 THEN
    RAISE NOTICE 'auto_fail_stale_tasks: failed % stale task(s)', affected_count;
  END IF;

  RETURN affected_count;
END;
$$;

-- Schedule hourly via pg_cron (extension already enabled in earlier migration)
SELECT cron.schedule(
  'auto-fail-stale-tasks',
  '0 * * * *',
  $$SELECT auto_fail_stale_tasks();$$
);

-- Verify
SELECT 'auto-fail-stale-tasks cron job scheduled' AS status;
