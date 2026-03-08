import type { QueryClient } from '@tanstack/react-query';
import { toOperationResultError } from '@/shared/lib/operationResult';
import { runOptimisticCacheUpdate } from './optimisticCacheUpdate';
import { persistReferenceSelection } from './referenceDomainService';
import type { ProjectImageSettings } from '../../types';

interface PersistOptimisticReferenceSelectionInput {
  queryClient: QueryClient;
  selectedProjectId: string | undefined;
  optimisticContext: string;
  applyOptimisticUpdate: () => void;
  updateProjectImageSettings: (
    scope: 'project' | 'shot',
    updates: Partial<ProjectImageSettings>
  ) => Promise<void>;
}

export async function persistOptimisticReferenceSelection(
  input: PersistOptimisticReferenceSelectionInput,
): Promise<void> {
  const optimisticUpdateResult = runOptimisticCacheUpdate(
    input.applyOptimisticUpdate,
    input.optimisticContext,
  );
  if (!optimisticUpdateResult.ok) {
    throw toOperationResultError(optimisticUpdateResult);
  }

  const persistResult = await persistReferenceSelection({
    queryClient: input.queryClient,
    selectedProjectId: input.selectedProjectId,
    updateProjectImageSettings: input.updateProjectImageSettings,
  });
  if (!persistResult.ok) {
    throw toOperationResultError(persistResult);
  }
}
