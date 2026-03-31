CREATE OR REPLACE FUNCTION public.auto_fail_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stale_count INTEGER;
  orphan_count INTEGER;
BEGIN
  UPDATE tasks
  SET
    status = 'Failed'::task_status,
    error_message = 'Auto-failed: stuck in progress for >24 hours',
    updated_at = NOW()
  WHERE status = 'In Progress'::task_status
    AND updated_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS stale_count = ROW_COUNT;

  WITH orphaned_tasks AS (
    SELECT DISTINCT t.id
    FROM tasks t
    CROSS JOIN LATERAL unnest(t.dependant_on) AS dependency(dependency_id)
    JOIN tasks dep
      ON dep.id = dependency.dependency_id
    WHERE t.status = 'Queued'::task_status
      AND t.dependant_on IS NOT NULL
      AND dep.status IN ('Failed'::task_status, 'Cancelled'::task_status)
  )
  UPDATE tasks t
  SET
    status = 'Failed'::task_status,
    error_message = 'Auto-failed: dependency task failed',
    updated_at = NOW()
  FROM orphaned_tasks
  WHERE t.id = orphaned_tasks.id;

  GET DIAGNOSTICS orphan_count = ROW_COUNT;

  IF stale_count > 0 OR orphan_count > 0 THEN
    RAISE NOTICE 'auto_fail_stale_tasks: failed % stale + % orphaned task(s)', stale_count, orphan_count;
  END IF;

  RETURN stale_count + orphan_count;
END;
$$;
