import { describe, expect, it } from "vitest";

import { extractToolCalls } from "./tool-calls.ts";

describe("extractToolCalls", () => {
  it("extracts create_task from assistant text formatted as a tool call block", () => {
    const toolCalls = extractToolCalls({
      role: "assistant",
      content: `Tool call create_task:
{
  "count": 5,
  "model": "z-image",
  "prompt": "Orbital satellite perspective directly overhead",
  "task_type": "text-to-image"
}`,
    });

    expect(toolCalls).toEqual([
      {
        id: expect.any(String),
        name: "create_task",
        args: {
          count: 5,
          model: "z-image",
          prompt: "Orbital satellite perspective directly overhead",
          task_type: "text-to-image",
        },
        parseError: null,
      },
    ]);
  });

  it("extracts create_task from inline invocation syntax", () => {
    const toolCalls = extractToolCalls({
      role: "assistant",
      content: 'create_task({"task_type":"text-to-image","prompt":"hello","count":2})',
    });

    expect(toolCalls).toEqual([
      {
        id: expect.any(String),
        name: "create_task",
        args: {
          task_type: "text-to-image",
          prompt: "hello",
          count: 2,
        },
        parseError: null,
      },
    ]);
  });
});
