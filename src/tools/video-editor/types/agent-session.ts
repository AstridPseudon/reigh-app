export type AgentSessionStatus =
  | "waiting_user"
  | "processing"
  | "continue"
  | "done"
  | "cancelled"
  | "error";

export type AgentTurn = {
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string;
  attachments?: Array<{
    clipId: string;
    url: string;
    mediaType: "image" | "video";
    generationId?: string;
    prompt?: string;
  }>;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  timestamp: string;
};

export type AgentSession = {
  id: string;
  timeline_id: string;
  user_id: string;
  status: AgentSessionStatus;
  turns: AgentTurn[];
  model: string;
  summary: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_source?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
};
