import type { ToolHandler, ToolResult } from "../types.ts";

export function messageUser(text: string): ToolResult {
  return {
    result: text,
    stopLoop: true,
    nextStatus: "waiting_user",
  };
}

export function done(summary: string): ToolResult {
  return {
    result: summary,
    stopLoop: true,
    nextStatus: "done",
  };
}

export const handlers: Record<string, ToolHandler> = {
  done: (args) =>
    typeof args.summary === "string"
      ? done(args.summary)
      : { result: "done requires a summary string." },
  message_user: (args) =>
    typeof args.text === "string"
      ? messageUser(args.text)
      : { result: "message_user requires a text string." },
};
