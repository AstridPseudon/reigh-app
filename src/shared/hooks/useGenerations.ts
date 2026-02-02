import React from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { GeneratedImageWithMetadata } from '@/shared/components/MediaGallery';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandler';
// Removed useResurrectionPolling - replaced by useSmartPolling
// Removed invalidationRouter - DataFreshnessManager handles all invalidation logic
import { useSmartPollingConfig } from './useSmartPolling';
import { useQueryDebugLogging, QueryDebugConfigs } from './useQueryDebugLogging';
import { transformGeneration, type RawGeneration, type TransformOptions, calculateDerivedCounts } from '@/shared/lib/generationTransformers';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/** Common filter options for generation queries */
interface GenerationFilters {
  toolType?: string;
  mediaType?: 'all' | 'image' | 'video';
  shotId?: string;
  excludePositioned?: boolean;
  starredOnly?: boolean;
  searchTerm?: string;
  editsOnly?: boolean;
}

/**
 * Apply common filters to a generations query.
 * Used by both count and data queries to ensure consistency.
 */
function applyGenerationFilters<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  filters: GenerationFilters | undefined
): T {
  if (!filters) return query;

  // Tool type filter (skip when shot filter is active - shot filter takes precedence)
  if (filters.toolType && !filters.shotId) {
    if (filters.toolType === 'image-generation') {
      query = query.eq('params->>tool_type', 'image-generation') as T;
    } else {
      query = query.or(`params->>tool_type.eq.${filters.toolType},params->>tool_type.eq.${filters.toolType}-reconstructed-client`) as T;
    }
  }

  // Media type filter
  if (filters.mediaType && filters.mediaType !== 'all') {
    if (filters.mediaType === 'video') {
      query = query.like('type', '%video%') as T;
    } else if (filters.mediaType === 'image') {
      query = query.not('type', 'like', '%video%') as T;
    }
  }

  // Starred filter
  if (filters.starredOnly) {
    query = query.eq('starred', true) as T;
  }

  // Edits only filter (generations derived from another)
  if (filters.editsOnly) {
    query = query.not('based_on', 'is', null) as T;
  }

  // Search filter
  if (filters.searchTerm?.trim()) {
    const searchPattern = `%${filters.searchTerm.trim()}%`;
    query = query.ilike('params->originalParams->orchestrator_details->>prompt', searchPattern) as T;
  }

  // Shot filter
  if (filters.shotId === 'no-shot') {
    query = query.or('shot_data.is.null,shot_data.eq.{}') as T;
  } else if (filters.shotId) {
    query = query.not(`shot_data->${filters.shotId}`, 'is', null) as T;
    if (filters.excludePositioned) {
      query = query.or(`shot_data->${filters.shotId}.eq.null,shot_data->${filters.shotId}.eq.-1,shot_data->${filters.shotId}.cs.[null],shot_data->${filters.shotId}.cs.[-1]`) as T;
    }
  }

  return query;
}

/**
 * Fetch edit variants from generation_variants table for a project
 * Filters by tool_type in params (set by complete_task)
 * 
 * NOTE: Requires the project_id column on generation_variants (added via migration)
 * The column is auto-populated by a trigger from the parent generation
 */
