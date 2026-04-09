import type {
  SelectedClipPayload,
  ToolResult,
} from "../types.ts";
import { asTrimmedString } from "../utils.ts";

interface TransformImageArgs {
  generation_id?: string;
  source_image_url?: string;
  source_variant_id?: string;
  translate_x?: number;
  translate_y?: number;
  scale?: number;
  rotation?: number;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
  as_new?: boolean;
  make_primary?: boolean;
  variant_name?: string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`[ai-timeline-agent] Missing ${name}`);
  }
  return value;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolveTarget(
  args: Record<string, unknown>,
  selectedClips: SelectedClipPayload[] | undefined,
): { generationId: string | null; sourceImageUrl: string | null } {
  const generationId = asTrimmedString(args.generation_id);
  const sourceImageUrl = asTrimmedString(args.source_image_url);
  if (generationId) {
    return { generationId, sourceImageUrl };
  }

  const selectedImages = (selectedClips ?? []).filter((clip) => clip.media_type === "image");
  if (selectedImages.length === 1) {
    return {
      generationId: selectedImages[0].generation_id ?? null,
      sourceImageUrl: sourceImageUrl ?? selectedImages[0].url,
    };
  }

  return { generationId: null, sourceImageUrl };
}

export function buildTransformImageRequest(
  rawArgs: Record<string, unknown>,
  selectedClips: SelectedClipPayload[] | undefined,
  userId: string | undefined,
): { body: Record<string, unknown> } | { error: string } {
  const args = rawArgs as TransformImageArgs;
  const { generationId, sourceImageUrl } = resolveTarget(rawArgs, selectedClips);
  if (!generationId) {
    return { error: "transform_image requires generation_id, or exactly one selected image clip with a generation_id." };
  }
  if (!userId) {
    return { error: "transform_image requires a user context." };
  }

  const transform = {
    translateX: asFiniteNumber(args.translate_x) ?? 0,
    translateY: asFiniteNumber(args.translate_y) ?? 0,
    scale: asFiniteNumber(args.scale) ?? 1,
    rotation: asFiniteNumber(args.rotation) ?? 0,
    flipH: args.flip_horizontal === true,
    flipV: args.flip_vertical === true,
  };

  const hasTransformChanges = transform.translateX !== 0
    || transform.translateY !== 0
    || transform.scale !== 1
    || transform.rotation !== 0
    || transform.flipH
    || transform.flipV;

  if (!hasTransformChanges) {
    return { error: "transform_image requires at least one transform change." };
  }

  if (!(transform.scale > 0)) {
    return { error: "transform_image scale must be greater than 0." };
  }

  const createAsGeneration = args.as_new === true;
  const makePrimary = createAsGeneration ? true : args.make_primary !== false;

  return {
    body: {
      generation_id: generationId,
      user_id: userId,
      ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
      ...(asTrimmedString(args.source_variant_id) ? { source_variant_id: asTrimmedString(args.source_variant_id) } : {}),
      ...(asTrimmedString(args.variant_name) ? { variant_name: asTrimmedString(args.variant_name) } : {}),
      create_as_generation: createAsGeneration,
      make_primary: makePrimary,
      tool_type: "video-editor",
      transform,
    },
  };
}

export async function executeTransformImage(
  args: Record<string, unknown>,
  selectedClips: SelectedClipPayload[] | undefined,
  userId: string | undefined,
): Promise<ToolResult> {
  const request = buildTransformImageRequest(args, selectedClips, userId);
  if ("error" in request) {
    return { result: request.error };
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${supabaseUrl}/functions/v1/apply-image-transform`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { result: `Failed to transform image: ${errorText || "request failed"}` };
  }

  const data = await response.json() as {
    create_as_generation?: boolean;
    generation_id?: string;
    variant_id?: string;
    location?: string;
    is_primary?: boolean;
    variant_name?: string;
  };

  if (data.create_as_generation) {
    return {
      result: `Created transformed generation ${data.generation_id ?? "unknown"} with variant ${data.variant_id ?? "unknown"}. Asset: ${data.location ?? "unknown"}.`,
    };
  }

  return {
    result: `Created transformed variant ${data.variant_id ?? "unknown"} on generation ${data.generation_id ?? "unknown"}${data.is_primary === true ? " and set it as primary" : ""}. Asset: ${data.location ?? "unknown"}${data.variant_name ? ` (${data.variant_name})` : ""}.`,
  };
}
