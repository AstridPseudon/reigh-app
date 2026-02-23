import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type React from 'react';
import type { MutableRefObject } from 'react';
import type { GenerationRow, Shot } from '@/types/shots';
import { useImageManagement } from '../hooks';
import type { useGenerationActions } from '../hooks';

interface UseImageManagementControllerParams {
  queryClient: QueryClient;
  selectedShotRef: MutableRefObject<Shot | undefined>;
  projectIdRef: MutableRefObject<string | null>;
  allShotImagesRef: MutableRefObject<GenerationRow[]>;
  batchVideoFramesRef: MutableRefObject<number>;
  updateShotImageOrderMutation: ReturnType<typeof import('@/shared/hooks/shots').useUpdateShotImageOrder>;
  demoteOrphanedVariants: (shotId: string, reason: string) => void;
  actionsRef: MutableRefObject<{
    setPendingFramePositions: (value: Map<string, number>) => void;
  }>;
  pendingFramePositions: Map<string, number>;
  generationActions: ReturnType<typeof useGenerationActions>;
}

export function useImageManagementController({
  queryClient,
  selectedShotRef,
  projectIdRef,
  allShotImagesRef,
  batchVideoFramesRef,
  updateShotImageOrderMutation,
  demoteOrphanedVariants,
  actionsRef,
  pendingFramePositions,
  generationActions,
}: UseImageManagementControllerParams) {
  const {
    isClearingFinalVideo,
    handleDeleteFinalVideo,
    handleReorderImagesInShot,
    handlePendingPositionApplied,
  } = useImageManagement({
    queryClient,
    selectedShotRef,
    projectIdRef,
    allShotImagesRef,
    batchVideoFramesRef,
    updateShotImageOrderMutation,
    demoteOrphanedVariants,
    actionsRef,
    pendingFramePositions,
  });

  // Image upload handler (accepts File[] from ImageUploadActions)
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      await generationActions.handleBatchImageDrop(files);
    }
  }, [generationActions]);

  return {
    isClearingFinalVideo,
    handleDeleteFinalVideo,
    handleReorderImagesInShot,
    handlePendingPositionApplied,
    handleImageUpload,
  };
}
