import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyEntityChangeState,
  applyLoadedDataState,
  transitionReadyWithPendingSave,
} from './autoSaveSettingsHelpers';

describe('autoSaveSettingsHelpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('transitions to ready and flushes the pending save after the debounce window', async () => {
    const setStatus = vi.fn();
    const cancelPendingSave = vi.fn();
    const saveImmediate = vi.fn().mockResolvedValue(undefined);
    const pendingSettings = { prompt: 'updated', mode: 'advanced' };
    const debouncedSave = {
      cancelPendingSave,
      pendingSettingsRef: { current: pendingSettings },
      saveTimeoutRef: { current: null },
    };

    transitionReadyWithPendingSave({
      setStatus,
      debouncedSave: debouncedSave as never,
      saveImmediateRef: { current: saveImmediate },
      debounceMs: 200,
    });

    expect(setStatus).toHaveBeenCalledWith('ready');
    expect(cancelPendingSave).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);

    expect(saveImmediate).toHaveBeenCalledWith(pendingSettings);
  });

  it('applies loaded data by cloning it, updating refs, and only toggling persisted state in custom mode', () => {
    const input = { prompt: 'hello', nested: { mode: 'basic' } };
    const setSettings = vi.fn();
    const setHasPersistedData = vi.fn();
    const setStatus = vi.fn();
    const setError = vi.fn();
    const loadedSettingsRef = { current: null as typeof input | null };

    applyLoadedDataState({
      data: input,
      hadPersistedData: true,
      isCustomMode: true,
      setSettings,
      loadedSettingsRef,
      setHasPersistedData,
      setStatus,
      setError,
    });

    const stored = setSettings.mock.calls[0][0];
    expect(stored).toEqual(input);
    expect(stored).not.toBe(input);
    expect(loadedSettingsRef.current).toEqual(input);
    expect(loadedSettingsRef.current).not.toBe(input);
    expect(setHasPersistedData).toHaveBeenCalledWith(true);
    expect(setStatus).toHaveBeenCalledWith('ready');
    expect(setError).toHaveBeenCalledWith(null);
  });

  it('resets state when the entity is cleared', () => {
    const defaults = { prompt: 'default' };
    const setSettings = vi.fn();
    const setStatus = vi.fn();
    const setHasPersistedData = vi.fn();
    const setError = vi.fn();
    const currentEntityIdRef = { current: 'entity-1' };
    const loadedSettingsRef = { current: { prompt: 'loaded' } };

    applyEntityChangeState({
      entityId: null,
      previousEntityId: 'entity-1',
      currentEntityIdRef,
      defaults,
      isCustomMode: false,
      rqIsLoading: false,
      dbSettings: undefined,
      setSettings,
      setStatus,
      setHasPersistedData,
      loadedSettingsRef,
      setError,
    });

    expect(currentEntityIdRef.current).toBeNull();
    expect(setSettings).toHaveBeenCalledWith(defaults);
    expect(setStatus).toHaveBeenCalledWith('idle');
    expect(setHasPersistedData).toHaveBeenCalledWith(false);
    expect(loadedSettingsRef.current).toBeNull();
    expect(setError).not.toHaveBeenCalled();
  });

  it('hydrates ready state from react-query settings when switching between entities outside custom mode', () => {
    const defaults = { prompt: 'default', mode: 'basic' };
    const dbSettings = { mode: 'advanced' };
    const setSettings = vi.fn();
    const setStatus = vi.fn();
    const setHasPersistedData = vi.fn();
    const setError = vi.fn();
    const currentEntityIdRef = { current: 'entity-1' };
    const loadedSettingsRef = { current: null as typeof defaults | null };

    applyEntityChangeState({
      entityId: 'entity-2',
      previousEntityId: 'entity-1',
      currentEntityIdRef,
      defaults,
      isCustomMode: false,
      rqIsLoading: false,
      dbSettings,
      setSettings,
      setStatus,
      setHasPersistedData,
      loadedSettingsRef,
      setError,
    });

    expect(setHasPersistedData).toHaveBeenCalledWith(false);
    expect(setSettings).toHaveBeenCalledWith({ prompt: 'default', mode: 'advanced' });
    expect(loadedSettingsRef.current).toEqual({ prompt: 'default', mode: 'advanced' });
    expect(setStatus).toHaveBeenCalledWith('ready');
    expect(setError).toHaveBeenCalledWith(null);
  });
});
