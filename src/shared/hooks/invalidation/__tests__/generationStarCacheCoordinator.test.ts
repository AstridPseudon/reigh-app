import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  applyOptimisticGenerationStarUpdate,
  rollbackOptimisticGenerationStarUpdate,
} from '../generationStarCacheCoordinator';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

describe('generationStarCacheCoordinator', () => {
  it('applies optimistic star updates across unified, shots, and by-shot caches', async () => {
    const queryClient = createQueryClient();
    const generationId = 'gen-1';
    const shotId = 'shot-1';
    const projectId = 'project-1';
    const unifiedKey = queryKeys.unified.byProject(projectId, 1, 50, null, false);
    const shotsKey = queryKeys.shots.list(projectId);
    const byShotKey = queryKeys.generations.byShot(shotId);

    queryClient.setQueryData(unifiedKey, {
      items: [{ id: generationId, starred: false }, { id: 'gen-2', starred: false }],
    });
    queryClient.setQueryData(shotsKey, [
      {
        id: shotId,
        name: 'Shot 1',
        images: [{ id: generationId, starred: false }, { id: 'gen-2', starred: false }],
      },
    ]);
    queryClient.setQueryData(byShotKey, [
      { id: generationId, starred: false },
      { id: 'gen-2', starred: false },
    ]);

    await applyOptimisticGenerationStarUpdate(queryClient, {
      generationId,
      starred: true,
      shotId,
    });

    expect((queryClient.getQueryData(unifiedKey) as { items: Array<{ id: string; starred: boolean }> }).items[0]?.starred).toBe(true);
    expect((queryClient.getQueryData(shotsKey) as Array<{ images: Array<{ id: string; starred: boolean }> }>)[0]?.images[0]?.starred).toBe(true);
    expect((queryClient.getQueryData(byShotKey) as Array<{ id: string; starred: boolean }>)[0]?.starred).toBe(true);
  });

  it('rolls back optimistic updates with captured context', async () => {
    const queryClient = createQueryClient();
    const generationId = 'gen-1';
    const shotId = 'shot-1';
    const projectId = 'project-1';
    const unifiedKey = queryKeys.unified.byProject(projectId, 1, 50, null, false);

    queryClient.setQueryData(unifiedKey, {
      items: [{ id: generationId, starred: false }],
    });

    const context = await applyOptimisticGenerationStarUpdate(queryClient, {
      generationId,
      starred: true,
      shotId,
    });
    expect((queryClient.getQueryData(unifiedKey) as { items: Array<{ starred: boolean }> }).items[0]?.starred).toBe(true);

    rollbackOptimisticGenerationStarUpdate(queryClient, context);

    expect((queryClient.getQueryData(unifiedKey) as { items: Array<{ starred: boolean }> }).items[0]?.starred).toBe(false);
  });
});
