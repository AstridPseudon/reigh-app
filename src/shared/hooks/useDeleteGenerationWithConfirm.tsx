import { useState, useCallback } from 'react';
import { useDeleteGeneration } from '@/shared/hooks/useGenerationMutations';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

/**
 * Wraps useDeleteGeneration with a confirmation dialog.
 *
 * Returns `requestDelete(id)` which opens the dialog, and a
 * `DeleteConfirmDialog` component that must be rendered by the caller.
 *
 * Works in both hooks and components:
 * - Hooks: return `requestDelete` and `DeleteConfirmDialog` to the consuming component
 * - Components: call `requestDelete` and render `<DeleteConfirmDialog />` directly
 *
 * @example
 * ```tsx
 * const { requestDelete, DeleteConfirmDialog, isPending } = useDeleteGenerationWithConfirm();
 *
 * return (
 *   <>
 *     <button onClick={() => requestDelete(id)}>Delete</button>
 *     <DeleteConfirmDialog />
 *   </>
 * );
 * ```
 */
export function useDeleteGenerationWithConfirm() {
  const deleteGenerationMutation = useDeleteGeneration();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingDeleteId) {
      deleteGenerationMutation.mutate(pendingDeleteId);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, deleteGenerationMutation]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingDeleteId(null);
    }
  }, []);

  const DeleteConfirmDialog = useCallback(() => (
    <ConfirmDialog
      open={pendingDeleteId !== null}
      onOpenChange={handleOpenChange}
      title="Delete Generation"
      description="Are you sure you want to delete this generation? This action cannot be undone."
      confirmText="Delete"
      destructive
      onConfirm={handleConfirm}
    />
  ), [pendingDeleteId, handleOpenChange, handleConfirm]);

  return {
    requestDelete,
    DeleteConfirmDialog,
    isPending: deleteGenerationMutation.isPending,
    deletingId: deleteGenerationMutation.isPending ? (deleteGenerationMutation.variables as string) : null,
  };
}
