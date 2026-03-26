import type { TimelineConfig } from "../../../src/tools/video-editor/types/index.ts";
import { isRecord, isSessionStatus, normalizeTimelineRow } from "./llm/messages.ts";
import type {
  AgentSessionStatus,
  AgentTurn,
  SupabaseAdmin,
  TimelineState,
} from "./types.ts";

export async function loadTimelineState(
  supabaseAdmin: SupabaseAdmin,
  timelineId: string,
): Promise<TimelineState> {
  const { data, error } = await supabaseAdmin
    .from("timelines")
    .select("config, config_version, asset_registry, project_id")
    .eq("id", timelineId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load timeline: ${error.message}`);
  }

  if (!data || !isRecord(data)) {
    throw new Error("Timeline not found");
  }

  const normalized = normalizeTimelineRow(data);
  return {
    config: normalized.config,
    configVersion: normalized.config_version,
    registry: normalized.asset_registry,
    projectId: normalized.project_id,
  };
}

export async function saveTimelineConfigVersioned(
  supabaseAdmin: SupabaseAdmin,
  timelineId: string,
  expectedVersion: number,
  config: TimelineConfig,
  retries = 2,
): Promise<number | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc("update_timeline_config_versioned", {
          p_timeline_id: timelineId,
          p_expected_version: expectedVersion,
          p_config: config,
        })
        .maybeSingle();

      if (error) {
        // Connection errors are retryable
        if (attempt < retries && (error.message.includes("connection") || error.message.includes("reset") || error.message.includes("SendRequest"))) {
          console.warn(`[agent] DB save failed (attempt ${attempt + 1}), retrying: ${error.message}`);
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`Failed to save timeline config: ${error.message}`);
      }

      const nextVersion = (data as { config_version?: unknown } | null)?.config_version;
      return typeof nextVersion === "number" ? nextVersion : null;
    } catch (err: unknown) {
      if (attempt < retries && err instanceof Error && (err.message.includes("connection") || err.message.includes("reset") || err.message.includes("SendRequest"))) {
        console.warn(`[agent] DB save threw (attempt ${attempt + 1}), retrying: ${err.message}`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to save timeline config after retries");
}

export async function loadSessionStatus(
  supabaseAdmin: SupabaseAdmin,
  sessionId: string,
): Promise<AgentSessionStatus | null> {
  const { data, error } = await supabaseAdmin
    .from("timeline_agent_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data || !isRecord(data)) {
    return null;
  }

  return isSessionStatus(data.status) ? data.status : null;
}

export async function persistSessionState(
  supabaseAdmin: SupabaseAdmin,
  options: {
    sessionId: string;
    status: AgentSessionStatus;
    turns: AgentTurn[];
    summary: string | null;
  },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("timeline_agent_sessions")
    .update({
      status: options.status,
      turns: options.turns,
      summary: options.summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.sessionId);

  if (error) {
    throw new Error(`Failed to persist session state: ${error.message}`);
  }
}
