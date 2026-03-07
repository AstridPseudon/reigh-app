// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { bootstrapEdgeHandler } from "../_shared/edgeHandler.ts";
import { toErrorMessage } from "../_shared/errorMessage.ts";
import { authorizeTaskActor } from "../_shared/taskActorPolicy.ts";

/**
 * Edge function: get-predecessor-output
 *
 * Gets the output locations of a task's dependencies in a single call.
 * Supports both single and multiple dependencies (dependant_on is now an array).
 *
 * POST /functions/v1/get-predecessor-output
 * Headers: Authorization: Bearer <service-key or PAT>
 * Body: { task_id: "uuid" }
 *
 * Returns:
 * - 200 OK with:
 *   - No dependencies: { predecessors: [] }
 *   - Single dependency (backward compat): { predecessor_id, output_location, predecessors: [...] }
 *   - Multiple dependencies: { predecessors: [{ predecessor_id, output_location, status }, ...] }
 * - 400 Bad Request if task_id missing
 * - 401 Unauthorized if no valid token
 * - 403 Forbidden if token invalid or user not authorized
 * - 404 Not Found if task not found
 * - 500 Internal Server Error
 */
serve(async (req) => {
  const bootstrap = await bootstrapEdgeHandler(req, {
    functionName: "get-predecessor-output",
    logPrefix: "[GET-PREDECESSOR-OUTPUT]",
    parseBody: "strict",
    auth: {
      required: true,
    },
  });
  if (!bootstrap.ok) {
    return bootstrap.response;
  }

  const { supabaseAdmin, logger, auth, body } = bootstrap.value;

  const taskId = typeof body.task_id === "string" || typeof body.task_id === "number"
    ? String(body.task_id)
    : "";
  if (!taskId) {
    logger.error("Missing task_id");
    await logger.flush();
    return new Response("task_id is required", { status: 400 });
  }

  // Set task_id for all subsequent logs
  logger.setDefaultTaskId(taskId);

  if (!auth) {
    logger.error("Authentication failed");
    await logger.flush();
    return new Response("Authentication failed", { status: 401 });
  }

  const actor = await authorizeTaskActor({
    supabaseAdmin,
    taskId,
    auth,
    logPrefix: "[GET-PREDECESSOR-OUTPUT]",
  });
  if (!actor.ok) {
    logger.error("Task access denied", {
      task_id: taskId,
      error: actor.error,
      status_code: actor.statusCode,
    });
    await logger.flush();
    return new Response(actor.error, { status: actor.statusCode });
  }

  const isServiceRole = actor.value.isServiceRole;

  try {
    // Get the task info first
    const { data: taskData, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("id, dependant_on")
      .eq("id", taskId)
      .single();

    if (taskError) {
      logger.error("Task lookup error", { error: taskError.message });
      await logger.flush();
      return new Response("Task not found", { status: 404 });
    }

    // Return the dependency info
    const dependantOnArray: string[] = taskData.dependant_on || [];

    if (dependantOnArray.length === 0) {
      logger.info("No dependencies found");
      await logger.flush();
      return new Response(JSON.stringify({
        predecessor_id: null,
        output_location: null,
        predecessors: []
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch all predecessor tasks
    const { data: predecessorsData, error: predecessorError } = await supabaseAdmin
      .from("tasks")
      .select("id, status, output_location")
      .in("id", dependantOnArray);

    if (predecessorError) {
      logger.error("Predecessors lookup error", { error: predecessorError.message });
      await logger.flush();
      return new Response(JSON.stringify({
        predecessor_id: dependantOnArray[0],
        output_location: null,
        status: "error",
        predecessors: dependantOnArray.map(id => ({
          predecessor_id: id,
          output_location: null,
          status: "error"
        }))
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Build predecessors array with status info
    const predecessors = dependantOnArray.map(depId => {
      const pred = predecessorsData?.find(p => p.id === depId);
      if (!pred) {
        return {
          predecessor_id: depId,
          output_location: null,
          status: "not_found"
        };
      }
      return {
        predecessor_id: pred.id,
        output_location: pred.status === "Complete" ? pred.output_location : null,
        status: pred.status
      };
    });

    const allComplete = predecessors.every(p => p.status === "Complete" && p.output_location);
    const firstPred = predecessors[0];

    logger.info("Returning predecessor info", {
      predecessor_count: predecessors.length,
      all_complete: allComplete
    });
    await logger.flush();

    return new Response(JSON.stringify({
      predecessor_id: firstPred?.predecessor_id || null,
      output_location: allComplete ? firstPred?.output_location : null,
      status: allComplete ? "Complete" : (firstPred?.status || null),
      predecessors,
      all_complete: allComplete
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const message = toErrorMessage(error);
    logger.critical("Unexpected error", { error: message });
    await logger.flush();
    return new Response(`Internal error: ${message}`, { status: 500 });
  }
});
