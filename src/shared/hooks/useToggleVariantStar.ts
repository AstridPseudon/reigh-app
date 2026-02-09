/**
 * useToggleVariantStar Hook
 *
 * Toggles the starred state of a generation variant with optimistic update.
 *
 * Usage:
 *   const { toggleStar } = useToggleVariantStar();
 *   toggleStar({ variantId, generationId, starred: true });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { GenerationVariant } from '@/shared/hooks/useVariants';

interface ToggleStarParams {
  variantId: string;
  generationId: string;
  starred: boolean;
}

export function useToggleVariantStar() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ variantId, starred }: ToggleStarParams) => {
      const { error } = await supabase
        .from('generation_variants')
        .update({ starred })
        .eq('id', variantId);

      if (error) {
        console.error('[useToggleVariantStar] Error:', error);
        throw error;
      }

      return { variantId, starred };
    },
    onMutate: async ({ variantId, generationId, starred }) => {
      const queryKey = queryKeys.generations.variants(generationId);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousVariants = queryClient.getQueryData<GenerationVariant[]>(queryKey);

      // Optimistic update
      queryClient.setQueryData<GenerationVariant[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((v) =>
          v.id === variantId ? { ...v, starred } : v
        );
      });

      return { previousVariants, queryKey };
    },
    onError: (_error, _vars, context) => {
      // Rollback on error
      if (context?.previousVariants) {
        queryClient.setQueryData(context.queryKey, context.previousVariants);
      }
      console.error('[useToggleVariantStar] Failed to toggle star');
    },
    onSettled: (_data, _error, { generationId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.generations.variants(generationId),
      });
    },
  });

  return {
    toggleStar: mutation.mutate,
    isToggling: mutation.isPending,
  };
}
