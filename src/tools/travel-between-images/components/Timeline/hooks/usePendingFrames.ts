import { useState, useEffect } from 'react';
import type { GenerationRow } from '@/types/shots';

export interface UsePendingFramesProps {
  shotId: string;
  images: GenerationRow[];
  isUploadingImage: boolean;
}

export interface UsePendingFramesReturn {
  pendingDropFrame: number | null;
  setPendingDropFrame: (frame: number | null) => void;
  pendingDuplicateFrame: number | null;
  setPendingDuplicateFrame: (frame: number | null) => void;
  pendingExternalAddFrame: number | null;
  isInternalDropProcessing: boolean;
  setIsInternalDropProcessing: (processing: boolean) => void;
  /** Combined pending frame (for marker display) */
  activePendingFrame: number | null;
}

/**
 * Manages pending frame state for skeleton placeholders during:
 * - File drops
 * - Image duplication
 * - External adds (from GenerationsPane)
 */
export function usePendingFrames({
  shotId,
  images,
  isUploadingImage,
}: UsePendingFramesProps): UsePendingFramesReturn {
  const [pendingDropFrame, setPendingDropFrame] = useState<number | null>(null);
  const [pendingDuplicateFrame, setPendingDuplicateFrame] = useState<number | null>(null);
  const [pendingExternalAddFrame, setPendingExternalAddFrame] = useState<number | null>(null);
  const [isInternalDropProcessing, setIsInternalDropProcessing] = useState(false);

  // Listen for global pending add events (from GenerationsPane)
  useEffect(() => {
    const handlePendingAdd = (event: CustomEvent) => {
      const { frame, shotId: targetShotId } = event.detail;

      // Only handle if this is for the current shot
      if (targetShotId && targetShotId !== shotId) {
        return;
      }

      setPendingExternalAddFrame(frame);
    };

    window.addEventListener('timeline:pending-add', handlePendingAdd as EventListener);
    return () => {
      window.removeEventListener('timeline:pending-add', handlePendingAdd as EventListener);
    };
  }, [shotId]);

  // Clear pending drop frame when upload finishes
  useEffect(() => {
    if (!isUploadingImage && !isInternalDropProcessing) {
      setPendingDropFrame(null);
    }
  }, [isUploadingImage, isInternalDropProcessing]);

  // Clear pending duplicate frame when the new item appears
  useEffect(() => {
    if (pendingDuplicateFrame !== null) {
      const hasImageAtFrame = images.some(img => img.timeline_frame === pendingDuplicateFrame);
      if (hasImageAtFrame) {
        setPendingDuplicateFrame(null);
      }
    }
  }, [images, pendingDuplicateFrame]);

  // Safety timeout for pending duplicate frame
  useEffect(() => {
    if (pendingDuplicateFrame !== null) {
      const timer = setTimeout(() => {
        setPendingDuplicateFrame(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingDuplicateFrame]);

  // Clear pending external add frame when the new item appears
  useEffect(() => {
    if (pendingExternalAddFrame !== null) {
      const imageAtFrame = images.find(img => img.timeline_frame === pendingExternalAddFrame);
      if (imageAtFrame) {
        setTimeout(() => setPendingExternalAddFrame(null), 100);
      }
    }
  }, [images, pendingExternalAddFrame]);

  // Safety timeout for pending external add frame
  useEffect(() => {
    if (pendingExternalAddFrame !== null) {
      const timer = setTimeout(() => {
        setPendingExternalAddFrame(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingExternalAddFrame]);

  const activePendingFrame = pendingDropFrame ?? pendingDuplicateFrame ?? pendingExternalAddFrame;

  return {
    pendingDropFrame,
    setPendingDropFrame,
    pendingDuplicateFrame,
    setPendingDuplicateFrame,
    pendingExternalAddFrame,
    isInternalDropProcessing,
    setIsInternalDropProcessing,
    activePendingFrame,
  };
}
