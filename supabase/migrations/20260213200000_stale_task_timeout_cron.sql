-- =====================================================================
-- Auto-fail stale tasks and orphaned children
-- Created: 2026-02-13
-- Purpose: Workers may crash, leaving tasks permanently in progress.
--          This cron job auto-fails them hourly so they don't block UIs.
--          Also fails Queued tasks whose dependency has failed (orphans).
-- =====================================================================

-- Function to fail stale tasks + orphaned children
CREATE OR REPLACE FUNCTION public.auto_fail_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stale_count INTEGER;
  orphan_count INTEGER;
BEGIN
  -- 1. Fail tasks stuck In Progress for >24 hours
  UPDATE tasks
  SET
    status = 'Failed'::task_status,
    error_message = 'Auto-failed: stuck in progress for >24 hours',
    updated_at = NOW()
  WHERE status = 'In Progress'::task_status
    AND updated_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS stale_count = ROW_COUNT;

  -- 2. Fail Queued tasks whose dependency has failed (orphaned children)
  UPDATE tasks t
  SET
    status = 'Failed'::task_status,
    error_message = 'Auto-failed: dependency task failed',
    updated_at = NOW()
  FROM tasks dep
  WHERE t.status = 'Queued'::task_status
    AND t.dependant_on IS NOT NULL
    AND dep.id = t.dependant_on
    AND dep.status IN ('Failed'::task_status, 'Cancelled'::task_status);

  GET DIAGNOSTICS orphan_count = ROW_COUNT;

  IF stale_count > 0 OR orphan_count > 0 THEN
    RAISE NOTICE 'auto_fail_stale_tasks: failed % stale + % orphaned task(s)', stale_count, orphan_count;
  END IF;

  RETURN stale_count + orphan_count;
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
