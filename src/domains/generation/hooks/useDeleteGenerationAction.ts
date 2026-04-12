import { useCallback, useState } from 'react';
import { useDeleteGeneration } from '@/domains/generation/hooks/useGenerationMutations';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { shouldSkipDeleteGenerationConfirm } from '@/shared/components/dialogs/DeleteGenerationConfirmDialog';

interface UseDeleteGenerationActionResult {
  pendingDeleteId: string | null;
  deletingId: string | null;
  isPending: boolean;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

interface UseDeleteGenerationActionOptions {
  projectId: string | null | undefined;
}

export function useDeleteGenerationAction({
  projectId,
}: UseDeleteGenerationActionOptions): UseDeleteGenerationActionResult {
  const deleteGenerationMutation = useDeleteGeneration();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const runDelete = useCallback(async (targetId: string) => {
    if (!projectId) {
      setPendingDeleteId(null);
      return;
    }
    setDeletingId(targetId);
    try {
      await deleteGenerationMutation.mutateAsync({ id: targetId, projectId });
      setPendingDeleteId((current) => (current === targetId ? null : current));
    } catch (error) {
      normalizeAndPresentError(error, {
        context: 'useDeleteGenerationAction.runDelete',
        toastTitle: 'Delete failed',
      });
      // Keep the dialog open so users can retry or cancel after a failed delete.
    } finally {
      setDeletingId((current) => (current === targetId ? null : current));
    }
  }, [deleteGenerationMutation, projectId]);

  const requestDelete = useCallback((id: string) => {
    if (shouldSkipDeleteGenerationConfirm()) {
      void runDelete(id);
      return;
    }
    setPendingDeleteId(id);
  }, [runDelete]);

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) {
      setPendingDeleteId(null);
      return;
    }
    await runDelete(pendingDeleteId);
  }, [pendingDeleteId, runDelete]);

  return {
    pendingDeleteId,
    deletingId,
    isPending: deleteGenerationMutation.isPending,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
