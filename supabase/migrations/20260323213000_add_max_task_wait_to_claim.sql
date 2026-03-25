-- Add starvation protection to claim_next_task_service_role via p_max_task_wait_minutes.
--
-- Workers can still prefer tasks matching their current model, but once any
-- eligible queued task has waited past the threshold we fall back to pure FIFO.

BEGIN;

-- IMPORTANT: drop the old 4-arg overload before creating the 5-arg version.
-- CREATE OR REPLACE only replaces identical signatures.
DROP FUNCTION IF EXISTS public.claim_next_task_service_role(TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION claim_next_task_service_role(
  p_worker_id TEXT,
  p_include_active BOOLEAN DEFAULT FALSE,
  p_run_type TEXT DEFAULT NULL,
  p_same_model_only BOOLEAN DEFAULT FALSE,
  p_max_task_wait_minutes INT DEFAULT 5
)
RETURNS TABLE(
  task_id UUID,
  params JSONB,
  task_type TEXT,
  project_id UUID,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_params JSONB;
  v_task_type TEXT;
  v_project_id UUID;
  v_user_id UUID;
  v_status_filter task_status[];
  v_worker_model TEXT;
  v_has_starving_task BOOLEAN := FALSE;
  v_no_matching_tasks BOOLEAN := FALSE;
  v_effective_max_task_wait_minutes INT := COALESCE(p_max_task_wait_minutes, 5);
BEGIN
  -- Set status filter based on include_active flag
  IF p_include_active THEN
    v_status_filter := ARRAY['Queued'::task_status, 'In Progress'::task_status];
  ELSE
    v_status_filter := ARRAY['Queued'::task_status];
  END IF;

  -- Get worker's current model for affinity matching
  SELECT current_model INTO v_worker_model
  FROM workers
  WHERE id = p_worker_id AND status = 'active';

  -- Compute eligible users once and reuse for both starvation check and claim query
  CREATE TEMP TABLE _eligible_users ON COMMIT DROP AS
    SELECT
      u.id as user_id,
      u.credits,
      COALESCE((u.settings->'ui'->'generationMethods'->>'inCloud')::boolean, true) as allows_cloud,
      COUNT(in_progress_tasks.id) as in_progress_count
    FROM users u
    LEFT JOIN projects p ON p.user_id = u.id
    LEFT JOIN tasks in_progress_tasks ON in_progress_tasks.project_id = p.id
      AND in_progress_tasks.status = 'In Progress'::task_status
      AND COALESCE(in_progress_tasks.task_type, '') NOT ILIKE '%orchestrator%'
    WHERE u.credits > 0
      AND COALESCE((u.settings->'ui'->'generationMethods'->>'inCloud')::boolean, true) = true
    GROUP BY u.id, u.credits, u.settings
    HAVING COUNT(in_progress_tasks.id) < 5;

  -- Bypass model affinity when:
  -- 1. No matching-model tasks exist (nothing to wait for), OR
  -- 2. Any eligible task has waited longer than the max wait threshold (starvation protection)
  IF p_same_model_only AND v_worker_model IS NOT NULL THEN
    SELECT
      NOT bool_or(get_task_model(t.params) = v_worker_model),  -- no matching tasks
      bool_or(t.created_at < NOW() - (v_effective_max_task_wait_minutes || ' minutes')::interval)  -- any starving task
    INTO v_no_matching_tasks, v_has_starving_task
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status = 'Queued'::task_status
      AND all_dependencies_complete(t.dependant_on)
      AND EXISTS (
        SELECT 1 FROM _eligible_users eu WHERE eu.user_id = p.user_id
      )
      AND (
        p_run_type IS NULL OR
        get_task_run_type(t.task_type) = p_run_type
      );

    -- Coalesce NULLs (empty queue = no matching tasks, no starving tasks)
    v_no_matching_tasks := COALESCE(v_no_matching_tasks, TRUE);
    v_has_starving_task := COALESCE(v_has_starving_task, FALSE);
  END IF;

  -- Single atomic query to find and claim the next eligible task
  WITH ready_tasks AS (
    SELECT
      t.id,
      t.params,
      t.task_type,
      t.project_id,
      t.created_at,
      p.user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN v_has_starving_task OR v_no_matching_tasks THEN NULL
            WHEN v_worker_model IS NOT NULL
                 AND get_task_model(t.params) = v_worker_model
            THEN 0
            ELSE 1
          END NULLS LAST,
          t.created_at ASC
      ) as rn
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status = 'Queued'::task_status
      AND all_dependencies_complete(t.dependant_on)
      AND EXISTS (
        SELECT 1 FROM _eligible_users eu WHERE eu.user_id = p.user_id
      )
      AND (
        p_run_type IS NULL OR
        get_task_run_type(t.task_type) = p_run_type
      )
      AND (
        v_has_starving_task
        OR v_no_matching_tasks
        OR NOT p_same_model_only
        OR v_worker_model IS NULL
        OR get_task_model(t.params) = v_worker_model
      )
  )
  UPDATE tasks
  SET
    status = CASE
      WHEN status = 'Queued'::task_status THEN 'In Progress'::task_status
      ELSE status
    END,
    worker_id = CASE
      WHEN status = 'Queued'::task_status THEN p_worker_id
      ELSE worker_id
    END,
    updated_at = CASE
      WHEN status = 'Queued'::task_status THEN NOW()
      ELSE updated_at
    END,
    generation_started_at = CASE
      WHEN status = 'Queued'::task_status THEN NOW()
      ELSE generation_started_at
    END
  FROM ready_tasks rt
  WHERE tasks.id = rt.id
    AND rt.rn = 1
    AND (NOT p_include_active OR tasks.status = 'Queued'::task_status)
  RETURNING
    tasks.id,
    tasks.params,
    tasks.task_type,
    tasks.project_id,
    rt.user_id
  INTO v_task_id, v_params, v_task_type, v_project_id, v_user_id;

  IF v_task_id IS NOT NULL THEN
    task_id := v_task_id;
    params := v_params;
    task_type := v_task_type;
    project_id := v_project_id;
    user_id := v_user_id;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION claim_next_task_service_role(TEXT, BOOLEAN, TEXT, BOOLEAN, INT) IS
'Claims next eligible task for service role. Supports multiple dependencies (all must be complete). Prioritizes model affinity until any eligible task exceeds the max wait threshold, then falls back to FIFO. Excludes orchestrators from concurrency limit.';

COMMIT;
