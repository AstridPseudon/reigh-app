import { useDebouncedSettingsSave } from '@/shared/settings/hooks/useDebouncedSettingsSave';
import type { MutableRefObject } from 'react';

type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

function cloneSettings<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

interface TransitionReadyWithPendingSaveInput<T extends object> {
  markReady: () => void;
  debouncedSave: ReturnType<typeof useDebouncedSettingsSave<T>>;
  saveImmediateRef: MutableRefObject<(settingsToSave?: T) => Promise<void>>;
  debounceMs: number;
}

export function transitionReadyWithPendingSave<T extends object>({
  markReady,
  debouncedSave,
  saveImmediateRef,
  debounceMs,
}: TransitionReadyWithPendingSaveInput<T>): void {
  markReady();
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
}

interface ApplyLoadedDataStateResult<T extends object> {
  settings: T;
  loadedSettings: T;
  hasPersistedData: boolean;
  status: AutoSaveStatus;
  error: Error | null;
}

export function applyLoadedDataState<T extends object>({
  data,
  hadPersistedData,
  isCustomMode,
}: ApplyLoadedDataInput<T>): ApplyLoadedDataStateResult<T> {
  const cloned = cloneSettings(data);
  return {
    settings: cloned,
    loadedSettings: cloneSettings(cloned),
    hasPersistedData: isCustomMode ? hadPersistedData : false,
    status: 'ready',
    error: null,
  };
}

interface ApplyEntityChangeStateInput<T extends object> {
  entityId: string | null;
  previousEntityId: string | null;
  defaults: T;
  isCustomMode: boolean;
  rqIsLoading: boolean;
  dbSettings: T | undefined;
}

interface ApplyEntityChangeStateResult<T extends object> {
  action: {
    entityId: string | null;
    settings: T;
    status: AutoSaveStatus;
    hasPersistedData: boolean;
    error: Error | null;
  };
  loadedSettings: T | null;
}

export function resolveEntityChange<T extends object>({
  entityId,
  previousEntityId,
  defaults,
  isCustomMode,
  rqIsLoading,
  dbSettings,
}: ApplyEntityChangeStateInput<T>): ApplyEntityChangeStateResult<T> | null {
  if (entityId === previousEntityId) {
    return null;
  }

  if (!entityId) {
    return {
      action: {
        entityId: null,
        settings: cloneSettings(defaults),
        status: 'idle',
        hasPersistedData: false,
        error: null,
      },
      loadedSettings: null,
    };
  }

  if (!isCustomMode && !rqIsLoading) {
    const loaded = cloneSettings({ ...defaults, ...(dbSettings as Record<string, unknown> | undefined) } as T);
    return {
      action: {
        entityId,
        settings: loaded,
        status: 'ready',
        hasPersistedData: false,
        error: null,
      },
      loadedSettings: cloneSettings(loaded),
    };
  }

  return {
    action: {
      entityId,
      settings: cloneSettings(defaults),
      status: 'loading',
      hasPersistedData: false,
      error: null,
    },
    loadedSettings: null,
  };
}
