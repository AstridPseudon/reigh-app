import { useMemo } from 'react';
import { GenerationRow, Shot } from "@/domains/generation/types";
import { ShotEditorState } from '../../state/types';
import { useDeleteActions } from './useDeleteActions';
import { useDuplicateAction } from './useDuplicateAction';
import { useDropActions } from './useDropActions';
import type { ShotEditorActions } from '../../state/useShotEditorState';

type GenerationActionSet = Pick<
  ShotEditorActions,
  | 'setUploadingImage'
  | 'setFileInputKey'
  | 'setDeletingVideoId'
  | 'setDuplicatingImageId'
  | 'setDuplicateSuccessImageId'
  | 'setPendingFramePositions'
  | 'setAutoAdjustedAspectRatio'
>;

interface UseGenerationActionsProps {
  state: ShotEditorState;
  actions: GenerationActionSet;
  selectedShot: Shot;
  projectId: string;
  batchVideoFrames: number;
  orderedShotImages: GenerationRow[];
}

/**
 * Composition hook that combines all generation action sub-hooks.
 *
 * Sub-hooks:
 * - useDeleteActions: handleDeleteImageFromShot, handleBatchDeleteImages
 * - useDuplicateAction: handleDuplicateImage
 * - useDropActions: handleTimelineImageDrop, handleTimelineGenerationDrop,
 *                   handleBatchImageDrop, handleBatchGenerationDrop
 */
export const useGenerationActions = ({
  state,
  actions,
  selectedShot,
  projectId,
  batchVideoFrames,
  orderedShotImages,
}: UseGenerationActionsProps) => {
  const { handleDeleteImageFromShot, handleBatchDeleteImages } = useDeleteActions({
    selectedShot,
    projectId,
    orderedShotImages,
  });

  const { handleDuplicateImage } = useDuplicateAction({
    state,
    actions,
    selectedShot,
    projectId,
    orderedShotImages,
  });

  const {
    handleTimelineImageDrop,
    handleTimelineGenerationDrop,
    handleBatchImageDrop,
    handleBatchGenerationDrop,
    handleVariantDrop,
  } = useDropActions({
    actions,
    selectedShot,
    projectId,
    batchVideoFrames,
  });

  // Memoize the return object to prevent callback instability in parent components.
  // All sub-hook callbacks have empty dependency arrays and use refs internally.
  return useMemo(() => ({
    handleDeleteImageFromShot,
    handleBatchDeleteImages,
    handleDuplicateImage,
    handleTimelineImageDrop,
    handleTimelineGenerationDrop,
    handleBatchImageDrop,
    handleBatchGenerationDrop,
    handleVariantDrop,
  }), [
    handleDeleteImageFromShot,
    handleBatchDeleteImages,
    handleDuplicateImage,
    handleTimelineImageDrop,
    handleTimelineGenerationDrop,
    handleBatchImageDrop,
    handleBatchGenerationDrop,
    handleVariantDrop,
  ]);
};
