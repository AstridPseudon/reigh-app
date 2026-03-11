import type { QueryClient } from '@tanstack/react-query';
import {
  operationSuccess,
  type OperationResult,
} from '@/shared/lib/operationResult';
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
): Promise<OperationResult<void>> {
  const optimisticUpdateResult = runOptimisticCacheUpdate(
    input.applyOptimisticUpdate,
    input.optimisticContext,
  );
  if (!optimisticUpdateResult.ok) {
    return optimisticUpdateResult;
  }

  const persistResult = await persistReferenceSelection({
    queryClient: input.queryClient,
    selectedProjectId: input.selectedProjectId,
    updateProjectImageSettings: input.updateProjectImageSettings,
  });
  if (!persistResult.ok) {
    return persistResult;
  }

  return operationSuccess(undefined, { policy: persistResult.policy });
}
