import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { GenerationRow, Shot } from '@/domains/generation/types';

export interface GenerationStarOptimisticUpdateInput {
  generationId: string;
  starred: boolean;
  shotId?: string;
}

export interface GenerationStarOptimisticContext {
  previousGenerationsQueries: Map<readonly unknown[], unknown>;
  previousShotsQueries: Map<readonly unknown[], unknown>;
  previousAllShotGenerationsQueries: Map<readonly unknown[], unknown>;
}

interface UnifiedGenerationListData {
  items: GenerationRow[];
}

function isUnifiedGenerationListData(data: unknown): data is UnifiedGenerationListData {
  if (!data || typeof data !== 'object' || !('items' in data)) {
    return false;
  }
  const candidate = data as { items?: unknown };
  return Array.isArray(candidate.items);
}

export async function applyOptimisticGenerationStarUpdate(
  queryClient: QueryClient,
  input: GenerationStarOptimisticUpdateInput,
): Promise<GenerationStarOptimisticContext> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.unified.all }),
    queryClient.cancelQueries({ queryKey: queryKeys.shots.all }),
    queryClient.cancelQueries({ queryKey: queryKeys.generations.byShotAll }),
  ]);

  const previousGenerationsQueries = new Map<readonly unknown[], unknown>();
  const previousShotsQueries = new Map<readonly unknown[], unknown>();
  const previousAllShotGenerationsQueries = new Map<readonly unknown[], unknown>();

  const generationsQueries = queryClient.getQueriesData({ queryKey: queryKeys.unified.all });
  generationsQueries.forEach(([queryKey, data]) => {
    if (!isUnifiedGenerationListData(data)) {
      return;
    }

    previousGenerationsQueries.set(queryKey, data);
    queryClient.setQueryData(queryKey, {
      ...data,
      items: data.items.map((generation) => (
        generation.id === input.generationId ? { ...generation, starred: input.starred } : generation
      )),
    });
  });

  const shotsQueries = queryClient.getQueriesData({ queryKey: queryKeys.shots.all });
  shotsQueries.forEach(([queryKey, data]) => {
    if (!Array.isArray(data)) {
      return;
    }

    previousShotsQueries.set(queryKey, data);
    queryClient.setQueryData(queryKey, (data as Shot[]).map((shot) => {
      if (!shot.images) {
        return shot;
      }
      return {
        ...shot,
        images: shot.images.map((image) => (
          image.id === input.generationId ? { ...image, starred: input.starred } : image
        )),
      };
    }));
  });

  if (input.shotId) {
    const shotQueryKey = queryKeys.generations.byShot(input.shotId);
    const previousShotData = queryClient.getQueryData(shotQueryKey);
    if (Array.isArray(previousShotData)) {
      previousAllShotGenerationsQueries.set(shotQueryKey, previousShotData);
      queryClient.setQueryData(
        shotQueryKey,
        (previousShotData as GenerationRow[]).map((generation) => (
          generation.id === input.generationId ? { ...generation, starred: input.starred } : generation
        )),
      );
    }
  }

  return {
    previousGenerationsQueries,
    previousShotsQueries,
    previousAllShotGenerationsQueries,
  };
}

export function rollbackOptimisticGenerationStarUpdate(
  queryClient: QueryClient,
  context?: GenerationStarOptimisticContext,
): void {
  if (!context) {
    return;
  }

  context.previousGenerationsQueries.forEach((data, key) => {
    queryClient.setQueryData(key, data);
  });
  context.previousShotsQueries.forEach((data, key) => {
    queryClient.setQueryData(key, data);
  });
  context.previousAllShotGenerationsQueries.forEach((data, key) => {
    queryClient.setQueryData(key, data);
  });
}
