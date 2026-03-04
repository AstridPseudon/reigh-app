import type { QueryClient } from '@tanstack/react-query';
import { GenerationRow, Shot } from '@/domains/generation/types';
import { shotQueryKeys } from '@/shared/lib/queryKeys/shots';
import type { GenerationPreviewInput } from './shotCreationTypes';

interface ApplyAtomicShotCacheUpdateInput {
  selectedProjectId: string;
  shotId: string;
  shotName: string;
  shotGenerationId: string;
  generationId: string;
  generationPreview?: GenerationPreviewInput;
  shots: Shot[] | undefined;
  queryClient: QueryClient;
}

export function applyAtomicShotCacheUpdate(input: ApplyAtomicShotCacheUpdateInput): void {
  const {
    selectedProjectId,
    shotId,
    shotName,
    shotGenerationId,
    generationId,
    generationPreview,
    shots,
    queryClient,
  } = input;

  const updateShotCache = (oldShots: Shot[] = []) => {
    if (oldShots.some((shot) => shot.id === shotId)) {
      return oldShots;
    }

    const maxPosition = oldShots.reduce((max, shot) => {
      const position = typeof shot.position === 'number' ? shot.position : 0;
      return Math.max(max, position);
    }, 0);

    const optimisticImage: GenerationRow = {
      id: shotGenerationId,
      generation_id: generationId,
      imageUrl: generationPreview?.imageUrl,
      thumbUrl: generationPreview?.thumbUrl,
      type: generationPreview?.type ?? undefined,
      location: generationPreview?.location ?? generationPreview?.imageUrl ?? undefined,
      timeline_frame: 0,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    const newShot: Shot = {
      id: shotId,
      name: shotName,
      images: [optimisticImage],
      project_id: selectedProjectId,
      position: maxPosition + 1,
      created_at: new Date().toISOString(),
    };

    return [...oldShots, newShot];
  };

  queryClient.setQueryData<Shot[]>(shotQueryKeys.list(selectedProjectId, 0), updateShotCache);
  queryClient.setQueryData<Shot[]>(shotQueryKeys.list(selectedProjectId, 5), updateShotCache);
  queryClient.setQueryData<Shot[]>([...shotQueryKeys.all, selectedProjectId], updateShotCache);
  queryClient.setQueryData(shotQueryKeys.detail(shotId), (old: Shot | undefined) => old ?? ({
    id: shotId,
    name: shotName,
    images: [],
    project_id: selectedProjectId,
    position: (shots?.reduce((max, shot) => Math.max(max, shot.position || 0), 0) ?? 0) + 1,
    created_at: new Date().toISOString(),
  } as Shot));
}
