import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildTransformImageRequest, executeTransformImage } from "./transform-image.ts";

describe("transform-image tool", () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    if (originalDeno) {
      vi.stubGlobal("Deno", originalDeno);
    }
  });

  it("defaults transformed variants to primary promotion", () => {
    const request = buildTransformImageRequest(
      {
        generation_id: "gen-1",
        source_image_url: "https://example.com/source.png",
        flip_horizontal: true,
      },
      undefined,
      "user-1",
    );

    expect("body" in request).toBe(true);
    if ("body" in request) {
      expect(request.body).toEqual(expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        source_image_url: "https://example.com/source.png",
        create_as_generation: false,
        make_primary: true,
        tool_type: "video-editor",
        transform: {
          translateX: 0,
          translateY: 0,
          scale: 1,
          rotation: 0,
          flipH: true,
          flipV: false,
        },
      }));
    }
  });

  it("uses the single selected image as a fallback target", () => {
    const request = buildTransformImageRequest(
      { flip_horizontal: true },
      [{
        clip_id: "clip-1",
        url: "https://example.com/source.png",
        media_type: "image",
        generation_id: "gen-1",
      }],
      "user-1",
    );

    expect(request).toEqual({
      body: expect.objectContaining({
        generation_id: "gen-1",
        source_image_url: "https://example.com/source.png",
      }),
    });
  });

  it("rejects no-op transforms", () => {
    expect(buildTransformImageRequest(
      { generation_id: "gen-1" },
      undefined,
      "user-1",
    )).toEqual({
      error: "transform_image requires at least one transform change.",
    });
  });

  it("invokes the edge function and reports created variants", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        create_as_generation: false,
        generation_id: "gen-1",
        variant_id: "variant-1",
        location: "https://example.com/flipped.png",
        is_primary: true,
        variant_name: "Flipped Horizontal",
      }),
    }) as typeof fetch;

    const result = await executeTransformImage(
      {
        generation_id: "gen-1",
        source_image_url: "https://example.com/source.png",
        flip_horizontal: true,
      },
      undefined,
      "user-1",
    );

    expect(result.result).toContain("Created transformed variant variant-1");
    expect(result.result).toContain("set it as primary");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/apply-image-transform",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
