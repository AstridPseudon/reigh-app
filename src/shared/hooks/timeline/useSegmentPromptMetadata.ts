/**
 * Segment Prompt Metadata
 *
 * Hook for pair prompt CRUD operations:
 * - Get pair prompts (derived from shotGenerations metadata)
 * - Update pair prompts (updatePairPrompts)
 * - Clear enhanced prompts (clearEnhancedPrompt)
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ShotGeneration } from '@/shared/hooks/useTimelineCore';
import { GenerationRow } from '@/types/shots';
import { readSegmentOverrides, writeSegmentOverrides } from '@/shared/utils/settingsMigration';
import { queryKeys } from '@/shared/lib/queryKeys';

// ============================================================================
// Types
// ============================================================================

interface UseSegmentPromptMetadataOptions {
  shotId: string | null;
  projectId?: string | null;
  shotGenerations: ShotGeneration[];
}

// ============================================================================
// Pure function: extract pair prompts
// ============================================================================

/**
 * Extract pair prompts from sorted positioned generations.
 * Each pair is represented by its first item (index in the sorted array).
 */
export function extractPairPrompts(
  shotGenerations: ShotGeneration[]
): Record<number, { prompt: string; negativePrompt: string }> {
  const pairPrompts: Record<number, { prompt: string; negativePrompt: string }> = {};
  const sortedPositionedGenerations = shotGenerations
    .filter(sg => sg.timeline_frame >= 0)
    .sort((a, b) => (a.timeline_frame ?? 0) - (b.timeline_frame ?? 0));

  for (let i = 0; i < sortedPositionedGenerations.length - 1; i++) {
    const firstItem = sortedPositionedGenerations[i];
    const overrides = readSegmentOverrides(firstItem.metadata as Record<string, unknown> | null);
    const prompt = overrides.prompt || "";
    const negativePrompt = overrides.negativePrompt || "";
    if (prompt || negativePrompt) {
      pairPrompts[i] = { prompt, negativePrompt };
    }
  }

  return pairPrompts;
}

// ============================================================================
// Hook
// ============================================================================

