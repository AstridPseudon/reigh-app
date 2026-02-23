import { useMutation, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { GenerationRow } from '@/types/generationAndShots';
import { Task } from '@/types/tasks';
import { taskQueryKeys } from '@/shared/lib/queryKeys/tasks';
import { handleError } from '@/shared/lib/errorHandling/handleError';

interface TaskDbRow {
  id: string;
  task_type: string;
  params: Json | null;
  status: Task['status'];
  dependant_on?: string[] | null;
  output_location?: string | null;
  created_at: string;
  updated_at?: string | null;
  project_id: string;
  cost_cents?: number | null;
  generation_started_at?: string | null;
  generation_processed_at?: string | null;
  error_message?: string | null;
}

function mapDbTaskRowToTask(row: TaskDbRow): Task {
  return {
    id: row.id,
    taskType: row.task_type,
    params: (row.params && typeof row.params === 'object' && !Array.isArray(row.params))
      ? (row.params as Record<string, unknown>)
      : {},
    status: row.status,
    dependantOn: row.dependant_on ?? undefined,
    outputLocation: row.output_location ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    projectId: row.project_id,
    costCents: row.cost_cents ?? undefined,
    generationStartedAt: row.generation_started_at ?? undefined,
    generationProcessedAt: row.generation_processed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

// ================================================================
// CENTRALIZED GENERATION ↔ TASK INTEGRATION PATTERNS
// ================================================================
// This utility consolidates all the scattered logic for linking
// generations to their associated tasks across different components.
// 
// Previously duplicated in:
// - useGenerations.ts (getPrimaryTaskIdForGeneration)
// - useTaskPrefetch.ts (preloadTaskDataInBackground)
// - TaskDetailsModal.tsx (getTaskIdMutation)
// - TaskItem.tsx (generation-for-task lookup)
// - VideoOutputsGallery.tsx (manual preloading)

// ================================================================
// CORE MAPPING FUNCTIONS
// ================================================================

/**
 * Get the primary task ID for a generation.
 * Note: generations.tasks may contain multiple IDs; this helper intentionally keeps the first.
 */
async function getPrimaryTaskIdForGeneration(generationId: string): Promise<{ taskId: string | null }> {
  const { data, error } = await supabase
    .from('generations')
    .select('tasks')
    .eq('id', generationId)
    .single();

  if (error) {
    throw new Error(`Generation not found or has no task: ${error.message}`);
  }

  const tasksArray = data?.tasks as string[] | null;
  const primaryTaskId = Array.isArray(tasksArray) && tasksArray.length > 0 ? tasksArray[0] : null;

  return { taskId: primaryTaskId };
}

/**
 * Batch fetch primary task IDs for multiple generations (more efficient than individual calls)
 */
async function getPrimaryTaskIdsForGenerations(generationIds: string[]): Promise<Map<string, string | null>> {
  if (generationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('generations')
    .select('id, tasks')
    .in('id', generationIds);

  if (error) {
    throw new Error(`Failed to fetch task mappings: ${error.message}`);
  }

  const mappings = new Map<string, string | null>();
  data?.forEach(mapping => {
    const tasksArray = mapping.tasks as string[] | null;
    const primaryTaskId = Array.isArray(tasksArray) && tasksArray.length > 0 ? tasksArray[0] : null;
    mappings.set(mapping.id, primaryTaskId);
  });

  return mappings;
}

// ================================================================
// REACT HOOKS
// ================================================================

/**
 * Mutation for getting the primary task ID.
 */
export function useGetPrimaryTaskIdForGeneration() {
  return useMutation({
    mutationFn: getPrimaryTaskIdForGeneration,
    onError: (error: Error) => {
      handleError(error, { context: 'GenerationTaskBridge', showToast: false });
    },
  });
}

/**
 * Backwards-compatible alias.
 * Prefer useGetPrimaryTaskIdForGeneration in new code.
 */
export const useGetTaskIdForGeneration = useGetPrimaryTaskIdForGeneration;


// ================================================================
// CACHE MANAGEMENT
// ================================================================

/**
 * Preload task mappings for a batch of generations in the background
 */
export async function preloadGenerationTaskMappings(
  generationIds: string[], 
  queryClient: QueryClient,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    preloadFullTaskData?: boolean;
  } = {}
) {
  const { 
    batchSize = 5, 
    delayBetweenBatches = 200,
    preloadFullTaskData = false 
  } = options;

  for (let i = 0; i < generationIds.length; i += batchSize) {
    const batch = generationIds.slice(i, i + batchSize);
    
    try {
      // Batch fetch task IDs
      const mappings = await getPrimaryTaskIdsForGenerations(batch);
      
      // Cache the mappings
      mappings.forEach((taskId, generationId) => {
        queryClient.setQueryData(taskQueryKeys.generationMapping(generationId), { taskId });

        // Optionally preload full task data
        if (preloadFullTaskData && taskId) {
          queryClient.prefetchQuery({
            queryKey: taskQueryKeys.single(taskId),
            queryFn: async () => {
              const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single();
              
              if (error) throw error;
              return mapDbTaskRowToTask(data as TaskDbRow);
            },
            staleTime: 2 * 60 * 1000,
          });
        }
      });

    } catch (error) {
      handleError(error, { context: 'GenerationTaskBridge', showToast: false });
    }
    
    // Throttle between batches
    if (i + batchSize < generationIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
}


// ================================================================
// UTILITY FUNCTIONS
// ================================================================


/**
 * Enhance generations with task data from cache
 */
export function enhanceGenerationsWithTaskData(
  generations: GenerationRow[],
  queryClient: QueryClient
): (GenerationRow & { taskId?: string | null; taskData?: Task | null })[] {
  return generations.map(generation => {
    // Try to get cached task mapping
    const cachedMapping = queryClient.getQueryData<{ taskId: string | null }>(taskQueryKeys.generationMapping(generation.id));
    const taskId = cachedMapping?.taskId || null;

    // Try to get cached task data
    const taskData = taskId ? queryClient.getQueryData<Task>(taskQueryKeys.single(taskId)) : null;
    
    return {
      ...generation,
      taskId,
      taskData,
    };
  });
}
