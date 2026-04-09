import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGenerationTask: vi.fn(),
  createShotWithGenerations: vi.fn(),
  resolveClipGenerationIds: vi.fn(),
  resolveSelectedClipShot: vi.fn(),
}));

vi.mock("./generation.ts", () => ({
  createGenerationTask: (...args: unknown[]) => mocks.createGenerationTask(...args),
}));

vi.mock("./clips.ts", () => ({
  createShotWithGenerations: (...args: unknown[]) => mocks.createShotWithGenerations(...args),
  resolveClipGenerationIds: (...args: unknown[]) => mocks.resolveClipGenerationIds(...args),
  resolveSelectedClipShot: (...args: unknown[]) => mocks.resolveSelectedClipShot(...args),
}));

import { executeCreateTask } from "./create-task.ts";

describe("executeCreateTask", () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClipGenerationIds.mockReturnValue([]);
    mocks.resolveSelectedClipShot.mockResolvedValue({ shotId: null, source: null });
    mocks.createGenerationTask.mockResolvedValue({ result: "Queued text-to-image task task-1." });
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((key: string) => {
          if (key === "SUPABASE_URL") return "https://example.supabase.co";
          if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
          return undefined;
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    if (originalDeno) {
      vi.stubGlobal("Deno", originalDeno);
    }
  });

  it("creates all requested variants up to 16 even when prompt generation returns duplicates", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        prompts: Array.from({ length: 16 }, () => "same prompt"),
      }),
    }) as typeof fetch;

    const result = await executeCreateTask(
      {
        task_type: "text-to-image",
        prompt: "same prompt",
        count: 16,
        model: "qwen-image",
      },
      {
        config: { clips: [] },
        configVersion: 1,
        registry: { assets: {} },
        projectId: "project-1",
      } as never,
      undefined,
      {} as never,
      {
        image: { defaultModelName: "qwen-image", activeReference: null, selectedLorasByCategory: {} },
        travel: null,
      },
    );

    expect(result.result).toContain("Queued 16 tasks with varied prompts.");
    expect(mocks.createGenerationTask).toHaveBeenCalledTimes(16);

    const idempotencyKeys = mocks.createGenerationTask.mock.calls.map(([args]) => (args as { idempotency_key?: string }).idempotency_key);
    expect(new Set(idempotencyKeys).size).toBe(16);
  });

  it("reports the real queued count instead of the requested count when some creates fail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        prompts: ["one", "two", "three"],
      }),
    }) as typeof fetch;

    mocks.createGenerationTask
      .mockResolvedValueOnce({ result: "Queued text-to-image task task-1." })
      .mockResolvedValueOnce({ result: "Failed to create task: boom" })
      .mockResolvedValueOnce({ result: "Queued text-to-image task task-3." });

    const result = await executeCreateTask(
      {
        task_type: "text-to-image",
        prompt: "base",
        count: 3,
        model: "qwen-image",
      },
      {
        config: { clips: [] },
        configVersion: 1,
        registry: { assets: {} },
        projectId: "project-1",
      } as never,
      undefined,
      {} as never,
      {
        image: { defaultModelName: "qwen-image", activeReference: null, selectedLorasByCategory: {} },
        travel: null,
      },
    );

    expect(result.result).toContain("Queued 2 tasks with varied prompts.");
    expect(result.result).toContain("1 failed.");
  });

  it("reuses the resolved shared shot for selected reference clips instead of creating a new one", async () => {
    mocks.resolveClipGenerationIds.mockReturnValue(["gen-1"]);
    mocks.resolveSelectedClipShot.mockResolvedValue({ shotId: "shot-1", source: "explicit" });

    const result = await executeCreateTask(
      {
        task_type: "style-transfer",
        prompt: "apply this look to a portrait",
        reference_image_urls: ["https://example.com/reference.png"],
      },
      {
        config: { clips: [] },
        configVersion: 1,
        registry: { assets: {} },
        projectId: "project-1",
      } as never,
      [{
        clip_id: "clip-1",
        url: "https://example.com/reference.png",
        media_type: "image",
        generation_id: "gen-1",
        shot_id: "shot-1",
      }],
      {} as never,
      {
        image: { defaultModelName: "qwen-image", activeReference: null, selectedLorasByCategory: {} },
        travel: null,
      },
    );

    expect(result.result).toContain("Reused shot shot-1.");
    expect(mocks.createShotWithGenerations).not.toHaveBeenCalled();
    expect(mocks.createGenerationTask).toHaveBeenCalledWith(expect.objectContaining({
      shot_id: "shot-1",
      reference_image_url: "https://example.com/reference.png",
    }));
  });

  it("keeps selected-image edits on the image-to-image path without forcing transfer mode", async () => {
    mocks.resolveClipGenerationIds.mockReturnValue(["gen-1"]);
    mocks.resolveSelectedClipShot.mockResolvedValue({ shotId: "shot-1", source: "explicit" });

    await executeCreateTask(
      {
        task_type: "image-to-image",
        prompt: "orbital view of it without style transfer",
        reference_image_urls: ["https://example.com/reference.png"],
        model: "z-image",
        strength: 0.55,
      },
      {
        config: { clips: [] },
        configVersion: 1,
        registry: { assets: {} },
        projectId: "project-1",
      } as never,
      [{
        clip_id: "clip-1",
        url: "https://example.com/reference.png",
        media_type: "image",
        generation_id: "gen-1",
        shot_id: "shot-1",
      }],
      {} as never,
      {
        image: { defaultModelName: "qwen-image", activeReference: null, selectedLorasByCategory: {} },
        travel: null,
      },
    );

    expect(mocks.createGenerationTask).toHaveBeenCalledWith(expect.objectContaining({
      task_type: "image-to-image",
      prompt: "orbital view of it without style transfer",
      reference_image_url: "https://example.com/reference.png",
      model_name: "z-image",
      strength: 0.55,
      shot_id: "shot-1",
      based_on: "gen-1",
      params: expect.objectContaining({
        is_primary: true,
      }),
    }));

    const firstCallArgs = mocks.createGenerationTask.mock.calls[0]?.[0] as {
      reference_mode?: string;
    };
    expect(firstCallArgs.reference_mode).toBeUndefined();
  });
});
