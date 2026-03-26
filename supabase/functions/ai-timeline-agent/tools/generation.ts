import type { ToolHandler, ToolResult } from "../types.ts";

export interface CreateGenerationTaskArgs {
  project_id?: string;
  prompt?: string;
  count?: number;
  task_type?: string;
  idempotency_key?: string;
  params?: Record<string, unknown>;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`[ai-timeline-agent] Missing ${name}`);
  }
  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getIdempotencyKey(args: CreateGenerationTaskArgs): Promise<string> {
  if (typeof args.idempotency_key === "string" && args.idempotency_key.trim()) {
    return args.idempotency_key.trim();
  }

  const payload = JSON.stringify({
    project_id: args.project_id,
    task_type: args.task_type ?? "image_generation",
    params: args.params ?? { prompt: args.prompt, count: args.count ?? 1 },
  });
  const digest = await sha256Hex(payload);
  return `timeline-agent:${digest.slice(0, 40)}`;
}

export async function createGenerationTask(args: CreateGenerationTaskArgs): Promise<ToolResult> {
  if (typeof args.project_id !== "string" || !args.project_id.trim()) {
    return { result: "create_generation_task requires project_id." };
  }

  const taskType = args.task_type ?? "image_generation";
  if (taskType !== "image_generation") {
    return { result: "Only image_generation is supported by create_generation_task right now." };
  }

  const params = args.params
    ?? (typeof args.prompt === "string" && args.prompt.trim()
      ? {
          prompt: args.prompt.trim(),
          count: typeof args.count === "number" ? args.count : 1,
        }
      : null);

  if (!params) {
    return { result: "create_generation_task requires either params or prompt." };
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const idempotencyKey = await getIdempotencyKey(args);

  const response = await fetch(`${supabaseUrl}/functions/v1/create-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      task_type: taskType,
      params,
      project_id: args.project_id.trim(),
      dependant_on: null,
      idempotency_key: idempotencyKey,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const message = errorText || "Failed to create task";
    return { result: `Failed to create task: ${message}` };
  }

  const data = await response.json() as { task_id?: string; deduplicated?: boolean };

  return {
    result: data.task_id
      ? `Queued ${taskType} task ${data.task_id}${data.deduplicated ? " (deduplicated)." : "."}`
      : `Queued ${taskType} task.`,
  };
}

export const handlers: Record<string, ToolHandler> = {
  create_generation_task: (args) => createGenerationTask(args),
};