async function fetchEditVariants(
  projectId: string,
  limit: number,
  offset: number,
  filters?: {
    toolType?: string;
    mediaType?: 'all' | 'image' | 'video';
    sort?: 'newest' | 'oldest';
    parentsOnly?: boolean; // Exclude child variants (those with parent_variant_id in params)
  }
): Promise<{
  items: GeneratedImageWithMetadata[];
  total: number;
  hasMore: boolean;
}> {
  const toolType = filters?.toolType;
  const sort = filters?.sort || 'newest';
  const mediaType = filters?.mediaType || 'all';
  const parentsOnly = filters?.parentsOnly ?? true;

  // Build count query
  let countQuery = supabase
    .from('generation_variants')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
  
  // Only filter by toolType if specified
  if (toolType) {
    countQuery = countQuery.eq('params->>tool_type', toolType);
  }
  
  // Filter by media type - variants don't have a type column, so filter by URL extension
  if (mediaType === 'video') {
    countQuery = countQuery.or('location.ilike.%.mp4,location.ilike.%.webm,location.ilike.%.mov');
  } else if (mediaType === 'image') {
    countQuery = countQuery.not('location', 'ilike', '%.mp4').not('location', 'ilike', '%.webm').not('location', 'ilike', '%.mov');
  }
  
  // Exclude child variants (those created from another variant)
  if (parentsOnly) {
    countQuery = countQuery.is('params->>parent_variant_id', null);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw countError;
  }

  const totalCount = count || 0;

  if (totalCount === 0) {
    return { items: [], total: 0, hasMore: false };
  }

  // Data query with pagination
  const ascending = sort === 'oldest';
  let dataQuery = supabase
    .from('generation_variants')
    .select(`
      id,
      generation_id,
      location,
      thumbnail_url,
      params,
      variant_type,
      name,
      created_at
    `)
    .eq('project_id', projectId);
  
  // Only filter by toolType if specified
  if (toolType) {
    dataQuery = dataQuery.eq('params->>tool_type', toolType);
  }
  
  // Filter by media type in data query too
  if (mediaType === 'video') {
    dataQuery = dataQuery.or('location.ilike.%.mp4,location.ilike.%.webm,location.ilike.%.mov');
  } else if (mediaType === 'image') {
    dataQuery = dataQuery.not('location', 'ilike', '%.mp4').not('location', 'ilike', '%.webm').not('location', 'ilike', '%.mov');
  }
  
  // Exclude child variants in data query too
  if (parentsOnly) {
    dataQuery = dataQuery.is('params->>parent_variant_id', null);
  }
  
  dataQuery = dataQuery
    .order('created_at', { ascending })
    .range(offset, offset + limit - 1);

  const { data, error } = await dataQuery;

  if (error) {
    throw error;
  }

  // Helper to detect if a variant is a video based on URL
  const isVideoUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // Transform variants to GeneratedImageWithMetadata format
  const items: GeneratedImageWithMetadata[] = (data || []).map((variant: any) => {
    const isVideo = isVideoUrl(variant.location);
    // Extract content_type from params for proper download file extensions
    const storedContentType = variant.params?.content_type;
    let contentType: string | undefined;
    if (storedContentType === 'video' || isVideo) {
      contentType = 'video/mp4';
    } else if (storedContentType === 'image' || !isVideo) {
      contentType = 'image/png';
    }
    
    return {
      id: variant.id,
      url: variant.location,
      thumbUrl: variant.thumbnail_url || variant.location,
      isVideo,
      contentType, // For proper download file extensions
      createdAt: variant.created_at,
      starred: false, // Variants don't have starred flag
      metadata: {
        prompt: variant.params?.prompt,
        variant_type: variant.variant_type,
        name: variant.name,
        generation_id: variant.generation_id,
        tool_type: variant.params?.tool_type || toolType,
        created_from: variant.params?.created_from,
        source_task_id: variant.params?.source_task_id, // Task ID for fetching task details
        content_type: storedContentType, // Include in metadata too
      },
      shot_id: undefined,
      position: undefined,
      all_shot_associations: undefined,
    };
  });

  // Media type filtering is now done in the database query

  return {
    items,
    total: totalCount,
    hasMore: offset + items.length < totalCount,
  };
}

/**
 * Fetch generations using direct Supabase call with pagination support
 */
