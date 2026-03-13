BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view workers" ON public.workers;

REVOKE SELECT ON public.workers FROM authenticated;
REVOKE SELECT ON public.workers FROM anon;
GRANT SELECT ON public.workers TO service_role;

REVOKE SELECT ON public.orchestrator_status FROM authenticated;
REVOKE SELECT ON public.orchestrator_status FROM anon;
GRANT SELECT ON public.orchestrator_status TO service_role;

REVOKE SELECT ON public.active_workers_health FROM authenticated;
REVOKE SELECT ON public.active_workers_health FROM anon;
GRANT SELECT ON public.active_workers_health TO service_role;

REVOKE SELECT ON public.recent_task_activity FROM authenticated;
REVOKE SELECT ON public.recent_task_activity FROM anon;
GRANT SELECT ON public.recent_task_activity TO service_role;

REVOKE SELECT ON public.worker_performance FROM authenticated;
REVOKE SELECT ON public.worker_performance FROM anon;
GRANT SELECT ON public.worker_performance TO service_role;

COMMENT ON TABLE public.workers IS
  'Worker control-plane table. Direct reads are restricted to service_role.';

COMMENT ON VIEW public.orchestrator_status IS
  'Worker/orchestrator monitoring surface. Restricted to service_role to avoid exposing worker infrastructure data.';

COMMENT ON VIEW public.active_workers_health IS
  'Worker health monitoring surface. Restricted to service_role to avoid exposing worker infrastructure data.';

COMMENT ON VIEW public.recent_task_activity IS
  'Operational worker/task activity surface. Restricted to service_role to avoid exposing worker infrastructure data.';

COMMENT ON VIEW public.worker_performance IS
  'Worker performance surface. Restricted to service_role to avoid exposing worker infrastructure data.';

COMMIT;
