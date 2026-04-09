import { isRecord } from "./llm/messages.ts";
import type { SelectedClipPayload, SupabaseAdmin } from "./types.ts";

function firstPromptString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractGenerationPrompt(params: unknown): string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }

  const originalParams = isRecord(params.originalParams) ? params.originalParams : undefined;
  const orchestratorDetails = isRecord(originalParams?.orchestrator_details)
    ? originalParams.orchestrator_details
    : undefined;
  const metadataBlock = isRecord(params.metadata) ? params.metadata : undefined;

  return firstPromptString(
    orchestratorDetails?.prompt,
    params.prompt,
    metadataBlock?.prompt,
  );
}

export function normalizeSelectedClips(value: unknown): SelectedClipPayload[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const clipId = typeof item.clip_id === "string" ? item.clip_id.trim() : "";
    const generationId = typeof item.generation_id === "string" ? item.generation_id.trim() : "";
    const prompt = typeof item.prompt === "string" && item.prompt.trim() ? item.prompt.trim() : undefined;
    const shotId = typeof item.shot_id === "string" && item.shot_id.trim() ? item.shot_id.trim() : undefined;
    const shotName = typeof item.shot_name === "string" && item.shot_name.trim() ? item.shot_name.trim() : undefined;
    const shotSelectionClipCount = typeof item.shot_selection_clip_count === "number"
      && Number.isFinite(item.shot_selection_clip_count)
      && item.shot_selection_clip_count > 0
      ? item.shot_selection_clip_count
      : undefined;
    const normalizedClipId = clipId || (generationId ? `gallery-${generationId}` : "");
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const mediaType = item.media_type;

    if (!normalizedClipId || !url || (mediaType !== "image" && mediaType !== "video")) {
      return [];
    }

    return [{
      clip_id: normalizedClipId,
      url,
      media_type: mediaType,
      ...(generationId ? { generation_id: generationId } : {}),
      ...(prompt ? { prompt } : {}),
      ...(shotId ? { shot_id: shotId } : {}),
      ...(shotName ? { shot_name: shotName } : {}),
      ...(shotSelectionClipCount ? { shot_selection_clip_count: shotSelectionClipCount } : {}),
    }];
  });
}

export async function enrichClipsWithPrompts(
  supabaseAdmin: SupabaseAdmin,
  clips: SelectedClipPayload[],
): Promise<SelectedClipPayload[]> {
  if (!clips.length) {
    return clips;
  }

  const generationIds = Array.from(new Set(
    clips.flatMap((clip) => (
      typeof clip.generation_id === "string" && clip.generation_id.trim()
        ? [clip.generation_id.trim()]
        : []
    )),
  ));

  if (!generationIds.length) {
    return clips;
  }

  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, params")
    .in("id", generationIds);

  if (error) {
    throw new Error(`Failed to load generation prompts: ${error.message}`);
  }

  const promptsByGenerationId = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!isRecord(row)) {
      continue;
    }

    const generationId = typeof row.id === "string" ? row.id.trim() : "";
    const prompt = extractGenerationPrompt(row.params);
    if (generationId && prompt) {
      promptsByGenerationId.set(generationId, prompt);
    }
  }

  return clips.map((clip) => {
    const prompt = clip.prompt ?? (
      clip.generation_id
        ? promptsByGenerationId.get(clip.generation_id)
        : undefined
    );

    return prompt ? { ...clip, prompt } : clip;
  });
}
