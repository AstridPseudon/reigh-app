/**
 * useReplaceInShot Hook
 *
 * Handles swapping timeline position from a parent generation to the current image.
 * Used when user wants to replace a parent image in the timeline with a derived image.
 */

import { useCallback } from 'react';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { getSupabaseClient as supabase } from '@/integrations/supabase/client';

interface UseReplaceInShotProps {
  /** Callback to close the lightbox after successful replacement */
  onClose: () => void;
}

interface UseReplaceInShotReturn {
  /**
   * Replace parent's timeline position with current image
   * @param parentGenerationId - ID of the parent generation to remove from timeline
   * @param currentMediaId - ID of the current media to place in timeline
   * @param parentTimelineFrame - Timeline frame position to use
   * @param shotId - Shot ID for the replacement
   */
  handleReplaceInShot: (
    parentGenerationId: string,
    currentMediaId: string,
    parentTimelineFrame: number,
    shotId: string
  ) => Promise<ReplaceInShotResult>;
}

type ReplaceInShotFailureStage =
  | 'clear_parent'
  | 'fetch_target_assoc'
  | 'assign_target'
  | 'restore_parent';

export type ReplaceInShotResult =
  | { ok: true }
  | {
      ok: false;
      stage: ReplaceInShotFailureStage;
      recovered: boolean;
      message: string;
    };

export function useReplaceInShot({
  onClose,
}: UseReplaceInShotProps): UseReplaceInShotReturn {
  const handleReplaceInShot = useCallback(async (
    parentGenerationId: string,
    currentMediaId: string,
    parentTimelineFrame: number,
    shotIdParam: string
  ): Promise<ReplaceInShotResult> => {
    const restoreParentTimelineFrame = async (): Promise<Error | null> => {
      const { error } = await supabase().from('shot_generations')
        .update({ timeline_frame: parentTimelineFrame })
        .eq('generation_id', parentGenerationId)
        .eq('shot_id', shotIdParam);
      return error ?? null;
    };

    try {
      // 1. Remove timeline_frame from parent's shot_generation record
      const { error: removeError } = await supabase().from('shot_generations')
        .update({ timeline_frame: null })
        .eq('generation_id', parentGenerationId)
        .eq('shot_id', shotIdParam);

      if (removeError) {
        throw {
          stage: 'clear_parent' as const,
          recovered: false,
          cause: removeError,
        };
      }

      // 2. Update or create shot_generation for current image with the timeline_frame
      // First check if current image already has a shot_generation for this shot
      const { data: existingAssoc, error: existingAssocError } = await supabase().from('shot_generations')
        .select('id')
        .eq('generation_id', currentMediaId)
        .eq('shot_id', shotIdParam)
        .maybeSingle();

      if (existingAssocError) {
        const restoreError = await restoreParentTimelineFrame();
        throw {
          stage: restoreError ? 'restore_parent' as const : 'fetch_target_assoc' as const,
          recovered: !restoreError,
          cause: existingAssocError,
          restoreError,
        };
      }

      if (existingAssoc) {
        // Update existing
        const { error: updateError } = await supabase().from('shot_generations')
          .update({
            timeline_frame: parentTimelineFrame,
            metadata: { user_positioned: true, drag_source: 'replace_parent' }
          })
          .eq('id', existingAssoc.id);

        if (updateError) {
          const restoreError = await restoreParentTimelineFrame();
          throw {
            stage: restoreError ? 'restore_parent' as const : 'assign_target' as const,
            recovered: !restoreError,
            cause: updateError,
            restoreError,
          };
        }
      } else {
        // Create new
        const { error: createError } = await supabase().from('shot_generations')
          .insert({
            shot_id: shotIdParam,
            generation_id: currentMediaId,
            timeline_frame: parentTimelineFrame,
            metadata: { user_positioned: true, drag_source: 'replace_parent' }
          });

        if (createError) {
          const restoreError = await restoreParentTimelineFrame();
          throw {
            stage: restoreError ? 'restore_parent' as const : 'assign_target' as const,
            recovered: !restoreError,
            cause: createError,
            restoreError,
          };
        }
      }

      // Close lightbox to force refresh when reopened
      onClose();
      return { ok: true };
    } catch (error) {
      const failure = (
        error && typeof error === 'object' && 'stage' in error && 'recovered' in error
      ) ? error as {
        stage: ReplaceInShotFailureStage;
        recovered: boolean;
        cause: unknown;
        restoreError?: unknown;
      } : null;

      normalizeAndPresentError(failure?.cause ?? error, {
        context: 'useReplaceInShot',
        showToast: false,
        logData: failure
          ? {
              stage: failure.stage,
              recovered: failure.recovered,
              restoreError: failure.restoreError,
            }
          : undefined,
      });
      return {
        ok: false,
        stage: failure?.stage ?? 'assign_target',
        recovered: failure?.recovered ?? false,
        message: failure?.recovered
          ? 'Replace-in-shot failed, but the parent timeline position was restored.'
          : 'Replace-in-shot failed after mutating timeline state.',
      };
    }
  }, [onClose]);

  return { handleReplaceInShot };
}
