import { useDebouncedSettingsSave } from '@/shared/settings/hooks/useDebouncedSettingsSave';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

function cloneSettings<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

interface TransitionReadyWithPendingSaveInput<T extends object> {
  setStatus: (status: AutoSaveStatus) => void;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  saveImmediateRef: MutableRefObject<(settingsToSave?: T) => Promise<void>>;
  debounceMs: number;
}

export function transitionReadyWithPendingSave<T extends object>({
  setStatus,
  debouncedSave,
  saveImmediateRef,
  debounceMs,
}: TransitionReadyWithPendingSaveInput<T>): void {
  setStatus('ready');
  debouncedSave.cancelPendingSave();
  const toSave = debouncedSave.pendingSettingsRef.current!;
  debouncedSave.saveTimeoutRef.current = setTimeout(async () => {
    try {
      await saveImmediateRef.current(toSave);
    } catch {
      // surface handled at save layer; keep transition helper side-effect only
    }
  }, debounceMs);
}

interface ApplyLoadedDataInput<T extends object> {
  data: T;
  hadPersistedData: boolean;
  isCustomMode: boolean;
  setSettings: Dispatch<SetStateAction<T>>;
  loadedSettingsRef: MutableRefObject<T | null>;
  setHasPersistedData: Dispatch<SetStateAction<boolean>>;
  setStatus: (status: AutoSaveStatus) => void;
  setError: (error: Error | null) => void;
}

export function applyLoadedDataState<T extends object>({
  data,
  hadPersistedData,
  isCustomMode,
  setSettings,
  loadedSettingsRef,
  setHasPersistedData,
  setStatus,
  setError,
}: ApplyLoadedDataInput<T>): void {
  const cloned = cloneSettings(data);
  setSettings(cloned);
  loadedSettingsRef.current = cloneSettings(cloned);
  if (isCustomMode) {
    setHasPersistedData(hadPersistedData);
  }
  setStatus('ready');
  setError(null);
}

interface ApplyEntityChangeStateInput<T extends object> {
  entityId: string | null;
  previousEntityId: string | null;
  currentEntityIdRef: MutableRefObject<string | null>;
  defaults: T;
  isCustomMode: boolean;
  rqIsLoading: boolean;
  dbSettings: T | undefined;
  setSettings: Dispatch<SetStateAction<T>>;
  setStatus: (status: AutoSaveStatus) => void;
  setHasPersistedData: Dispatch<SetStateAction<boolean>>;
  loadedSettingsRef: MutableRefObject<T | null>;
  setError: (error: Error | null) => void;
}

export function applyEntityChangeState<T extends object>({
  entityId,
  previousEntityId,
  currentEntityIdRef,
  defaults,
  isCustomMode,
  rqIsLoading,
  dbSettings,
  setSettings,
  setStatus,
  setHasPersistedData,
  loadedSettingsRef,
  setError,
}: ApplyEntityChangeStateInput<T>): void {
  if (entityId === previousEntityId) {
    return;
  }

  currentEntityIdRef.current = entityId;
  if (!entityId) {
    setSettings(defaults);
    setStatus('idle');
    setHasPersistedData(false);
    loadedSettingsRef.current = null;
    return;
  }

  if (previousEntityId) {
    setHasPersistedData(false);
    if (!isCustomMode && !rqIsLoading && dbSettings) {
      const loaded = { ...defaults, ...(dbSettings as Record<string, unknown>) } as T;
      const cloned = cloneSettings(loaded);
      setSettings(cloned);
      loadedSettingsRef.current = cloneSettings(cloned);
      setStatus('ready');
      setError(null);
      return;
    }

    setSettings(defaults);
    setStatus('loading');
    loadedSettingsRef.current = null;
  }
}
