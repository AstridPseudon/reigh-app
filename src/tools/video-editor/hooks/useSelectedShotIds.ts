import { useMemo } from 'react';
import { useShots } from '@/shared/contexts/ShotsContext';
import { useTimelineEditorData } from '@/tools/video-editor/contexts/TimelineEditorContext';

function getClipGenerationId(
  data: NonNullable<ReturnType<typeof useTimelineEditorData>['data']>,
  clipId: string,
): string | undefined {
  const assetKey = data.meta[clipId]?.asset;
  const generationId = assetKey ? data.registry.assets[assetKey]?.generationId : undefined;
  return typeof generationId === 'string' && generationId.length > 0 ? generationId : undefined;
}

export function useSelectedShotIds(): { highlightedShotIds: ReadonlySet<string> } {
  const { data, selectedClipIds } = useTimelineEditorData();
  const { shots } = useShots();

  return useMemo(() => {
    if (!data || selectedClipIds.size === 0) {
      return { highlightedShotIds: new Set<string>() };
    }

    const clipToShotId = new Map<string, string>();
    for (const group of data.config.pinnedShotGroups ?? []) {
      for (const clipId of group.clipIds) {
        clipToShotId.set(clipId, group.shotId);
      }
    }

    const generationToShotId = new Map<string, string>();
    for (const shot of shots ?? []) {
      for (const image of shot.images ?? []) {
        const generationId = image.generation_id;
        if (typeof generationId === 'string' && generationId.length > 0) {
          generationToShotId.set(generationId, shot.id);
        }
      }
    }

    const highlightedShotIds = new Set<string>();
    for (const clipId of selectedClipIds) {
      const pinnedShotId = clipToShotId.get(clipId);
      if (pinnedShotId) {
        highlightedShotIds.add(pinnedShotId);
        continue;
      }

      const generationId = getClipGenerationId(data, clipId);
      if (!generationId) {
        continue;
      }

      const fallbackShotId = generationToShotId.get(generationId);
      if (fallbackShotId) {
        highlightedShotIds.add(fallbackShotId);
      }
    }

    return { highlightedShotIds };
  }, [data, selectedClipIds, shots]);
}