export async function fetchGenerations(
  projectId: string | null,
  limit: number = 100,
  offset: number = 0,
  filters?: {
    toolType?: string;
    mediaType?: 'all' | 'image' | 'video';
    shotId?: string;
    excludePositioned?: boolean;
    starredOnly?: boolean;
    searchTerm?: string;
    includeChildren?: boolean;
    parentGenerationId?: string;
    sort?: 'newest' | 'oldest';
    editsOnly?: boolean; // Filter for images with based_on set (derived/edited images)
    parentsOnly?: boolean; // For variants: exclude child variants (those with parent_variant_id)
    variantsOnly?: boolean; // Fetch edit variants from generation_variants table
  }
): Promise<{
  items: GeneratedImageWithMetadata[];
  total: number;
  hasMore: boolean;
}> {

  if (!projectId) {
    return { items: [], total: 0, hasMore: false };
  }

  // Special path for variantsOnly - fetch from generation_variants table
  if (filters?.variantsOnly) {
    return fetchEditVariants(projectId, limit, offset, {
      toolType: filters.toolType,
      mediaType: filters.mediaType,
      sort: filters.sort,
      parentsOnly: filters.parentsOnly ?? true, // Default to parents only
    });
  }

  // Build count query
  let countQuery = supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
  
  // Only include generations with valid output URLs - UNLESS fetching children of a specific parent
  // (children may still be processing and need to show as placeholders)
  if (!filters?.parentGenerationId) {
    countQuery = countQuery.not('location', 'is', null);
  }

  // Parent/Child filtering (count query specific)
  if (filters?.parentGenerationId) {
    countQuery = countQuery.eq('parent_generation_id', filters.parentGenerationId);
  } else if (!filters?.includeChildren) {
    countQuery = countQuery.eq('is_child', false);
  }

  // Apply common filters (toolType, mediaType, starred, edits, search, shot)
  countQuery = applyGenerationFilters(countQuery, filters);

  let totalCount = 0;
  const shouldSkipCount = false;

  if (!shouldSkipCount) {
    const { count, error: countError } = await countQuery;
    if (countError) {
      throw countError;
    }
    totalCount = count || 0;
  }

  // 🚀 PERFORMANCE FIX: Optimize query - select only needed fields
  let dataQuery = supabase
    .from('generations')
    .select(`
      id,
      location,
      thumbnail_url,
      type,
      created_at,
      updated_at,
      params,
      starred,
      tasks,
      based_on,
      shot_data,
      name,
      is_child,
      parent_generation_id,
      child_order
    `)
    .eq('project_id', projectId);

  // Parent/Child filtering - apply BEFORE location filter since parentGenerationId affects whether we filter by location
  // Parent/Child filtering (data query specific - has ordering)
  if (filters?.parentGenerationId) {
    dataQuery = dataQuery.eq('parent_generation_id', filters.parentGenerationId);
    dataQuery = dataQuery.order('child_order', { ascending: true });
  } else {
    dataQuery = dataQuery.not('location', 'is', null);
    if (!filters?.includeChildren) {
      dataQuery = dataQuery.eq('is_child', false);
    }
  }

  // Apply common filters (toolType, mediaType, starred, edits, search, shot)
  dataQuery = applyGenerationFilters(dataQuery, filters);

  // Use limit+1 pattern for fast pagination when count is skipped
  const fetchLimit = shouldSkipCount ? limit + 1 : limit;

  // Determine sort order
  const sort = filters?.sort || 'newest';
  const ascending = sort === 'oldest';

  // Execute query with standard server-side pagination
  const { data, error } = await dataQuery
    .order('created_at', { ascending })
    .range(offset, offset + fetchLimit - 1);

  if (error) {
    throw error;
  }

  if (!data) {
    return { items: [], total: totalCount, hasMore: false };
  }


  // Calculate hasMore and process results based on count strategy
  let finalData = data || [];
  let hasMore = false;

  if (shouldSkipCount) {
    // Fast pagination: detect hasMore by checking if we got limit+1 items
    hasMore = finalData.length > limit;
    if (hasMore) {
      finalData = finalData.slice(0, limit); // Remove the extra item
    }
    totalCount = offset + finalData.length + (hasMore ? 1 : 0); // Approximate total
  } else {
    hasMore = (offset + limit) < totalCount;
  }

  // Badge data (derivedCount, hasUnviewedVariants, unviewedVariantCount) is now loaded
  // lazily via useVariantBadges hook to avoid blocking gallery display

  // Use shared transformer instead of inline transformation logic
  const items = finalData?.map((item: any) => {
    // Transform using shared function - handles all the complex logic
    return transformGeneration(item as RawGeneration, {
      shotId: filters?.shotId,
    });
  }) || [];

  return { items, total: totalCount, hasMore };
}

/**
 * Update generation location using direct Supabase call
 */
