import { useReducer, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useToolSettings } from '@/shared/hooks/settings/useToolSettings';
import { useRenderLogger } from '@/shared/lib/debug/debugRendering';
import { useDebouncedSettingsSave } from '@/shared/settings/hooks/useDebouncedSettingsSave';
import { deepEqual } from '@/shared/lib/utils/deepEqual';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { useCustomModeLoad, useReactQueryModeLoad } from '@/shared/settings/hooks/autoSaveSettingsLoaders';
import {
  applyLoadedDataState,
  resolveEntityChange,
  transitionReadyWithPendingSave,
} from '@/shared/settings/hooks/autoSaveSettingsHelpers';

/**
 * Status states for the auto-save settings lifecycle.
 */
type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface AutoSaveState<T extends object> {
  entityId: string | null;
  settings: T;
  status: AutoSaveStatus;
  error: Error | null;
  hasPersistedData: boolean;
}

type AutoSaveAction<T extends object> =
  | {
      type: 'ENTITY_CHANGED';
      entityId: string | null;
      settings: T;
      status: AutoSaveStatus;
      error: Error | null;
      hasPersistedData: boolean;
    }
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_RESOLVED'; settings: T; hasPersistedData: boolean }
  | {
      type: 'SETTINGS_UPDATED';
      nextSettings?: T;
      merge?: Partial<T>;
      status?: AutoSaveStatus;
      error?: Error | null;
      hasPersistedData?: boolean;
    };

function autoSaveSettingsReducer<T extends object>(
  state: AutoSaveState<T>,
  action: AutoSaveAction<T>
): AutoSaveState<T> {
  switch (action.type) {
    case 'ENTITY_CHANGED':
      return {
        entityId: action.entityId,
        settings: action.settings,
        status: action.status,
        error: action.error,
        hasPersistedData: action.hasPersistedData,
      };

    case 'LOAD_STARTED':
      return {
        ...state,
        status: 'loading',
        error: null,
      };

    case 'LOAD_RESOLVED':
      return {
        ...state,
        settings: action.settings,
        status: 'ready',
        error: null,
        hasPersistedData: action.hasPersistedData,
      };

    case 'SETTINGS_UPDATED': {
      const settings = action.nextSettings ?? { ...state.settings, ...action.merge };
      return {
        ...state,
        settings,
        status: action.status ?? state.status,
        error: Object.prototype.hasOwnProperty.call(action, 'error') ? (action.error ?? null) : state.error,
        hasPersistedData: Object.prototype.hasOwnProperty.call(action, 'hasPersistedData')
          ? (action.hasPersistedData ?? state.hasPersistedData)
          : state.hasPersistedData,
      };
    }

    default:
      return state;
  }
}

/**
 * Custom load/save functions for non-React-Query persistence.
 */
interface CustomLoadSave<T> {
  load: (entityId: string) => Promise<T | null>;
  save: (entityId: string, data: T) => Promise<void>;
  entityId: string | null;
  onFlush?: (entityId: string, data: T) => void;
}

interface UseAutoSaveSettingsOptions<T> {
  toolId?: string;
  shotId?: string | null;
  projectId?: string | null;
  scope?: 'shot' | 'project';
  debounceMs?: number;
  defaults: T;
  enabled?: boolean;
  debug?: boolean;
  debugTag?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  customLoadSave?: CustomLoadSave<T>;
}

interface UseAutoSaveSettingsReturn<T> {
  settings: T;
  status: AutoSaveStatus;
  entityId: string | null;
  isDirty: boolean;
  error: Error | null;
  hasShotSettings: boolean;
  hasPersistedData: boolean;
  updateField: <K extends keyof T>(key: K, value: T[K]) => void;
  updateFields: (updates: Partial<T>) => void;
  updateTextField: <K extends keyof T>(key: K, value: T[K]) => void;
  updateTextFields: (updates: Partial<T>) => void;
  save: () => Promise<void>;
  saveImmediate: (dataToSave?: T) => Promise<void>;
  revert: () => void;
  reset: (newDefaults?: T) => void;
  initializeFrom: (data: Partial<T>) => void;
}

