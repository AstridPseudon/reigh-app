import { useEffect } from 'react';
import type { ShotGeneration } from '@/shared/hooks/useTimelineCore';
import { useTimelinePositions } from './useTimelinePositions';

interface PositionManagementProps {
  shotId: string;
  shotGenerations: ShotGeneration[];
  frameSpacing: number;
  isDragInProgress: boolean;
  onFramePositionsChange?: (framePositions: Map<string, number>) => void;
}

export function usePositionManagement({
  shotId,
  shotGenerations,
  frameSpacing,
  isDragInProgress,
  onFramePositionsChange,
}: PositionManagementProps) {

  const positionSystem = useTimelinePositions({
    shotId,
    shotGenerations,
    frameSpacing,
    onPositionsChange: onFramePositionsChange,
  });

  // Lock/unlock positions during drag operations
  useEffect(() => {
    if (isDragInProgress) {
      positionSystem.lockPositions();
    } else {
      positionSystem.unlockPositions();
    }
  }, [isDragInProgress, positionSystem]);

  const setFramePositions = async (newPositions: Map<string, number>) => {
    await positionSystem.updatePositions(newPositions, { operation: 'drag' });
  };

  return {
    displayPositions: positionSystem.positions,
    setFramePositions,
  };
}
