import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '../../lib/queryKeys';

export type SettingsInvalidationScope = 'tool' | 'segment' | 'user' | 'pair' | 'all';

export interface SettingsInvalidationOptions {
  scope: SettingsInvalidationScope;
  reason: string;
  toolId?: string;
  projectId?: string;
  shotId?: string;
  pairId?: string;
}

function performSettingsInvalidation(
  queryClient: QueryClient,
  options: SettingsInvalidationOptions
): void {
  const { scope, toolId, projectId, shotId, pairId } = options;

  if ((scope === 'tool' || scope === 'all') && toolId && projectId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.settings.tool(toolId, projectId, shotId),
    });
  }

  if ((scope === 'pair' || scope === 'all') && pairId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.segments.pairMetadata(pairId),
    });
  }

  if (scope === 'user' || scope === 'all') {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.user });
  }
}

function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return useCallback((options: SettingsInvalidationOptions) => {
    performSettingsInvalidation(queryClient, options);
  }, [queryClient]);
}

void useInvalidateSettings;

function invalidateSettingsSync(
  queryClient: QueryClient,
  options: SettingsInvalidationOptions
): void {
  performSettingsInvalidation(queryClient, options);
}

void invalidateSettingsSync;
