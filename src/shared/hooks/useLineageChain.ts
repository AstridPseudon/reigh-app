/**
 * useLineageChain Hook
 *
 * Fetches the full lineage chain for a variant by following the `source_variant_id` field in params.
 * Returns an array ordered from oldest ancestor to newest (the provided variant).
 *
 * Note: Lineage is tracked at the variant level via params.source_variant_id,
 * not at the generation level via based_on.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import { generationQueryKeys } from '@/shared/lib/queryKeys/generations';

interface LineageItem {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  type: 'variant';
  variantType: string | null;
}

interface LineageChainResult {
  chain: LineageItem[];
  isLoading: boolean;
  hasLineage: boolean;
  error: Error | null;
}

interface VariantRecord {
  id: string;
  generation_id: string;
  params: Record<string, unknown> | null;
  location: string;
  thumbnail_url: string | null;
  created_at: string;
  variant_type: string | null;
}

function readSourceVariantId(params: Record<string, unknown> | null): string | null {
  return typeof params?.source_variant_id === 'string' ? params.source_variant_id : null;
}

/**
 * Recursively fetch the lineage chain for a variant.
 * Follows the `params.source_variant_id` field to find ancestors.
 */
async function fetchLineageChain(variantId: string): Promise<LineageItem[]> {
  // Load the current variant once to discover generation_id.
  const { data: currentVariant, error: currentVariantError } = await supabase
    .from('generation_variants')
    .select('id, generation_id, params, location, thumbnail_url, created_at, variant_type')
    .eq('id', variantId)
    .single();

  if (currentVariantError || !currentVariant) {
    handleError(currentVariantError || new Error('Variant not found'), {
      context: 'useLineageChain',
      showToast: false,
    });
    return [];
  }

  // Fetch all variants in the same generation in one query, then resolve lineage in-memory.
  const { data: generationVariants, error: generationVariantsError } = await supabase
    .from('generation_variants')
    .select('id, generation_id, params, location, thumbnail_url, created_at, variant_type')
    .eq('generation_id', currentVariant.generation_id);

  if (generationVariantsError || !generationVariants) {
    handleError(generationVariantsError || new Error('Failed to fetch lineage variants'), {
      context: 'useLineageChain',
      showToast: false,
    });
    return [];
  }

  const variants = generationVariants as VariantRecord[];
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  // Keep the selected variant available even if it was omitted from batch response.
  if (!byId.has(currentVariant.id)) {
    byId.set(currentVariant.id, currentVariant as VariantRecord);
  }

  const parentById = new Map(
    Array.from(byId.values()).map((variant) => [variant.id, readSourceVariantId(variant.params)])
  );

  const chain: LineageItem[] = [];
  const visited = new Set<string>();
  let currentId: string | null = variantId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const variant = byId.get(currentId);
    if (!variant) break;

    chain.unshift({
      id: variant.id,
      imageUrl: variant.location,
      thumbnailUrl: variant.thumbnail_url,
      createdAt: variant.created_at,
      type: 'variant',
      variantType: variant.variant_type,
    });
    currentId = parentById.get(currentId) ?? null;
  }

  return chain;
}

/**
 * Hook to fetch the full lineage chain for a variant.
 *
 * @param variantId - The variant ID to fetch lineage for
 * @returns Object with chain (oldest to newest), loading state, and whether there's lineage
 */
export function useLineageChain(variantId: string | null): LineageChainResult {
  const { data: chain = [], isLoading, error } = useQuery({
    queryKey: generationQueryKeys.lineageChain(variantId!),
    queryFn: () => fetchLineageChain(variantId!),
    enabled: !!variantId,
    staleTime: 5 * 60 * 1000, // 5 minutes - lineage doesn't change
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    chain,
    isLoading,
    // Has lineage if chain has more than 1 item (the current variant + at least one ancestor)
    hasLineage: chain.length > 1,
    error: error as Error | null,
  };
}

/**
 * Count the lineage chain length for a variant.
 * Returns the number of ancestors (0 if no lineage, 1+ if has ancestors).
 * This fetches directly without caching - use sparingly for initial checks.
 *
 * Reuses fetchLineageChain to avoid duplicating the traversal logic.
 */
export async function getLineageDepth(variantId: string): Promise<number> {
  const chain = await fetchLineageChain(variantId);
  // chain includes the variant itself; ancestors = chain length - 1
  return Math.max(0, chain.length - 1);
}

// NOTE: Default export removed - use named export { useLineageChain } instead
