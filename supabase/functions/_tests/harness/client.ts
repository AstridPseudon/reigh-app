import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentSessionStatus, SelectedClipPayload } from "../../ai-timeline-agent/types.ts";
import { loadHarnessEnv } from "./env.ts";

const AUTO_CONTINUE_LIMIT = 10;
const AUTO_CONTINUE_DELAY_MS = 300;
const TERMINAL_STATUSES = new Set<AgentSessionStatus>([
  "waiting_user",
  "done",
  "error",
  "cancelled",
]);

export interface AgentCallRequest {
  sessionId: string;
  jwt?: string;
  userMessage?: string;
  selectedClips?: SelectedClipPayload[];
}

export interface AgentCallResponse {
  httpStatus: number;
  sessionId: string;
  status: AgentSessionStatus;
  turnsAdded: number;
  toolCount: number | null;
  model: string | null;
  requestBody: {
    session_id: string;
    user_message?: string;
    selected_clips?: SelectedClipPayload[];
  };
  raw: Record<string, unknown>;
}

export interface TestUserAuth {
  userId: string;
  jwt: string;
}

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;
let cachedTestUserAuth: Promise<TestUserAuth> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentSessionStatus(value: unknown): value is AgentSessionStatus {
  return value === "waiting_user"
    || value === "processing"
    || value === "continue"
    || value === "done"
    || value === "cancelled"
    || value === "error";
}

function normalizeAgentResponse(
  payload: unknown,
  httpStatus: number,
  requestBody: AgentCallResponse["requestBody"],
): AgentCallResponse {
  const record = isRecord(payload) ? payload : {};
  const sessionId = typeof record.session_id === "string" ? record.session_id : "";
  const status = isAgentSessionStatus(record.status) ? record.status : "error";

  return {
    httpStatus,
    sessionId,
    status,
    turnsAdded: typeof record.turns_added === "number" ? record.turns_added : 0,
    toolCount: typeof record.tool_count === "number" ? record.tool_count : null,
    model: typeof record.model === "string" ? record.model : null,
    requestBody,
    raw: record,
  };
}

function getFunctionsBaseUrl(): string {
  return `${loadHarnessEnv().supabaseUrl}/functions/v1`;
}

export function getAdminSupabaseClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const env = loadHarnessEnv();
  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

function getAuthSupabaseClient(): SupabaseClient {
  if (authClient) {
    return authClient;
  }

  const env = loadHarnessEnv();
  authClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return authClient;
}

export async function signInHarnessUser(forceRefresh = false): Promise<TestUserAuth> {
  if (cachedTestUserAuth && !forceRefresh) {
    return cachedTestUserAuth;
  }

  cachedTestUserAuth = (async () => {
    const env = loadHarnessEnv();
    const supabase = getAuthSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: env.testUserEmail,
      password: env.testUserPassword,
    });

    if (error) {
      throw new Error(
        `Failed to sign in test user ${env.testUserEmail}: ${error.message}. ` +
          "Ensure the user exists and TEST_USER_EMAIL/TEST_USER_PASSWORD are valid.",
      );
    }

    const session = data.session;
    const user = data.user;
    if (!session?.access_token || !user?.id) {
      throw new Error(`Sign-in succeeded for ${env.testUserEmail} but did not return a user session.`);
    }

    return {
      userId: user.id,
      jwt: session.access_token,
    };
  })();

  try {
    return await cachedTestUserAuth;
  } catch (error) {
    cachedTestUserAuth = null;
    throw error;
  }
}

export async function callAgentOnce(options: AgentCallRequest): Promise<AgentCallResponse> {
  const { sessionId, userMessage, selectedClips } = options;
  if (!sessionId.trim()) {
    throw new Error("callAgentOnce requires a non-empty sessionId.");
  }

  const jwt = options.jwt ?? (await signInHarnessUser()).jwt;
  const env = loadHarnessEnv();
  const requestBody: AgentCallResponse["requestBody"] = {
    session_id: sessionId,
    ...(userMessage ? { user_message: userMessage } : {}),
    ...(userMessage && selectedClips?.length ? { selected_clips: selectedClips } : {}),
  };

  const response = await fetch(`${getFunctionsBaseUrl()}/ai-timeline-agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: env.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = isRecord(payload)
      ? JSON.stringify(payload)
      : `HTTP ${response.status}`;
    throw new Error(`ai-timeline-agent request failed: ${details}`);
  }

  return normalizeAgentResponse(payload, response.status, requestBody);
}

export async function callAgentUntilSettled(
  sessionId: string,
  userMessage: string,
  selectedClips?: SelectedClipPayload[],
  options?: {
    jwt?: string;
    delayMs?: number;
    maxContinuations?: number;
  },
): Promise<AgentCallResponse[]> {
  const responses: AgentCallResponse[] = [];
  const jwt = options?.jwt ?? (await signInHarnessUser()).jwt;
  const delayMs = options?.delayMs ?? AUTO_CONTINUE_DELAY_MS;
  const maxContinuations = options?.maxContinuations ?? AUTO_CONTINUE_LIMIT;

  let nextUserMessage: string | undefined = userMessage;
  let nextSelectedClips = selectedClips;

  for (let continueCount = 0; continueCount <= maxContinuations; continueCount += 1) {
    const response = await callAgentOnce({
      sessionId,
      jwt,
      userMessage: nextUserMessage,
      selectedClips: nextSelectedClips,
    });
    responses.push(response);

    if (response.status === "continue") {
      if (continueCount === maxContinuations) {
        return responses;
      }

      nextUserMessage = undefined;
      nextSelectedClips = undefined;
      await delay(delayMs);
      continue;
    }

    if (!TERMINAL_STATUSES.has(response.status)) {
      throw new Error(`Unexpected ai-timeline-agent status ${response.status} for session ${sessionId}.`);
    }

    return responses;
  }

  return responses;
}
