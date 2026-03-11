import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTaskInProject } from '@/integrations/supabase/repositories/taskRepository';
import { taskQueryKeys } from '@/shared/lib/queryKeys/tasks';
import {
  getSourceTaskIdLegacyCompatible,
  hasOrchestratorDetails,
} from '@/shared/lib/taskIdHelpers';
import type { TaskDetailsData } from '../../types';

interface VariantTaskLike {
  params?: Record<string, unknown> | null;
}

interface UseVariantSourceTaskInput {
  projectId?: string | null;
  activeVariant: VariantTaskLike | null;
  taskDetailsData: TaskDetailsData | undefined;
}

export function useVariantSourceTask(input: UseVariantSourceTaskInput) {
  const { projectId, activeVariant, taskDetailsData } = input;

  const { variantSourceTaskId, variantHasOrchestratorDetails } = useMemo(() => {
    const variantParams = activeVariant?.params as Record<string, unknown> | undefined;
    return {
      variantSourceTaskId: getSourceTaskIdLegacyCompatible(variantParams),
      variantHasOrchestratorDetails: hasOrchestratorDetails(variantParams),
    };
  }, [activeVariant?.params]);

  const {
    data: variantSourceTask,
    error: variantSourceTaskQueryError,
    isLoading: isLoadingVariantTask,
  } = useQuery({
    queryKey: taskQueryKeys.single(variantSourceTaskId ?? '', projectId ?? null),
    queryFn: async () => {
      if (!variantSourceTaskId || !projectId) {
        return null;
      }

      try {
        return await fetchTaskInProject(variantSourceTaskId, projectId);
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }

        const message = (
          typeof error === 'object'
          && error !== null
          && 'message' in error
          && typeof error.message === 'string'
        )
          ? error.message
          : 'Failed to fetch source task';
        throw new Error(message);
      }
    },
    enabled: !!variantSourceTaskId
      && !!projectId
      && variantSourceTaskId !== taskDetailsData?.taskId
      && !variantHasOrchestratorDetails,
    staleTime: Infinity,
  });
  const variantSourceTaskError = useMemo(() => {
    if (!variantSourceTaskQueryError) {
      return null;
    }
    return variantSourceTaskQueryError instanceof Error
      ? variantSourceTaskQueryError
      : new Error('Failed to fetch source task');
  }, [variantSourceTaskQueryError]);

  return {
    variantSourceTaskId,
    variantHasOrchestratorDetails,
    variantSourceTask,
    variantSourceTaskError,
    isLoadingVariantTask,
  };
}
