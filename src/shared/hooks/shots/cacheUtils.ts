import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { Shot, GenerationRow } from '@/types/shots';
import { queryKeys } from '@/shared/lib/queryKeys';

/**
 * All maxImagesPerShot values used across the app.
 * Cache operations must iterate these to keep every variant in sync.
 *
 *   undefined - useListShots default (no explicit limit)
 *   0         - unlimited (ShotsContext main query)
 *   2         - sidebar / mobile compact view
 *   5         - compact desktop view
 *
 * If you add a new useListShots call with a different maxImagesPerShot,
 * add its value here so cache updates propagate correctly.
 */
export const SHOTS_CACHE_VARIANTS = [undefined, 0, 2, 5] as const;

function getShotsCacheKeys(projectId: string): readonly QueryKey[] {
  return SHOTS_CACHE_VARIANTS.map(variant =>
    variant === undefined
      ? [...queryKeys.shots.all, projectId] as const
      : queryKeys.shots.list(projectId, variant)
  );
}

/**
 * @param onlyExisting - If true, only update caches that already exist.
 *                       If false (default), will create cache entries if needed.
 */
export function updateAllShotsCaches(
  queryClient: QueryClient,
  projectId: string,
  updater: (old: Shot[] | undefined) => Shot[],
  onlyExisting: boolean = false
): void {
  getShotsCacheKeys(projectId).forEach(key => {
    if (onlyExisting) {
      const existing = queryClient.getQueryData<Shot[]>(key);
      if (existing !== undefined) {
        queryClient.setQueryData(key, updater(existing));
      }
    } else {
      // Pass updater function directly - React Query will call it with undefined if no cache
      queryClient.setQueryData<Shot[]>(key, (old) => updater(old));
    }
  });
}

export function rollbackShotsCaches(
  queryClient: QueryClient,
  projectId: string,
  previous: Shot[] | undefined
): void {
  if (!previous) return;
  getShotsCacheKeys(projectId).forEach(key => {
    queryClient.setQueryData(key, previous);
  });
}

export async function cancelShotsQueries(
  queryClient: QueryClient,
  projectId: string
): Promise<void> {
  await Promise.all(
    getShotsCacheKeys(projectId).map(key =>
      queryClient.cancelQueries({ queryKey: key })
    )
  );
}

export function findShotsCache(
  queryClient: QueryClient,
  projectId: string
): Shot[] | undefined {
  for (const key of getShotsCacheKeys(projectId)) {
    const data = queryClient.getQueryData<Shot[]>(key);
    if (data && data.length > 0) return data;
  }
  return undefined;
}

export function rollbackShotGenerationsCache(
  queryClient: QueryClient,
  shotId: string,
  previous: GenerationRow[] | undefined
): void {
  if (!previous) return;
  queryClient.setQueryData(queryKeys.generations.byShot(shotId), previous);
}

export async function cancelShotGenerationsQuery(
  queryClient: QueryClient,
  shotId: string
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: queryKeys.generations.byShot(shotId) });
}