export function useSegmentPromptMetadata({
  shotId,
  projectId,
  shotGenerations,
}: UseSegmentPromptMetadataOptions) {
  const queryClient = useQueryClient();

  /**
   * Update pair prompt for a specific pair
   * @param shotGenerationId - The shot_generation.id (NOT generation_id)
   */
  const updatePairPrompts = useCallback(async (
    shotGenerationId: string,
    prompt: string,
    negativePrompt: string
  ) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[PairPromptFlow] useTimelinePositionUtils.updatePairPrompts START:', {
      shotGenerationId: shotGenerationId.substring(0, 8),
      shotId: shotId.substring(0, 8),
      promptLength: prompt?.length || 0,
      negativePromptLength: negativePrompt?.length || 0,
      hasPrompt: !!prompt,
      hasNegativePrompt: !!negativePrompt,
    });

    // Look up by shot_generation.id
    const shotGen = shotGenerations.find(sg => sg.id === shotGenerationId);
    if (!shotGen?.id) {
      console.error('[PairPromptFlow] Shot generation not found:', {
        lookingForShotGenId: shotGenerationId.substring(0, 8),
        availableShotGenIds: shotGenerations.map(sg => sg.id?.substring(0, 8)),
        availableGenerationIds: shotGenerations.map(sg => sg.generation_id?.substring(0, 8)),
      });
      throw new Error(`Shot generation not found for shot_generation.id ${shotGenerationId}`);
    }

    console.log('[PairPromptFlow] Found shot_generation, preparing metadata update:', {
      shotGenerationId: shotGen.id.substring(0, 8),
      existingPairPrompt: shotGen.metadata?.pair_prompt?.substring(0, 30) || '(none)',
      newPairPrompt: prompt?.substring(0, 30) || '(empty)',
      existingMetadataKeys: Object.keys(shotGen.metadata || {}),
    });

    // Use new format for writing
    let updatedMetadata = writeSegmentOverrides(
      shotGen.metadata as Record<string, unknown> | null,
      {
        prompt: prompt,
        negativePrompt: negativePrompt,
      }
    );
    // Clean up old fields (migration cleanup)
    delete updatedMetadata.pair_prompt;
    delete updatedMetadata.pair_negative_prompt;

    console.log('[PairPromptFlow] Executing Supabase UPDATE on shot_generations table...', {
      table: 'shot_generations',
      shotGenerationId: shotGen.id.substring(0, 8),
      updatingFields: ['metadata.pair_prompt', 'metadata.pair_negative_prompt'],
    });

    const { data, error } = await supabase
      .from('shot_generations')
      .update({ metadata: updatedMetadata as unknown as Json })
      .eq('id', shotGen.id)
      .select();

    if (error) {
      console.error('[PairPromptFlow] Supabase UPDATE FAILED:', error);
      throw error;
    }

    console.log('[PairPromptFlow] Supabase UPDATE SUCCESS');
    console.log('[PairPromptFlow] Updated record returned from DB:', {
      id: data?.[0]?.id?.substring(0, 8),
      metadata: data?.[0]?.metadata,
      metadata_pair_prompt: (data?.[0]?.metadata as Record<string, unknown> | undefined)?.pair_prompt as string | undefined,
      metadata_pair_negative_prompt: (data?.[0]?.metadata as Record<string, unknown> | undefined)?.pair_negative_prompt as string | undefined,
    });
    console.log('[PairPromptFlow] Refetching query caches in background...');

    // Refetch instead of invalidate
    queryClient.refetchQueries({ queryKey: queryKeys.generations.byShot(shotId) });
    queryClient.refetchQueries({ queryKey: queryKeys.generations.meta(shotId) });
    if (projectId) {
      queryClient.refetchQueries({ queryKey: queryKeys.shots.list(projectId!) });
    }

    // Also invalidate pair-metadata cache used by useSegmentSettings modal
    queryClient.invalidateQueries({ queryKey: queryKeys.segments.pairMetadata(shotGen.id) });

    console.log('[PairPromptFlow] Refetch queued - UI should refresh with new data');
  }, [shotId, shotGenerations, queryClient, projectId]);

  /**
   * Clear enhanced prompt for a generation
   * @param shotGenerationId - The shot_generation.id (NOT generation_id)
   */
  const clearEnhancedPrompt = useCallback(async (shotGenerationId: string) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[PairPromptFlow] Clearing enhanced prompt for shot_generation:', shotGenerationId.substring(0, 8));

    // Look up by shot_generation.id
    const shotGen = shotGenerations.find(sg => sg.id === shotGenerationId);
    if (!shotGen?.id) {
      console.error('[PairPromptFlow] Shot generation not found for clear:', {
        lookingForShotGenId: shotGenerationId.substring(0, 8),
        availableShotGenIds: shotGenerations.map(sg => sg.id?.substring(0, 8)),
      });
      throw new Error(`Shot generation not found for shot_generation.id ${shotGenerationId}`);
    }

    const existingMetadata = shotGen.metadata || {};
    const { enhanced_prompt, ...restMetadata } = existingMetadata;

    console.log('[PairPromptFlow] Clearing enhanced_prompt from metadata...');

    // Optimistic update: immediately update the cache
    queryClient.setQueryData<GenerationRow[]>(
      queryKeys.generations.byShot(shotId),
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((row) =>
          row.id === shotGenerationId
            ? { ...row, metadata: restMetadata }
            : row
        );
      }
    );

    // Persist to database
    const { error } = await supabase
      .from('shot_generations')
      .update({ metadata: restMetadata as unknown as Json })
      .eq('id', shotGen.id);

    if (error) {
      console.error('[PairPromptFlow] Failed to clear enhanced prompt:', error);
      // Revert by refetching
      queryClient.refetchQueries({ queryKey: queryKeys.generations.byShot(shotId) });
      throw error;
    }

    console.log('[PairPromptFlow] Enhanced prompt cleared, background refetch...');
    queryClient.refetchQueries({ queryKey: queryKeys.generations.byShot(shotId) });
    queryClient.refetchQueries({ queryKey: queryKeys.generations.meta(shotId) });
    if (projectId) {
      queryClient.refetchQueries({ queryKey: queryKeys.shots.list(projectId!) });
    }

    // Also invalidate pair-metadata cache used by useSegmentSettings modal
    queryClient.invalidateQueries({ queryKey: queryKeys.segments.pairMetadata(shotGenerationId) });

    console.log('[PairPromptFlow] Refetch queued');
  }, [shotId, shotGenerations, queryClient, projectId]);

  return {
    updatePairPrompts,
    clearEnhancedPrompt,
  };
}
