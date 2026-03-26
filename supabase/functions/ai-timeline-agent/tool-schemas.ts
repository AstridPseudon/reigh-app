export interface TimelineAgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TIMELINE_AGENT_TOOLS: TimelineAgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "run",
      description: "Execute a timeline editing command. Commands: view, move <clipId> <seconds>, trim <clipId> [--from N] [--to N] [--duration N], delete <clipId>, set <clipId> <property> <value>, add-text <track> <at> <duration> <text>, find-issues, generate <prompt> [--count N]",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to execute" },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
];
