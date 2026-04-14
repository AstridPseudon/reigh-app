import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { deepEqual } from '@/shared/lib/utils/deepEqual';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { useDebouncedSettingsSave } from '@/shared/settings/hooks/useDebouncedSettingsSave';

type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface CustomModeLoadContext<T extends object> {
  isCustomMode: boolean;
  entityId: string | null;
  enabled: boolean;
  status: AutoSaveStatus;
  defaults: T;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  customLoadRef: MutableRefObject<((entityId: string) => Promise<T | null>) | undefined>;
  stateRef: MutableRefObject<{ entityId: string | null; settings: T; hasPersistedData: boolean }>;
  isLoadingRef: MutableRefObject<boolean>;
  transitionReadyWithPendingSave: () => void;
  applyLoadedData: (data: T, hadPersistedData: boolean) => void;
  startLoad: () => void;
  setLoadError: (e: Error) => void;
}

interface ReactQueryModeLoadContext<T extends object> {
  isCustomMode: boolean;
  entityId: string | null;
  enabled: boolean;
  status: AutoSaveStatus;
  defaults: T;
  dbSettings: T | undefined;
  rqIsLoading: boolean;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  loadedSettingsRef: MutableRefObject<T | null>;
  transitionReadyWithPendingSave: () => void;
  applyLoadedData: (data: T, hadPersistedData: boolean) => void;
  startLoad: () => void;
  markReady: () => void;
}

export function useCustomModeLoad<T extends object>(ctx: CustomModeLoadContext<T>) {
  const {
    isCustomMode,
    entityId,
    enabled,
    status,
    defaults,
    debouncedSave,
    customLoadRef,
    stateRef,
    isLoadingRef,
    transitionReadyWithPendingSave,
    applyLoadedData,
    startLoad,
    setLoadError,
  } = ctx;

  useEffect(() => {
    if (!isCustomMode || !entityId || !enabled) {
      return;
    }
    if (status !== 'idle' && status !== 'loading') {
      return;
    }
    if (isLoadingRef.current) {
      return;
    }

    // Keep this guard: pending refs still protect typed-but-unflushed text edits from async loads.
    if (debouncedSave.hasPendingFor(entityId)) {
      transitionReadyWithPendingSave();
      return;
    }

    startLoad();
    isLoadingRef.current = true;

    customLoadRef.current!(entityId)
      .then((loaded) => {
        if (stateRef.current.entityId !== entityId) {
          return;
        }

        // Keep this guard: a load that resolves after local typing must not overwrite pending text state.
        if (debouncedSave.hasPendingFor(entityId)) {
          isLoadingRef.current = false;
          transitionReadyWithPendingSave();
          return;
        }

        isLoadingRef.current = false;
        applyLoadedData(loaded ? { ...defaults, ...loaded } : defaults, !!loaded);
      })
      .catch((err) => {
        normalizeAndPresentError(err, { context: 'useAutoSaveSettings.load', showToast: false });
        isLoadingRef.current = false;
        setLoadError(err as Error);
      });
  }, [
    isCustomMode,
    entityId,
    enabled,
    status,
    defaults,
    debouncedSave,
    customLoadRef,
    stateRef,
    isLoadingRef,
    transitionReadyWithPendingSave,
    applyLoadedData,
    startLoad,
    setLoadError,
  ]);
}

export function useReactQueryModeLoad<T extends object>(ctx: ReactQueryModeLoadContext<T>) {
  const {
    isCustomMode,
    entityId,
    enabled,
    status,
    defaults,
    dbSettings,
    rqIsLoading,
    debouncedSave,
    loadedSettingsRef,
    transitionReadyWithPendingSave,
    applyLoadedData,
    startLoad,
    markReady,
  } = ctx;

  useEffect(() => {
    if (isCustomMode || !entityId || !enabled) {
      return;
    }

    if (rqIsLoading) {
      if (status === 'idle') {
        startLoad();
      }
      return;
    }

    if (status === 'saving') {
      return;
    }

    // Keep this guard: React Query cache refreshes must not stomp pending text edits for the same entity.
    if (debouncedSave.hasPendingFor(entityId)) {
      if (status !== 'ready') {
        transitionReadyWithPendingSave();
      }
      return;
    }

    const loadedSettings: T = { ...defaults, ...(dbSettings || {}) };
    const clonedSettings = JSON.parse(JSON.stringify(loadedSettings));

    if (loadedSettingsRef.current && deepEqual(clonedSettings, loadedSettingsRef.current)) {
      if (status !== 'ready') {
        markReady();
      }
      return;
    }

    applyLoadedData(clonedSettings, !!dbSettings);
  }, [
    isCustomMode,
    entityId,
    enabled,
    status,
    defaults,
    dbSettings,
    rqIsLoading,
    debouncedSave,
    loadedSettingsRef,
    transitionReadyWithPendingSave,
    applyLoadedData,
    startLoad,
    markReady,
  ]);
}