/**
 * Recommended hook for auto-saving settings to the database.
 *
 * This is the default choice for new features that need persisted settings.
 * Builds on `useToolSettings` (cascade resolution) and adds auto-save, dirty tracking,
 * entity-change handling, and unmount flushing.
 *
 * Features:
 * - Loads settings from DB with scope cascade (defaults -> user -> project -> shot)
 * - Debounced auto-save on field changes (default 300ms)
 * - Flushes pending saves on unmount/navigation
 * - Dirty tracking for unsaved changes indicator
 * - Status machine for loading states
 * - Optional customLoadSave mode for non-React-Query persistence
 *
 * CRITICAL: During loading (status !== 'ready'), updates only affect local UI state.
 * This prevents auto-initialization effects from blocking DB values.
 *
 * @see docs/structure_detail/settings_system.md for the full settings hook decision tree
 *
 * @example
 * ```typescript
 * // React Query mode (tool settings)
 * const settings = useAutoSaveSettings({
 *   toolId: 'my-tool',
 *   shotId: selectedShotId,
 *   scope: 'shot',
 *   defaults: { prompt: '', mode: 'basic' },
 * });
 *
 * // Custom load/save mode
 * const settings = useAutoSaveSettings({
 *   defaults: { prompt: '', mode: 'basic' },
 *   customLoadSave: {
 *     entityId: generationId,
 *     load: (id) => fetchFromDB(id),
 *     save: (id, data) => saveToDB(id, data),
 *   },
 * });
 *
 * // Update a field (auto-saves after debounce)
 * settings.updateField('prompt', 'new prompt');
 *
 * // Check if ready before rendering
 * if (settings.status !== 'ready') return <Loading />;
 * ```
 */
