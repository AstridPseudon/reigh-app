import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { findSourceGenerationByImageUrl } from './generation-core.ts';
import { extractBasedOnParam } from '../../../src/shared/lib/tasks/taskParamContract.ts';

/**
 * Resolve based_on generation ID from params.
 * Extracts the based_on ID, verifies it exists in the DB, and falls back
 * to image-URL lookup if the explicit ID is missing or stale.
 */
export async function resolveBasedOn(
  supabase: SupabaseClient,
  params: unknown,
): Promise<string | null> {
  const record = params && typeof params === 'object' && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {};

  let basedOnGenerationId: string | null = extractBasedOnParam(record);

  if (basedOnGenerationId) {
    const { data: basedOnGen, error: basedOnError } = await supabase
      .from('generations')
      .select('id')
      .eq('id', basedOnGenerationId)
      .maybeSingle();

    if (basedOnError || !basedOnGen) {
      basedOnGenerationId = null;
    }
  }

  if (!basedOnGenerationId) {
    const sourceImageUrl = typeof record.image === 'string' && record.image.length > 0
      ? record.image
      : null;
    if (sourceImageUrl) {
      basedOnGenerationId = await findSourceGenerationByImageUrl(supabase, sourceImageUrl);
    }
  }

  return basedOnGenerationId;
}

/**
 * Build generation params starting from normalized task params
 */
export function buildGenerationParams(
  baseParams: unknown,
  toolType: string,
  contentType?: string,
  shotId?: string,
  thumbnailUrl?: string,
  sourceTaskId?: string
): unknown {
  const generationParams = { ...baseParams };

  // Add tool_type to the params JSONB
  generationParams.tool_type = toolType;

  // Add source_task_id if provided
  // IMPORTANT: This is used by the auto_view_manual_upload_variant trigger
  // to distinguish task-created generations (which should show NEW badge)
  // from manual uploads (which should be auto-marked as viewed)
  if (sourceTaskId) {
    generationParams.source_task_id = sourceTaskId;
  }

  // Add content_type to params for download/display purposes
  if (contentType) {
    generationParams.content_type = contentType;
  }

  // Add shot_id if present and valid
  if (shotId) {
    generationParams.shotId = shotId;
  }

  // Add thumbnail_url to params if available
  if (thumbnailUrl) {
    generationParams.thumbnailUrl = thumbnailUrl;
  }

  return generationParams;
}
