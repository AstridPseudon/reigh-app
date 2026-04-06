import { useCallback, useState } from 'react';
import { useProjectSelectionContext } from '@/shared/contexts/ProjectContext';
import {
  useShotFinalVideos,
  type ShotFinalVideo,
} from '@/tools/travel-between-images/hooks/video/useShotFinalVideos';

export type { ShotFinalVideo };

export function useFinalVideoAvailable() {
  const { selectedProjectId } = useProjectSelectionContext();
  const { finalVideoMap } = useShotFinalVideos(selectedProjectId);
  const [dismissedShotIds, setDismissedShotIds] = useState<Set<string>>(() => new Set());

  const dismissShot = useCallback((shotId: string) => {
    setDismissedShotIds((prev) => {
      const next = new Set(prev);
      next.add(shotId);
      return next;
    });
  }, []);

  return {
    finalVideoMap,
    dismissedShotIds,
    dismissShot,
  };
}
