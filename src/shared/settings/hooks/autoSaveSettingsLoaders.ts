import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { deepEqual } from '@/shared/lib/utils/deepEqual';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { useDebouncedSettingsSave } from '@/shared/settings/hooks/useDebouncedSettingsSave';

type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface CustomModeLoadContext<T extends object> {
  isCustomMode: boolean;
  entityId: string | null;
  enabled: boolean;
  statusRef: MutableRefObject<AutoSaveStatus>;
  defaults: T;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  customLoadRef: MutableRefObject<((entityId: string) => Promise<T | null>) | undefined>;
  currentEntityIdRef: MutableRefObject<string | null>;
  isLoadingRef: MutableRefObject<boolean>;
  transitionReadyWithPendingSave: () => void;
  applyLoadedData: (data: T, hadPersistedData: boolean) => void;
  setStatus: (s: AutoSaveStatus) => void;
  setError: (e: Error | null) => void;
}

interface ReactQueryModeLoadContext<T extends object> {
  isCustomMode: boolean;
  entityId: string | null;
  enabled: boolean;
  statusRef: MutableRefObject<AutoSaveStatus>;
  defaults: T;
  dbSettings: T | undefined;
  rqIsLoading: boolean;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  loadedSettingsRef: MutableRefObject<T | null>;
  transitionReadyWithPendingSave: () => void;
  setSettings: Dispatch<SetStateAction<T>>;
  setStatus: (s: AutoSaveStatus) => void;
  setError: (e: Error | null) => void;
}

export function useCustomModeLoad<T extends object>(ctx: CustomModeLoadContext<T>) {
  const {
    isCustomMode,
    entityId,
    enabled,
    statusRef,
    defaults,
    debouncedSave,
    customLoadRef,
    currentEntityIdRef,
    isLoadingRef,
    transitionReadyWithPendingSave,
    applyLoadedData,
    setStatus,
    setError,
  } = ctx;

  useEffect(() => {
    if (!isCustomMode || !entityId || !enabled) {
      return;
    }
    if (statusRef.current !== 'idle' && statusRef.current !== 'loading') {
      return;
    }

    if (debouncedSave.hasPendingFor(entityId)) {
      transitionReadyWithPendingSave();
      return;
    }

    setStatus('loading');
    isLoadingRef.current = true;

    customLoadRef.current!(entityId)
      .then((loaded) => {
        if (currentEntityIdRef.current !== entityId) {
          return;
        }

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
        setStatus('error');
        isLoadingRef.current = false;
        setError(err as Error);
      });
  }, [isCustomMode, entityId, enabled, defaults, debouncedSave]);
}

export function useReactQueryModeLoad<T extends object>(ctx: ReactQueryModeLoadContext<T>) {
  const {
    isCustomMode,
    entityId,
    enabled,
    statusRef,
    defaults,
    dbSettings,
    rqIsLoading,
    debouncedSave,
    loadedSettingsRef,
    transitionReadyWithPendingSave,
    setSettings,
    setStatus,
    setError,
  } = ctx;

  useEffect(() => {
    if (isCustomMode || !entityId || !enabled) {
      return;
    }

    const currentStatus = statusRef.current;
    if (rqIsLoading) {
      if (currentStatus === 'idle') {
        setStatus('loading');
      }
      return;
    }

    if (currentStatus === 'saving') {
      return;
    }

    if (debouncedSave.hasPendingFor(entityId)) {
      if (currentStatus !== 'ready') {
        transitionReadyWithPendingSave();
      }
      return;
    }

    const loadedSettings: T = { ...defaults, ...(dbSettings || {}) };
    const clonedSettings = JSON.parse(JSON.stringify(loadedSettings));

    if (loadedSettingsRef.current && deepEqual(clonedSettings, loadedSettingsRef.current)) {
      if (currentStatus !== 'ready') {
        setStatus('ready');
      }
      return;
    }

    setSettings(clonedSettings);
    loadedSettingsRef.current = JSON.parse(JSON.stringify(clonedSettings));
    setStatus('ready');
    setError(null);
  }, [isCustomMode, entityId, rqIsLoading, dbSettings, defaults, enabled, debouncedSave]);
}
