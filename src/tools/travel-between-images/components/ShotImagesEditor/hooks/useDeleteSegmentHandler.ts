import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { useQueryClient } from '@tanstack/react-query';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import {
  operationFailure,
  operationSuccess,
} from '@/shared/lib/operationResult';
import {
  deleteSegmentGenerationGroup,
  syncSegmentDeletionCaches,
} from '../services/segmentDeletionService';

interface SegmentDeleteOperationResult {
  deleted: boolean;
}

export function useDeleteSegmentHandler(
  queryClient: ReturnType<typeof useQueryClient>,
  setDeletingSegmentId: Dispatch<SetStateAction<string | null>>,
  projectId?: string,
) {
  return useCallback(async (generationId: string) => {
    if (!projectId) {
      return operationFailure(new Error('Project scope is required for segment deletion'), {
        policy: 'fail_closed',
        recoverable: false,
        errorCode: 'shot_editor_segment_delete_missing_project_scope',
        message: 'Project scope is required for segment deletion',
      });
    }

    setDeletingSegmentId(generationId);
    try {
      const deletion = await deleteSegmentGenerationGroup({
        generationId,
        projectId,
      });

      if (!deletion.deleted) {
        return operationSuccess(
          { deleted: false } satisfies SegmentDeleteOperationResult,
          { policy: 'best_effort' },
        );
      }

      await syncSegmentDeletionCaches({
        queryClient,
        projectId,
        parentGenerationId: deletion.parentGenerationId,
        idsToDelete: deletion.idsToDelete,
      });

      return operationSuccess(
        { deleted: true } satisfies SegmentDeleteOperationResult,
        { policy: 'best_effort' },
      );
    } catch (error) {
      normalizeAndPresentError(error, {
        context: 'SegmentDelete',
        toastTitle: 'Failed to delete segment',
      });
      return operationFailure(error, {
        policy: 'best_effort',
        recoverable: true,
        errorCode: 'shot_editor_segment_delete_failed',
        message: 'Failed to delete segment',
      });
    } finally {
      setDeletingSegmentId(null);
    }
  }, [projectId, queryClient, setDeletingSegmentId]);
}
