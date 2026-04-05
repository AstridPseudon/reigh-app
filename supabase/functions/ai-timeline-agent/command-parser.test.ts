import { describe, expect, it } from "vitest";
import { parseCommand } from "./command-parser.ts";

describe("parseCommand", () => {
  it("parses every supported canonical command family", () => {
    const cases = [
      ["view", "view"],
      ["find-issues", "find-issues"],
      ["move clip-1 12", "move"],
      ["trim clip-1 --from 1 --duration 2", "trim"],
      ["delete clip-1", "delete"],
      ["set clip-1 opacity 0.5", "set"],
      ['add-text V1 2 3 "hello world"', "add-text"],
      ['set-text clip-1 "updated text"', "set-text"],
      ["duplicate clip-1 2", "duplicate"],
      ["repeat 3 add-text V1 0.2 hi --start 1 --gap 0.5", "repeat"],
      ['generate "wide shot" --count 2', "generate"],
    ] as const;

    for (const [input, expectedType] of cases) {
      expect(parseCommand(input).type).toBe(expectedType);
    }
  });

  it("normalizes aliases through the dispatch map", () => {
    expect(parseCommand("rm clip-1")).toEqual({ type: "delete", clipId: "clip-1" });
    expect(parseCommand("issues")).toEqual({ type: "find-issues" });
    expect(parseCommand('gen "sunrise" --count 2')).toEqual({
      type: "generate",
      prompt: "sunrise",
      count: 2,
    });
    expect(parseCommand('settext clip-1 "new text"')).toEqual({
      type: "set-text",
      clipId: "clip-1",
      text: "new text",
    });
  });

  it("keeps the unknown-command error path", () => {
    expect(parseCommand("unknown command")).toEqual({
      type: "error",
      message: 'Unknown command "unknown". Available: view, move, trim, delete, set, add-text, find-issues. For generation requests, use create_task (legacy generate still works).',
    });
  });
});
