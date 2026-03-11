-- Restrict worker heartbeat mutation RPCs to service_role only.
-- These functions bypass workers RLS via SECURITY DEFINER, so caller identity
-- must stay aligned with the service-role-only HTTP worker mutation surfaces.

REVOKE EXECUTE ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION func_update_worker_heartbeat(text, int, int) FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION func_update_worker_heartbeat(text, int, int) TO service_role;

COMMENT ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid)
IS 'Enhanced heartbeat with logs. Uses SECURITY DEFINER to bypass RLS on workers table. Service-role only.';

COMMENT ON FUNCTION func_worker_heartbeat_with_logs(text, int, int, jsonb, uuid, text)
IS 'Enhanced heartbeat with logs and status updates. Uses SECURITY DEFINER to bypass RLS on workers table. Service-role only.';

COMMENT ON FUNCTION func_update_worker_heartbeat(text, int, int)
IS 'Update worker heartbeat and VRAM usage. Uses SECURITY DEFINER to bypass RLS on workers table. Service-role only.';

SELECT 'Restricted worker heartbeat RPC grants to service_role only' AS status;
