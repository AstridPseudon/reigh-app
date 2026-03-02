import { useCallback, useState } from 'react';
import { useDeleteGeneration } from '@/domains/generation/hooks/useGenerationMutations';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';

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

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId || !projectId) {
      setPendingDeleteId(null);
      return;
    }

    const targetId = pendingDeleteId;
    setDeletingId(targetId);
    try {
      await deleteGenerationMutation.mutateAsync({ id: targetId, projectId });
      setPendingDeleteId((current) => (current === targetId ? null : current));
    } catch (error) {
      normalizeAndPresentError(error, {
        context: 'useDeleteGenerationAction.confirmDelete',
        toastTitle: 'Delete failed',
      });
      // Keep the dialog open so users can retry or cancel after a failed delete.
    } finally {
      setDeletingId((current) => (current === targetId ? null : current));
    }
  }, [deleteGenerationMutation, pendingDeleteId, projectId]);

  return {
    pendingDeleteId,
    deletingId,
    isPending: deleteGenerationMutation.isPending,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
