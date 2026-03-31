-- Add crash recovery to the worker heartbeat RPC.
-- When guardians report `status_param = 'crashed'`, tasks currently assigned to
-- the worker are either requeued with an incremented attempt count or failed
-- terminally with cascading failure propagation.

CREATE OR REPLACE FUNCTION func_worker_heartbeat_with_logs(
    worker_id_param text,
    vram_total_mb_param int DEFAULT NULL,
    vram_used_mb_param int DEFAULT NULL,
    logs_param jsonb DEFAULT '[]'::jsonb,
    current_task_id_param uuid DEFAULT NULL,
    status_param text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_metadata jsonb;
    log_entry jsonb;
    inserted_count int := 0;
    error_count int := 0;
    requeued_count int := 0;
    failed_count int := 0;
    failed_task record;
    orchestrator_task_id_text text;
    is_orchestrator_task boolean;
BEGIN
    -- 1. Update worker heartbeat, metadata, and status
    SELECT COALESCE(metadata, '{}'::jsonb) INTO current_metadata
    FROM workers WHERE id = worker_id_param;

    IF vram_total_mb_param IS NOT NULL THEN
        current_metadata = current_metadata ||
            jsonb_build_object(
                'vram_total_mb', vram_total_mb_param,
                'vram_used_mb', COALESCE(vram_used_mb_param, 0),
                'vram_timestamp', extract(epoch from NOW())
            );
    END IF;

    UPDATE workers
    SET
        last_heartbeat = NOW(),
        metadata = current_metadata,
        status = status_param
    WHERE id = worker_id_param;

    IF NOT FOUND THEN
        INSERT INTO workers (id, instance_type, status, last_heartbeat, metadata, created_at)
        VALUES (
            worker_id_param,
            'external',
            status_param,
            NOW(),
            current_metadata,
            NOW()
        );
    END IF;

    -- 2. Crash recovery for tasks stranded on a dead worker
    IF status_param = 'crashed' THEN
        UPDATE tasks
        SET
            status = 'Queued'::task_status,
            worker_id = NULL,
            generation_started_at = NULL,
            attempts = COALESCE(attempts, 0) + 1,
            updated_at = NOW(),
            error_message = 'Requeued: worker crashed (attempt ' || (COALESCE(attempts, 0) + 1)::text || ')'
        WHERE worker_id = worker_id_param
          AND status = 'In Progress'::task_status
          AND COALESCE(attempts, 0) < 3;

        GET DIAGNOSTICS requeued_count = ROW_COUNT;

        FOR failed_task IN
            UPDATE tasks
            SET
                status = 'Failed'::task_status,
                worker_id = NULL,
                generation_started_at = NULL,
                updated_at = NOW(),
                error_message = 'Failed: worker crashed after exhausting retries (attempt ' || COALESCE(attempts, 0)::text || ')'
            WHERE worker_id = worker_id_param
              AND status = 'In Progress'::task_status
              AND COALESCE(attempts, 0) >= 3
            RETURNING id, params, task_type
        LOOP
            failed_count := failed_count + 1;

            is_orchestrator_task := COALESCE(failed_task.task_type, '') ILIKE '%orchestrator%';
            orchestrator_task_id_text := CASE
                WHEN is_orchestrator_task THEN failed_task.id::text
                ELSE COALESCE(
                    failed_task.params->>'orchestrator_task_id_ref',
                    failed_task.params->'orchestration_contract'->>'orchestrator_task_id',
                    failed_task.params->>'orchestrator_task_id',
                    failed_task.params->'orchestrator_details'->>'orchestrator_task_id'
                )
            END;

            IF orchestrator_task_id_text IS NOT NULL
               AND orchestrator_task_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN
                PERFORM cascade_task_failure(
                    orchestrator_task_id_text::uuid,
                    failed_task.id,
                    'Failed',
                    is_orchestrator_task
                );
            END IF;
        END LOOP;
    END IF;

    -- 3. Insert log entries in batch
    IF jsonb_array_length(logs_param) > 0 THEN
        FOR log_entry IN SELECT * FROM jsonb_array_elements(logs_param)
        LOOP
            BEGIN
                INSERT INTO system_logs (
                    timestamp,
                    source_type,
                    source_id,
                    log_level,
                    message,
                    task_id,
                    worker_id,
                    metadata
                ) VALUES (
                    COALESCE((log_entry->>'timestamp')::timestamptz, NOW()),
                    'worker',
                    worker_id_param,
                    COALESCE(log_entry->>'level', 'INFO'),
                    log_entry->>'message',
                    COALESCE((log_entry->>'task_id')::uuid, current_task_id_param),
                    worker_id_param,
                    COALESCE(log_entry->'metadata', '{}'::jsonb)
                );
                inserted_count := inserted_count + 1;
            EXCEPTION WHEN OTHERS THEN
                error_count := error_count + 1;
            END;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'heartbeat_updated', true,
        'logs_inserted', inserted_count,
        'log_errors', error_count,
        'crash_requeued_tasks', requeued_count,
        'crash_failed_tasks', failed_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid, text) TO service_role;

COMMENT ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid, text)
IS 'Enhanced heartbeat with logs, worker status updates, and crash recovery. Uses SECURITY DEFINER to bypass RLS on workers table. Service-role only.';
