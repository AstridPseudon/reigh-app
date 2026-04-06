import { useCallback } from 'react';
import { toast } from '@/shared/components/ui/runtime/sonner';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import type {
  CreateShotActionInput,
  CreateShotOptions,
  ShotCreationResult,
  UseShotCreationReturn,
} from './shotCreationTypes';
import {
  clearShotSkeletonEvent,
  dispatchShotSkeletonEvent,
} from './shotCreationEffects';
import {
  createEmptyShotPath,
  createShotWithFilesPath,
  createShotWithGenerationPath,
  createShotWithGenerationsPath,
} from './shotCreationPaths';

export function useCreateShotAction({
  selectedProjectId,
  shots,
  queryClient,
  setIsCreating,
  generateShotName,
  applyPostCreationEffects,
  createShotMutation,
  createShotWithGenerationsMutation,
  handleExternalImageDropMutation,
}: CreateShotActionInput): UseShotCreationReturn['createShot'] {
  return useCallback(async (options: CreateShotOptions = {}): Promise<ShotCreationResult | null> => {
    if (!selectedProjectId) {
      toast.error('No project selected');
      return null;
    }

    const {
      name,
      generationId,
      generationIds,
      files,
      aspectRatio,
      dispatchSkeletonEvents = true,
      onProgress,
    } = options;

    const shotName = name || generateShotName();
    const imageCount = files?.length || generationIds?.length || (generationId ? 1 : 0);
    if (dispatchSkeletonEvents && imageCount > 0) {
      dispatchShotSkeletonEvent(imageCount);
    }

    setIsCreating(true);
    try {
      let result: ShotCreationResult;
      if (generationIds?.length && !files?.length) {
        result = await createShotWithGenerationsPath({
          selectedProjectId,
          shotName,
          generationIds,
          queryClient,
          createShotWithGenerations: createShotWithGenerationsMutation,
        });
      } else if (generationId && !files?.length) {
        result = await createShotWithGenerationPath({
          selectedProjectId,
          shotName,
          generationId,
          queryClient,
          createShotWithGenerations: createShotWithGenerationsMutation,
        });
      } else if (files?.length) {
        result = await createShotWithFilesPath({
          selectedProjectId,
          shotName,
          files,
          aspectRatio,
          shots,
          queryClient,
          onProgress,
          createShot: createShotMutation,
          uploadToShot: handleExternalImageDropMutation,
        });
      } else {
        result = await createEmptyShotPath({
          selectedProjectId,
          shotName,
          aspectRatio,
          createShot: createShotMutation,
        });
      }

      applyPostCreationEffects(result, options);
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      if (dispatchSkeletonEvents) {
        clearShotSkeletonEvent();
      }
      normalizeAndPresentError(error, {
        context: 'useShotCreation',
        toastTitle: 'Failed to create shot',
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [
    selectedProjectId,
    generateShotName,
    setIsCreating,
    shots,
    queryClient,
    createShotMutation,
    createShotWithGenerationsMutation,
    handleExternalImageDropMutation,
    applyPostCreationEffects,
  ]);
}
