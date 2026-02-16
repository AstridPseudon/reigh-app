import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '../../lib/queryKeys';
import { invalidateGenerationsSync } from './useGenerationInvalidation';

export type TaskInvalidationScope = 'list' | 'detail' | 'counts' | 'all';

export interface TaskInvalidationOptions {
  scope?: TaskInvalidationScope;
  reason: string;
  taskId?: string;
  projectId?: string;
  includeGenerations?: boolean;
  shotId?: string;
}

function performTaskInvalidation(
  queryClient: QueryClient,
  options: TaskInvalidationOptions
): void {
  const { scope = 'all', reason, taskId, projectId, includeGenerations, shotId } = options;

  if ((scope === 'list' || scope === 'all') && projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
  }

  if ((scope === 'detail' || scope === 'all') && taskId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
  }

  if ((scope === 'counts' || scope === 'all') && projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.statusCounts(projectId) });
  }

  if (includeGenerations && shotId) {
    invalidateGenerationsSync(queryClient, shotId, {
      reason: `${reason} (task completion)`,
      scope: 'all',
    });
  }
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return useCallback((options: TaskInvalidationOptions) => {
    performTaskInvalidation(queryClient, options);
  }, [queryClient]);
}

void useInvalidateTasks;

function invalidateTasksSync(
  queryClient: QueryClient,
  options: TaskInvalidationOptions
): void {
  performTaskInvalidation(queryClient, options);
}

void invalidateTasksSync;
