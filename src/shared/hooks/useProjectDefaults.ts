import { useEffect, useRef } from 'react';
import { usePrefetchToolSettings } from '@/shared/hooks/usePrefetchToolSettings';
import { useMobileTimeoutFallback } from '@/shared/hooks/useMobileTimeoutFallback';
import { Project } from '@/types/project';

interface UseProjectDefaultsOptions {
  userId: string | null;
  selectedProjectId: string | null;
  isLoadingProjects: boolean;
  isLoadingPreferences: boolean;
  projects: Project[];
  fetchProjects: () => Promise<void>;
  applyCrossDeviceSync: (projects: Project[]) => void;
}

/**
 * Orchestrates project-related side effects:
 * - Triggers fetchProjects when userId is available
 * - Cross-device sync when preferences + projects are both loaded
 * - Prefetches tool settings for the selected project
 * - Mobile timeout fallback for stalled fetches
 */
export function useProjectDefaults({
  userId,
  selectedProjectId,
  isLoadingProjects,
  isLoadingPreferences,
  projects,
  fetchProjects,
  applyCrossDeviceSync,
}: UseProjectDefaultsOptions) {
  // [PROFILING] Track fetch invocations to detect triple-fetch issue
  const fetchInvocationCountRef = useRef(0);
  const lastFetchReasonRef = useRef<string>('');

  // Prefetch all tool settings for the currently selected project
  usePrefetchToolSettings(selectedProjectId);

  // Trigger initial project fetch when userId becomes available
  useEffect(() => {
    if (userId) {
      fetchInvocationCountRef.current += 1;
      const reason = `userId=${!!userId}, isLoadingPreferences=${isLoadingPreferences}`;
      lastFetchReasonRef.current = reason;

      fetchProjects();
    }
  }, [userId, isLoadingPreferences, fetchProjects]);

  // Cross-device sync: apply server preferences once projects + prefs are loaded
  useEffect(() => {
    if (projects.length > 0) {
      applyCrossDeviceSync(projects);
    }
  }, [projects, applyCrossDeviceSync]);

  // [MobileStallFix] Fallback recovery: retry fetch if projects loading stalls
  useMobileTimeoutFallback({
    isLoading: isLoadingProjects,
    onTimeout: fetchProjects,
    mobileTimeoutMs: 15000,
    desktopTimeoutMs: 10000,
    enabled: !!userId,
  });
}
