// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildOrchestratorRefOrFilter } from "../_shared/orchestratorReference.ts";
import { withEdgeRequest } from "../_shared/edgeHandler.ts";
import { authorizeTaskActor } from "../_shared/taskActorPolicy.ts";

/**
 * Edge function: get-orchestrator-children
 *
 * Fetches all child tasks for a given orchestrator task ID.
 * Used by workers to get segment, stitch, and join tasks for an orchestrator.
 *
 * - Service-role key: can fetch any orchestrator's children
 * - User token: can only fetch tasks from their own projects
 *
 * POST /functions/v1/get-orchestrator-children
 * Headers: Authorization: Bearer <service-key or PAT>
 * Body: { "orchestrator_task_id": "uuid" }
 *
 * Returns:
 * - 200 OK with { tasks: [...] }
 * - 400 Bad Request if orchestrator_task_id missing
 * - 401 Unauthorized if no valid token
 * - 403 Forbidden if user doesn't own the tasks' project
 * - 500 Internal Server Error
 */
serve((req) => {
  return withEdgeRequest(req, {
    functionName: "get-orchestrator-children",
    logPrefix: "[GET-ORCHESTRATOR-CHILDREN]",
    parseBody: "strict",
    errorResponseFormat: "text",
    auth: {
      required: true,
    },
  }, async ({ supabaseAdmin, logger, body: requestBody, auth }) => {
  if (!auth) {
    return new Response("Authentication failed", { status: 401 });
  }

  const orchestratorTaskId = typeof requestBody.orchestrator_task_id === "string"
    ? requestBody.orchestrator_task_id
    : null;
  if (!orchestratorTaskId) {
    logger.error("Missing orchestrator_task_id");
    return new Response("orchestrator_task_id is required", { status: 400 });
  }

  // Set orchestrator task_id for logs
  logger.setDefaultTaskId(orchestratorTaskId);

  const actor = await authorizeTaskActor({
    supabaseAdmin,
    taskId: orchestratorTaskId,
    auth,
    logPrefix: "[GET-ORCHESTRATOR-CHILDREN]",
  });
  if (!actor.ok) {
    logger.error("Task access denied", {
      task_id: orchestratorTaskId,
      error: actor.error,
      status_code: actor.statusCode,
    });
    return new Response(actor.error, { status: actor.statusCode });
  }
  const isServiceRole = actor.value.isServiceRole;

  // Query child tasks by orchestration contract + legacy orchestrator reference fields.
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from("tasks")
    .select("id, task_type, status, params, output_location, project_id")
    .or([
      buildOrchestratorRefOrFilter(orchestratorTaskId),
      `params->>orchestrator_task_id.eq.${orchestratorTaskId}`,
      `params->orchestrator_details->>orchestrator_task_id.eq.${orchestratorTaskId}`,
    ].join(','))
    .order("created_at", { ascending: true });

  if (tasksError) {
    logger.error("Error fetching child tasks", { error: tasksError.message });
    return new Response(`Error fetching tasks: ${tasksError.message}`, { status: 500 });
  }

  // If no tasks found, return empty array
  if (!tasks || tasks.length === 0) {
    logger.info("No child tasks found", { orchestrator_task_id: orchestratorTaskId });
    return new Response(JSON.stringify({ tasks: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Service role may access all tasks; user tokens are pre-authorized via taskActorPolicy above.
  if (!isServiceRole) {
    logger.debug("Caller access verified by taskActorPolicy", { task_id: orchestratorTaskId });
  }

  // Remove project_id from response (not needed by caller)
  const tasksWithoutProjectId = tasks.map(({ project_id, ...rest }) => rest);

  logger.info("Returning child tasks", { count: tasks.length });
  return new Response(JSON.stringify({
    tasks: tasksWithoutProjectId
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
});
