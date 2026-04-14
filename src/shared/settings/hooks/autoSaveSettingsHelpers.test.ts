import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLoadedDataState,
  resolveEntityChange,
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
    const markReady = vi.fn();
    const cancelPendingSave = vi.fn();
    const saveImmediate = vi.fn().mockResolvedValue(undefined);
    const pendingSettings = { prompt: 'updated', mode: 'advanced' };
    const debouncedSave = {
      cancelPendingSave,
      pendingSettingsRef: { current: pendingSettings },
      saveTimeoutRef: { current: null },
    };

    transitionReadyWithPendingSave({
      markReady,
      debouncedSave: debouncedSave as never,
      saveImmediateRef: { current: saveImmediate },
      debounceMs: 200,
    });

    expect(markReady).toHaveBeenCalledTimes(1);
    expect(cancelPendingSave).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);

    expect(saveImmediate).toHaveBeenCalledWith(pendingSettings);
  });

  it('applies loaded data by cloning it, updating refs, and only toggling persisted state in custom mode', () => {
    const input = { prompt: 'hello', nested: { mode: 'basic' } };
    const result = applyLoadedDataState({
      data: input,
      hadPersistedData: true,
      isCustomMode: true,
    });

    expect(result.settings).toEqual(input);
    expect(result.settings).not.toBe(input);
    expect(result.loadedSettings).toEqual(input);
    expect(result.loadedSettings).not.toBe(input);
    expect(result.hasPersistedData).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.error).toBeNull();
  });

  it('resets state when the entity is cleared', () => {
    const defaults = { prompt: 'default' };
    const result = resolveEntityChange({
      entityId: null,
      previousEntityId: 'entity-1',
      defaults,
      isCustomMode: false,
      rqIsLoading: false,
      dbSettings: undefined,
    });

    expect(result).toEqual({
      action: {
        entityId: null,
        settings: defaults,
        status: 'idle',
        hasPersistedData: false,
        error: null,
      },
      loadedSettings: null,
    });
  });

  it('hydrates ready state from react-query settings when switching between entities outside custom mode', () => {
    const defaults = { prompt: 'default', mode: 'basic' };
    const dbSettings = { mode: 'advanced' };
    const result = resolveEntityChange({
      entityId: 'entity-2',
      previousEntityId: 'entity-1',
      defaults,
      isCustomMode: false,
      rqIsLoading: false,
      dbSettings,
    });

    expect(result).toEqual({
      action: {
        entityId: 'entity-2',
        settings: { prompt: 'default', mode: 'advanced' },
        status: 'ready',
        hasPersistedData: false,
        error: null,
      },
      loadedSettings: { prompt: 'default', mode: 'advanced' },
    });
  });
});
