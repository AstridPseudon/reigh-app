import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '../../lib/queryKeys';

export type ShotInvalidationScope = 'list' | 'detail' | 'all';

export interface ShotInvalidationOptions {
  scope?: ShotInvalidationScope;
  reason: string;
  shotId?: string;
  projectId?: string;
}

function performShotInvalidation(
  queryClient: QueryClient,
  options: ShotInvalidationOptions
): void {
  const { scope = 'all', shotId, projectId } = options;

  if ((scope === 'list' || scope === 'all') && projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.shots.list(projectId) });
  }

  if ((scope === 'detail' || scope === 'all') && shotId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.shots.detail(shotId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShot(shotId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.generations.meta(shotId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.segments.liveTimeline(shotId) });
  }
}

function useInvalidateShots() {
  const queryClient = useQueryClient();
  return useCallback((options: ShotInvalidationOptions) => {
    performShotInvalidation(queryClient, options);
  }, [queryClient]);
}

void useInvalidateShots;

function invalidateShotsSync(
  queryClient: QueryClient,
  options: ShotInvalidationOptions
): void {
  performShotInvalidation(queryClient, options);
}

void invalidateShotsSync;