async function updateGenerationLocation(id: string, location: string, thumbUrl?: string): Promise<void> {
  const updateData: { location: string; thumbnail_url?: string } = { location };

  // If thumbUrl is provided, update it as well (important for flipped images)
  if (thumbUrl) {
    updateData.thumbnail_url = thumbUrl;
  }

  const { error } = await supabase
    .from('generations')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update generation: ${error.message}`);
  }
}

// NOTE: getTaskIdForGeneration moved to generationTaskBridge.ts for centralization

/**
 * Create a new generation using direct Supabase call
 */
async function createGeneration(params: {
  imageUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  projectId: string;
  prompt: string;
  thumbnailUrl?: string;
  /** Resolution in "WIDTHxHEIGHT" format (e.g., "1920x1080") */
  resolution?: string;
  /** Standard aspect ratio (e.g., "16:9") */
  aspectRatio?: string;
}): Promise<any> {
  const generationParams: Record<string, any> = {
    prompt: params.prompt,
    source: 'external_upload',
    original_filename: params.fileName,
    file_type: params.fileType,
    file_size: params.fileSize,
  };

  // Add dimension params if provided
  if (params.resolution) {
    generationParams.resolution = params.resolution;
  }
  if (params.aspectRatio) {
    generationParams.aspect_ratio = params.aspectRatio;
  }

  const { data, error } = await supabase
    .from('generations')
    .insert({
      location: params.imageUrl,
      thumbnail_url: params.thumbnailUrl || params.imageUrl, // Use thumbnail URL if provided, fallback to main image
      type: params.fileType || 'image',
      project_id: params.projectId,
      params: generationParams,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create generation: ${error?.message || 'Unknown error'}`);
  }

  // Create the original variant for this generation
  const { error: variantError } = await supabase
    .from('generation_variants')
    .insert({
      generation_id: data.id,
      location: params.imageUrl,
      thumbnail_url: params.thumbnailUrl || params.imageUrl,
      is_primary: true,
      variant_type: 'original',
      name: 'Original',
      params: generationParams,
    });

  if (variantError) {
    console.error('[useGenerations] Failed to create variant:', variantError);
  }

  return data;
}

/**
 * Star/unstar a generation using direct Supabase call
 */
async function toggleGenerationStar(id: string, starred: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('generations')
    .update({ starred })
    .eq('id', id)
    .select('id, starred');

  if (error) {
    throw new Error(`Failed to ${starred ? 'star' : 'unstar'} generation: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`Failed to update generation: No rows updated (possible RLS policy issue)`);
  }
}

export type GenerationsPaginatedResponse = {
  items: GeneratedImageWithMetadata[];
  total: number;
  hasMore: boolean;
};

export function useGenerations(
  projectId: string | null,
  page: number = 1,
  limit: number = 100,
  enabled: boolean = true,
  filters?: {
    toolType?: string;
    mediaType?: 'all' | 'image' | 'video';
    shotId?: string;
    excludePositioned?: boolean;
    starredOnly?: boolean;
    searchTerm?: string;
    includeChildren?: boolean;
    parentGenerationId?: string;
    sort?: 'newest' | 'oldest';
    editsOnly?: boolean; // Filter for images with based_on set (derived/edited images)
    parentsOnly?: boolean; // For variants: exclude child variants (those with parent_variant_id)
    variantsOnly?: boolean; // Fetch edit variants from generation_variants table
  },
  options?: {
    disablePolling?: boolean; // Disable smart polling (useful for long-running tasks)
  }
) {
  const offset = (page - 1) * limit;
  const queryClient = useQueryClient();
  const effectiveProjectId = projectId ?? (typeof window !== 'undefined' ? (window as any).__PROJECT_CONTEXT__?.selectedProjectId : null);
  const queryKey = ['unified-generations', 'project', effectiveProjectId, page, limit, filters];


  // 🎯 SMART POLLING: Use DataFreshnessManager for intelligent polling decisions
  // Can be disabled for tools with long-running tasks to prevent gallery flicker
  const smartPollingConfig = useSmartPollingConfig(['generations', projectId]);
  const pollingConfig = options?.disablePolling
    ? { refetchInterval: false, staleTime: Infinity }
    : smartPollingConfig;

  const result = useQuery<GenerationsPaginatedResponse, Error>({
    queryKey: queryKey,
    queryFn: () => fetchGenerations(effectiveProjectId, limit, offset, filters),
    enabled: !!effectiveProjectId && enabled,
    // Use `placeholderData` with `keepPreviousData` to prevent UI flashes on pagination/filter changes
    placeholderData: keepPreviousData,
    // Synchronously grab initial data from the cache on mount to prevent skeletons on revisit
    initialData: () => queryClient.getQueryData(queryKey),
    // Cache management to prevent memory leaks as pagination grows
    gcTime: 10 * 60 * 1000, // 10 minutes, slightly longer gcTime
    refetchOnWindowFocus: false, // Prevent double-fetches

    // 🎯 SMART POLLING: Intelligent polling based on realtime health (or disabled)
    ...pollingConfig,
    refetchIntervalInBackground: !options?.disablePolling, // Only poll in background if polling is enabled
    refetchOnReconnect: false, // Prevent double-fetches
  });

  // 🎯 MODULAR LOGGING: Standardized debug logging with data signature tracking
  useQueryDebugLogging(result, QueryDebugConfigs.generations({
    projectId,
    page,
    limit,
    enabled,
    filters,
    offset,
    queryKey: queryKey.join(':')
  }));

  return result;
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete generation: ${error.message}`);
      }
    },
    onSuccess: (data, variables) => {
      // Generation location update events are now handled by DataFreshnessManager via realtime events
    },
    onError: (error: Error) => {
      handleError(error, { context: 'useDeleteGeneration', toastTitle: 'Failed to delete generation' });
    },
  });
}

