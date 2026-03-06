// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { bootstrapEdgeHandler } from "../_shared/edgeHandler.ts";
import type { SystemLogger } from "../_shared/systemLogger.ts";

interface ValidationRule {
  field: string;
  value: string;
  logData?: Record<string, unknown>;
}

async function respondValidationFailure(
  logger: SystemLogger,
  rule: ValidationRule,
): Promise<Response> {
  const message = `Missing required field: ${rule.field}`;
  logger.error(message, rule.logData);
  await logger.flush();
  return new Response(message, { status: 400 });
}

async function validateRequiredFields(
  logger: SystemLogger,
  rules: ValidationRule[],
): Promise<Response | null> {
  for (const rule of rules) {
    if (rule.value) {
      continue;
    }
    return respondValidationFailure(logger, rule);
  }
  return null;
}

/**
 * Edge function: update-worker-model
 *
 * Updates a worker's current_model field to track which model is loaded.
 * This enables model-aware task claiming to minimize expensive model reloads.
 *
 * Only accepts service-role authentication (workers use service key).
 *
 * POST /functions/v1/update-worker-model
 * Headers: Authorization: Bearer <service-role-key>
 * Body: {
 *   worker_id: string,       // Required: the worker's ID
 *   current_model: string    // Required: the model currently loaded (e.g., "wan_2_2_i2v_480p")
 * }
 *
 * Returns:
 * - 200 OK with worker data on success
 * - 400 Bad Request if missing required fields
 * - 401 Unauthorized if no valid token
 * - 403 Forbidden if not service role
 * - 500 Internal Server Error
 */
serve(async (req) => {
  const bootstrap = await bootstrapEdgeHandler(req, {
    functionName: "update-worker-model",
    logPrefix: "[UPDATE-WORKER-MODEL]",
    parseBody: "strict",
    auth: {
      required: true,
      requireServiceRole: true,
    },
  });
  if (!bootstrap.ok) {
    return bootstrap.response;
  }

  const { supabaseAdmin, logger, body: requestBody } = bootstrap.value;

  // Validate required fields
  const workerIdRaw = requestBody?.worker_id;
  const currentModelRaw = requestBody?.current_model;
  const instanceTypeRaw = requestBody?.instance_type;
  
  const worker_id = typeof workerIdRaw === "string" ? workerIdRaw.trim() : "";
  const current_model = typeof currentModelRaw === "string" ? currentModelRaw.trim() : "";
  const instance_type =
    typeof instanceTypeRaw === "string" && instanceTypeRaw.trim()
      ? instanceTypeRaw.trim()
      : "external";

  const validationFailure = await validateRequiredFields(logger, [
    { field: "worker_id", value: worker_id },
    { field: "current_model", value: current_model, logData: { worker_id } },
  ]);
  if (validationFailure) {
    return validationFailure;
  }

  logger.info("Updating worker model", { worker_id, current_model });

  try {
    const nowIso = new Date().toISOString();

    // IMPORTANT:
    // - `workers.instance_type` is NOT NULL, but we do NOT want to overwrite it on updates.
    // - So we do an update-first; if worker doesn't exist, we insert with instance_type.
    let action: "updated" | "inserted" = "updated";

    const updateAttempt = await supabaseAdmin
      .from("workers")
      .update({
        current_model,
        last_heartbeat: nowIso,
        status: "active",
      })
      .eq("id", worker_id)
      .select()
      .single();

    let data = updateAttempt.data;
    let error = updateAttempt.error;

    // No row matched -> insert
    if (error?.code === "PGRST116") {
      action = "inserted";
      const insertAttempt = await supabaseAdmin
        .from("workers")
        .insert({
          id: worker_id,
          instance_type,
          status: "active",
          last_heartbeat: nowIso,
          current_model,
        })
        .select()
        .single();

      data = insertAttempt.data;
      error = insertAttempt.error;
    }

    if (error) {
      logger.error("Database error updating worker", {
        worker_id,
        error: error.message,
        code: error.code,
      });
      await logger.flush();
      return new Response(`Database error: ${error.message}`, { status: 500 });
    }

    logger.info("Worker model updated successfully", { 
      worker_id, 
      current_model,
      last_heartbeat: data?.last_heartbeat 
    });
    
    await logger.flush();
    return new Response(JSON.stringify({
      success: true,
      worker_id: worker_id,
      current_model: current_model,
      last_heartbeat: data?.last_heartbeat,
      action,
      message: `Worker model updated to '${current_model}'`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.critical("Unexpected error", { worker_id, error: message });
    await logger.flush();
    return new Response(`Internal server error: ${message}`, { status: 500 });
  }
});