export function useAutoSaveSettings<T extends object>(
  options: UseAutoSaveSettingsOptions<T>
): UseAutoSaveSettingsReturn<T> {
  const {
    toolId = '',
    shotId,
    projectId,
    scope = 'shot',
    debounceMs = 300,
    defaults,
    enabled = true,
    onSaveSuccess,
    onSaveError,
    customLoadSave,
  } = options;

  const isCustomMode = !!customLoadSave;

  // Determine the entity ID based on mode
  const entityId = isCustomMode
    ? customLoadSave.entityId
    : (scope === 'shot' ? shotId : projectId) ?? null;
  const isEntityValid = !!entityId;

  // Reducer-backed state is the single source of truth for entity/status/settings transitions.
  const [state, dispatch] = useReducer(autoSaveSettingsReducer<T>, {
    entityId,
    settings: JSON.parse(JSON.stringify(defaults)),
    status: entityId ? 'idle' : 'idle',
    error: null,
    hasPersistedData: false,
  });

  // Refs for tracking state without triggering re-renders
  const loadedSettingsRef = useRef<T | null>(null);
  const isLoadingRef = useRef(false);
  const stateRef = useRef<AutoSaveState<T>>(state);

  // Stable refs for custom callbacks to avoid effect dependency churn
  const customLoadRef = useRef(customLoadSave?.load);
  const customSaveRef = useRef(customLoadSave?.save);
  const onFlushRef = useRef(customLoadSave?.onFlush);
  customLoadRef.current = customLoadSave?.load;
  customSaveRef.current = customLoadSave?.save;
  onFlushRef.current = customLoadSave?.onFlush;

  // Fetch settings from database (React Query mode only)
  const {
    settings: dbSettings,
    isLoading: rqIsLoading,
    update: updateSettings,
    hasShotSettings,
  } = useToolSettings<T>(toolId, {
    shotId: scope === 'shot' ? (shotId || undefined) : undefined,
    projectId: projectId || undefined,
    enabled: !isCustomMode && enabled && isEntityValid,
  });

  useLayoutEffect(() => {
    const entityChange = resolveEntityChange({
      entityId,
      previousEntityId: state.entityId,
      defaults,
      isCustomMode,
      rqIsLoading,
      dbSettings,
    });

    if (!entityChange) {
      return;
    }

    loadedSettingsRef.current = entityChange.loadedSettings;
    isLoadingRef.current = false;
    stateRef.current = {
      ...stateRef.current,
      ...entityChange.action,
    };
    dispatch({
      type: 'ENTITY_CHANGED',
      ...entityChange.action,
    });
  }, [entityId, state.entityId, defaults, isCustomMode, rqIsLoading, dbSettings]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useRenderLogger(`AutoSaveSettings:${toolId}`, { entityId: state.entityId, status: state.status });

  // Dirty flag - has user changed anything since load?
  const isDirty = useMemo(
    () => (loadedSettingsRef.current ? !deepEqual(state.settings, loadedSettingsRef.current) : false),
    [state.settings]
  );

  // Save implementation
  const saveImmediate = useCallback(async (settingsToSave?: T): Promise<void> => {
    const currentEntityId = stateRef.current.entityId;
    if (!currentEntityId) {
      return;
    }

    const toSave = settingsToSave ?? stateRef.current.settings;

    // Don't save if nothing changed
    if (deepEqual(toSave, loadedSettingsRef.current)) {
      return;
    }

    stateRef.current = {
      ...stateRef.current,
      status: 'saving',
      error: null,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      nextSettings: toSave,
      status: 'saving',
      error: null,
    });

    try {
      if (isCustomMode) {
        await customSaveRef.current!(currentEntityId, toSave);
      } else {
        await updateSettings(scope, toSave);
      }

      // Update our "clean" reference
      loadedSettingsRef.current = JSON.parse(JSON.stringify(toSave));

      // NOTE: Don't clear pendingSettingsRef here - the scheduling layer only clears it
      // when the saved payload still matches the latest tracked local edits.

      const latestSettings = stateRef.current.settings;
      stateRef.current = {
        ...stateRef.current,
        settings: latestSettings,
        status: 'ready',
        error: null,
        hasPersistedData: isCustomMode ? true : stateRef.current.hasPersistedData,
      };
      dispatch({
        type: 'SETTINGS_UPDATED',
        nextSettings: latestSettings,
        status: 'ready',
        error: null,
        hasPersistedData: isCustomMode ? true : undefined,
      });

      onSaveSuccess?.();
    } catch (err) {
      normalizeAndPresentError(err, { context: 'useAutoSaveSettings.save', showToast: false });
      stateRef.current = {
        ...stateRef.current,
        status: 'error',
        error: err as Error,
      };
      dispatch({
        type: 'SETTINGS_UPDATED',
        status: 'error',
        error: err as Error,
      });
      onSaveError?.(err as Error);
      throw err;
    }
  }, [isCustomMode, updateSettings, scope, onSaveSuccess, onSaveError]);

  // Ref to hold latest saveImmediate to avoid effect dependency churn
  const saveImmediateRef = useRef(saveImmediate);
  saveImmediateRef.current = saveImmediate;

  const getLatestSettings = useCallback((): Promise<T> => {
    return Promise.resolve(stateRef.current.settings);
  }, []);

  // Debounced save sub-hook — manages scheduling, pending tracking, and flush effects
  const debouncedSave = useDebouncedSettingsSave<T>({
    entityId,
    debounceMs,
    status: state.status,
    isCustomMode,
    scope,
    toolId,
    projectId,
    customSaveRef,
    onFlushRef,
    saveImmediateRef,
    getLatestSettings,
  });

  const applyFieldUpdate = useCallback((updates: Partial<T>, shouldScheduleSave: boolean) => {
    const updated = { ...stateRef.current.settings, ...updates };
    stateRef.current = {
      ...stateRef.current,
      settings: updated,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      nextSettings: updated,
    });

    // Always track pending settings - this protects user input from being overwritten by DB load.
    debouncedSave.trackPendingUpdate(updated, stateRef.current.entityId);

    if (shouldScheduleSave) {
      // Schedule auto-save (no-ops during loading - just keeps pending tracking).
      debouncedSave.scheduleSave(stateRef.current.entityId);
    }
  }, [debouncedSave]);

  // Update single field without capturing entity-specific state in the callback closure.
  const updateField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    applyFieldUpdate({ [key]: value } as Partial<T>, true);
  }, [applyFieldUpdate]);

  // Update multiple fields at once without capturing entity-specific state in the callback closure.
  const updateFields = useCallback((updates: Partial<T>) => {
    applyFieldUpdate(updates, true);
  }, [applyFieldUpdate]);

  // Free-text fields update local state immediately but wait for explicit blur/generate/close flushes.
  const updateTextField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    applyFieldUpdate({ [key]: value } as Partial<T>, false);
  }, [applyFieldUpdate]);

  const updateTextFields = useCallback((updates: Partial<T>) => {
    applyFieldUpdate(updates, false);
  }, [applyFieldUpdate]);

  // Revert to last saved settings
  const revert = useCallback(() => {
    if (loadedSettingsRef.current) {
      stateRef.current = {
        ...stateRef.current,
        settings: loadedSettingsRef.current,
        error: null,
      };
      dispatch({
        type: 'SETTINGS_UPDATED',
        nextSettings: loadedSettingsRef.current,
        error: null,
      });
      debouncedSave.clearPending();
    }
  }, [debouncedSave]);

  // Manual save - flushes debounce immediately
  // Uses saveImmediateRef to avoid depending on saveImmediate directly
  const save = useCallback(async () => {
    debouncedSave.cancelPendingSave();
    await saveImmediateRef.current();
  }, [debouncedSave]);

  // Reset to defaults (or provided settings)
  const reset = useCallback((newDefaults?: T) => {
    const resetTo = JSON.parse(JSON.stringify(newDefaults || defaults)) as T;
    loadedSettingsRef.current = JSON.parse(JSON.stringify(resetTo));
    stateRef.current = {
      ...stateRef.current,
      settings: resetTo,
      error: null,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      nextSettings: resetTo,
      error: null,
    });
    debouncedSave.clearPending();
  }, [defaults, debouncedSave]);

  // Initialize from external source (e.g., "last used" settings) - custom mode only
  const initializeFrom = useCallback((data: Partial<T>) => {
    if (!isCustomMode) return;
    // Only apply if we don't have persisted data and aren't loading
    if (stateRef.current.hasPersistedData || isLoadingRef.current) {
      return;
    }

    const updated = { ...stateRef.current.settings, ...data };
    stateRef.current = {
      ...stateRef.current,
      settings: updated,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      nextSettings: updated,
    });
  }, [isCustomMode]);

  const transitionPendingLoadSave = useCallback(() => {
    transitionReadyWithPendingSave({
      markReady: () => {
        stateRef.current = {
          ...stateRef.current,
          status: 'ready',
          error: null,
        };
        dispatch({
          type: 'SETTINGS_UPDATED',
          nextSettings: stateRef.current.settings,
          status: 'ready',
          error: null,
        });
      },
      debouncedSave,
      saveImmediateRef,
      debounceMs,
    });
  }, [debouncedSave, saveImmediateRef, debounceMs]);

  const applyLoadedData = useCallback((data: T, hadPersistedData: boolean) => {
    const loadedState = applyLoadedDataState({
      data,
      hadPersistedData,
      isCustomMode,
    });
    loadedSettingsRef.current = loadedState.loadedSettings;
    isLoadingRef.current = false;
    stateRef.current = {
      ...stateRef.current,
      settings: loadedState.settings,
      status: loadedState.status,
      error: loadedState.error,
      hasPersistedData: loadedState.hasPersistedData,
    };
    dispatch({
      type: 'LOAD_RESOLVED',
      settings: loadedState.settings,
      hasPersistedData: loadedState.hasPersistedData,
    });
  }, [isCustomMode]);

  const startLoad = useCallback(() => {
    stateRef.current = {
      ...stateRef.current,
      status: 'loading',
      error: null,
    };
    dispatch({ type: 'LOAD_STARTED' });
  }, []);

  const setLoadError = useCallback((loadError: Error) => {
    stateRef.current = {
      ...stateRef.current,
      status: 'error',
      error: loadError,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      status: 'error',
      error: loadError,
    });
  }, []);

  const markReady = useCallback(() => {
    stateRef.current = {
      ...stateRef.current,
      status: 'ready',
      error: null,
    };
    dispatch({
      type: 'SETTINGS_UPDATED',
      nextSettings: stateRef.current.settings,
      status: 'ready',
      error: null,
    });
  }, []);

  // Load settings - custom mode (imperative async load)
  useCustomModeLoad({
    isCustomMode,
    entityId,
    enabled,
    status: state.status,
    defaults,
    debouncedSave,
    customLoadRef,
    stateRef,
    isLoadingRef,
    transitionReadyWithPendingSave: transitionPendingLoadSave,
    applyLoadedData,
    startLoad,
    setLoadError,
  });

  // Load settings - React Query mode (reactive from useToolSettings)
  useReactQueryModeLoad({
    isCustomMode,
    entityId,
    enabled,
    status: state.status,
    defaults,
    dbSettings,
    rqIsLoading,
    debouncedSave,
    loadedSettingsRef,
    transitionReadyWithPendingSave: transitionPendingLoadSave,
    applyLoadedData,
    startLoad,
    markReady,
  });

  // Memoize return value to prevent object recreation on every render.
  return useMemo(() => ({
    settings: state.settings,
    status: state.status,
    entityId: state.entityId,
    isDirty,
    error: state.error,
    hasShotSettings: isCustomMode ? state.hasPersistedData : hasShotSettings,
    hasPersistedData: isCustomMode ? state.hasPersistedData : hasShotSettings,
    updateField,
    updateFields,
    updateTextField,
    updateTextFields,
    save,
    saveImmediate,
    revert,
    reset,
    initializeFrom,
  }), [state.settings, state.status, state.entityId, state.error, state.hasPersistedData, isDirty, isCustomMode, hasShotSettings, updateField, updateFields, updateTextField, updateTextFields, save, saveImmediate, revert, reset, initializeFrom]);
}