/**
 * Delete a variant from generation_variants table.
 * Use this for edit tools (edit-images, edit-video, character-animate) that create variants.
 */
export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('generation_variants')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete variant: ${error.message}`);
      }
    },
    onSuccess: (data, variables) => {
      // Variant deletion events are handled by DataFreshnessManager via realtime events
    },
    onError: (error: Error) => {
      handleError(error, { context: 'useDeleteVariant', toastTitle: 'Failed to delete variant' });
    },
  });
}

export function useUpdateGenerationLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, location, thumbUrl, projectId }: { id: string; location: string; thumbUrl?: string; projectId?: string }) => {
      return updateGenerationLocation(id, location, thumbUrl);
    },
    onSuccess: (data, variables) => {
      // Generation location update events are now handled by DataFreshnessManager via realtime events
    },
    onError: (error: Error) => {
      handleError(error, { context: 'useUpdateGenerationLocation', toastTitle: 'Failed to update generation' });
    },
  });
}


// NOTE: useGetTaskIdForGeneration moved to generationTaskBridge.ts for centralization

export function useCreateGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGeneration,
    onSuccess: (data, variables) => {
      // Emit domain event for generation creation
      // Generation insertion events are now handled by DataFreshnessManager via realtime events
    },
    onError: (error: Error) => {
      handleError(error, { context: 'useCreateGeneration', toastTitle: 'Failed to create generation' });
    },
  });
}

// ===== UNIFIED DERIVED ITEMS (Generations + Variants) =====

/**
 * Variant types that represent edits (should appear in "Based on this")
 */
export const EDIT_VARIANT_TYPES = ['inpaint', 'magic_edit', 'annotated_edit', 'edit'] as const;

/**
 * A derived item can be either a generation (old mode) or a variant (new mode)
 */
export interface DerivedItem {
  id: string;
  thumbUrl: string;
  url: string;
  createdAt: string;
  derivedCount: number;
  starred?: boolean;
  prompt?: string;

  /** Discriminator: 'generation' for old based_on, 'variant' for new variant edits */
  itemType: 'generation' | 'variant';

  /** Variant-specific fields */
  variantType?: string;
  variantName?: string;
  /** When variant was first viewed (null = not viewed, shows NEW badge) */
  viewedAt?: string | null;

  /** Generation-specific fields */
  basedOn?: string;
  shot_id?: string;
  timeline_frame?: number | null;
  all_shot_associations?: Array<{ shot_id: string; timeline_frame: number | null; position: number | null }>;
}

/**
 * Fetch derived items: BOTH child generations (based_on) AND edit variants
 * This provides backwards compatibility while supporting the new variant model.
 */
export async function fetchDerivedItems(
  sourceGenerationId: string | null
): Promise<DerivedItem[]> {
  if (!sourceGenerationId) {
    return [];
  }

  // Fetch both in parallel
  const [generationsResult, variantsResult] = await Promise.all([
    // 1. Child generations (backwards compatible - generations with based_on = this)
    // NOTE: Must specify FK explicitly to avoid ambiguous relationship error (PGRST201)
    // since there are two FKs between generations and shot_generations
    supabase
      .from('generations')
      .select(`
        id,
        location,
        thumbnail_url,
        type,
        created_at,
        params,
        starred,
        tasks,
        based_on,
        shot_generations!shot_generations_generation_id_generations_id_fk(shot_id, timeline_frame)
      `)
      .eq('based_on', sourceGenerationId)
      .order('starred', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    
    // 2. Edit variants (new mode - variants with edit types, excluding primary/original)
    supabase
      .from('generation_variants')
      .select('id, location, thumbnail_url, created_at, variant_type, name, params, is_primary, viewed_at')
      .eq('generation_id', sourceGenerationId)
      .in('variant_type', EDIT_VARIANT_TYPES)
      .eq('is_primary', false) // Exclude primary - that's the "current" version
      .order('created_at', { ascending: false })
  ]);

  if (generationsResult.error) {
    console.error('[DerivedItems] Error fetching child generations:', generationsResult.error);
  }
  if (variantsResult.error) {
    console.error('[DerivedItems] Error fetching edit variants:', variantsResult.error);
  }

  const childGenerations = generationsResult.data || [];
  const editVariants = variantsResult.data || [];

  // Use centralized function to count variants from both generations and generation_variants tables
  const generationIds = childGenerations.map(d => d.id);
  const { derivedCounts } = await calculateDerivedCounts(generationIds);

  // Normalize generations to DerivedItem format
  const normalizePosition = (timelineFrame: number | null | undefined) => {
    if (timelineFrame === null || timelineFrame === undefined) return null;
    return Math.floor(timelineFrame / 50);
  };

  const generationItems: DerivedItem[] = childGenerations.map((item: any) => {
    const shotGenerations = item.shot_generations || [];
    const allAssociations = shotGenerations.length > 1
      ? shotGenerations.map((sg: any) => ({
          shot_id: sg.shot_id,
          timeline_frame: sg.timeline_frame,
          position: normalizePosition(sg.timeline_frame),
        }))
      : undefined;

    const primaryShot = shotGenerations[0];

    return {
      id: item.id,
      thumbUrl: item.thumbnail_url || item.location,
      url: item.location,
      createdAt: item.created_at,
      derivedCount: derivedCounts[item.id] || 0,
      starred: item.starred || false,
      prompt: item.params?.prompt || item.params?.originalParams?.orchestrator_details?.prompt,
      itemType: 'generation' as const,
      basedOn: item.based_on,
      shot_id: primaryShot?.shot_id,
      timeline_frame: primaryShot?.timeline_frame,
      all_shot_associations: allAssociations,
    };
  });

  // Normalize variants to DerivedItem format
  const variantItems: DerivedItem[] = editVariants.map((variant: any) => ({
    id: variant.id,
    thumbUrl: variant.thumbnail_url || variant.location,
    url: variant.location,
    createdAt: variant.created_at,
    derivedCount: 0, // Variants can't have children
    starred: false, // Variants don't have starred flag
    prompt: variant.params?.prompt,
    itemType: 'variant' as const,
    variantType: variant.variant_type,
    variantName: variant.name,
    viewedAt: variant.viewed_at, // null = not viewed, shows NEW badge
  }));

  // Merge and sort by created_at (newest first), with starred generations at top
  const allItems = [...generationItems, ...variantItems].sort((a, b) => {
    // Starred items first (only generations can be starred)
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return allItems;
}

/**
 * Hook to fetch derived items (generations + variants based on this generation)
 * Used for the unified "Based on this" feature.
 */
export function useDerivedItems(
  sourceGenerationId: string | null,
  enabled: boolean = true
) {
  // 🎯 SMART POLLING: Use intelligent polling for derived items so new edits appear immediately
  const smartPollingConfig = useSmartPollingConfig(['derived-items', sourceGenerationId]);

  return useQuery<DerivedItem[], Error>({
    queryKey: ['derived-items', sourceGenerationId],
    queryFn: () => fetchDerivedItems(sourceGenerationId),
    enabled: !!sourceGenerationId && enabled,
    gcTime: 5 * 60 * 1000, // 5 minutes

    // 🎯 SMART POLLING: Intelligent polling based on realtime health
    ...smartPollingConfig,
    refetchIntervalInBackground: true, // Continue polling when tab inactive
    refetchOnWindowFocus: false, // Prevent double-fetches
    refetchOnReconnect: false, // Prevent double-fetches
  });
}

export function useToggleGenerationStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean; shotId?: string }) => {
      return toggleGenerationStar(id, starred);
    },
    onMutate: async ({ id, starred, shotId }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['unified-generations'] }),
        queryClient.cancelQueries({ queryKey: ['shots'] }),
        queryClient.cancelQueries({ queryKey: ['all-shot-generations'] }),
      ]);

      // Snapshot previous values for rollback
      const previousGenerationsQueries = new Map();
      const previousShotsQueries = new Map();
      const previousAllShotGenerationsQueries = new Map();

      // 1) Optimistically update all generations-list caches
      const generationsQueries = queryClient.getQueriesData({ queryKey: ['unified-generations'] });
      generationsQueries.forEach(([queryKey, data]) => {
        if (data && typeof data === 'object' && 'items' in data) {
          previousGenerationsQueries.set(queryKey, data);
          const updated = {
            ...data,
            items: (data as any).items.map((g: any) => (g.id === id ? { ...g, starred } : g)),
          };
          queryClient.setQueryData(queryKey, updated);
        }
      });

      // 2) Optimistically update all shots caches so star reflects in Shot views / timelines
      const shotsQueries = queryClient.getQueriesData({ queryKey: ['shots'] });
      shotsQueries.forEach(([queryKey, data]) => {
        if (Array.isArray(data)) {
          previousShotsQueries.set(queryKey, data);
          const updatedShots = (data as any).map((shot: any) => {
            if (!shot.images) return shot;
            return {
              ...shot,
              images: shot.images.map((img: any) => (img.id === id ? { ...img, starred } : img)),
            };
          });
          queryClient.setQueryData(queryKey, updatedShots);
        }
      });

      // 3) Optimistically update the EXACT all-shot-generations cache for this shot (used by Timeline/ShotEditor)
      if (shotId) {
        const queryKey = ['all-shot-generations', shotId];
        const previousData = queryClient.getQueryData(queryKey);
        if (previousData && Array.isArray(previousData)) {
          previousAllShotGenerationsQueries.set(queryKey, previousData);
          const updatedGenerations = previousData.map((gen: any) =>
            gen.id === id ? { ...gen, starred } : gen
          );
          queryClient.setQueryData(queryKey, updatedGenerations);
        }
      }

      return { previousGenerationsQueries, previousShotsQueries, previousAllShotGenerationsQueries };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic updates
      if (context?.previousGenerationsQueries) {
        context.previousGenerationsQueries.forEach((data, key) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousShotsQueries) {
        context.previousShotsQueries.forEach((data, key) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousAllShotGenerationsQueries) {
        context.previousAllShotGenerationsQueries.forEach((data, key) => {
          queryClient.setQueryData(key, data);
        });
      }
      handleError(error, { context: 'useToggleGenerationStar', toastTitle: 'Failed to toggle star' });
    },
    onSuccess: (_data, variables) => {
      // Emit custom event so Timeline knows to refetch star data
      if (variables.shotId) {
        window.dispatchEvent(new CustomEvent('generation-star-updated', {
          detail: { generationId: variables.id, shotId: variables.shotId, starred: variables.starred }
        }));
      }
    },
  });
}
