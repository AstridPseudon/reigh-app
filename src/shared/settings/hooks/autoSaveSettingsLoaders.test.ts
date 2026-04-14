// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCustomModeLoad,
  useReactQueryModeLoad,
} from './autoSaveSettingsLoaders';

const normalizeAndPresentErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => normalizeAndPresentErrorMock(...args),
}));

describe('autoSaveSettingsLoaders', () => {
  beforeEach(() => {
    normalizeAndPresentErrorMock.mockReset();
  });

  it('short-circuits custom mode loads when pending edits already exist for the entity', () => {
    const transitionReadyWithPendingSave = vi.fn();
    const customLoad = vi.fn();

    renderHook(() => useCustomModeLoad({
      isCustomMode: true,
      entityId: 'entity-1',
      enabled: true,
      status: 'idle',
      defaults: { prompt: 'default' },
      debouncedSave: {
        hasPendingFor: vi.fn().mockReturnValue(true),
      } as never,
      customLoadRef: { current: customLoad },
      stateRef: { current: { entityId: 'entity-1', settings: { prompt: 'default' }, hasPersistedData: false } },
      isLoadingRef: { current: false },
      transitionReadyWithPendingSave,
      applyLoadedData: vi.fn(),
      startLoad: vi.fn(),
      setLoadError: vi.fn(),
    }));

    expect(transitionReadyWithPendingSave).toHaveBeenCalledTimes(1);
    expect(customLoad).not.toHaveBeenCalled();
  });

  it('loads custom-mode settings, merges defaults, and applies them when the entity is still current', async () => {
    const applyLoadedData = vi.fn();
    const startLoad = vi.fn();
    const setError = vi.fn();
    const currentEntityIdRef = { current: 'entity-1' };
    const isLoadingRef = { current: false };
    const customLoad = vi.fn().mockResolvedValue({ mode: 'advanced' });

    renderHook(() => useCustomModeLoad({
      isCustomMode: true,
      entityId: 'entity-1',
      enabled: true,
      status: 'idle',
      defaults: { prompt: 'default', mode: 'basic' },
      debouncedSave: {
        hasPendingFor: vi.fn().mockReturnValue(false),
      } as never,
      customLoadRef: { current: customLoad },
      stateRef: { current: { entityId: currentEntityIdRef.current, settings: { prompt: 'default', mode: 'basic' }, hasPersistedData: false } },
      isLoadingRef,
      transitionReadyWithPendingSave: vi.fn(),
      applyLoadedData,
      startLoad,
      setLoadError: setError,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(startLoad).toHaveBeenCalledTimes(1);
    expect(customLoad).toHaveBeenCalledWith('entity-1');
    expect(applyLoadedData).toHaveBeenCalledWith(
      { prompt: 'default', mode: 'advanced' },
      true,
    );
    expect(isLoadingRef.current).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('reports custom-mode load failures and transitions into error state', async () => {
    const error = new Error('load failed');
    const setError = vi.fn();
    const isLoadingRef = { current: false };

    renderHook(() => useCustomModeLoad({
      isCustomMode: true,
      entityId: 'entity-1',
      enabled: true,
      status: 'idle',
      defaults: { prompt: 'default' },
      debouncedSave: {
        hasPendingFor: vi.fn().mockReturnValue(false),
      } as never,
      customLoadRef: { current: vi.fn().mockRejectedValue(error) },
      stateRef: { current: { entityId: 'entity-1', settings: { prompt: 'default' }, hasPersistedData: false } },
      isLoadingRef,
      transitionReadyWithPendingSave: vi.fn(),
      applyLoadedData: vi.fn(),
      startLoad: vi.fn(),
      setLoadError: setError,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(normalizeAndPresentErrorMock).toHaveBeenCalledWith(error, {
      context: 'useAutoSaveSettings.load',
      showToast: false,
    });
    expect(setError).toHaveBeenCalledWith(error);
    expect(isLoadingRef.current).toBe(false);
  });

  it('hydrates react-query mode settings and avoids resetting identical snapshots', () => {
    const setSettings = vi.fn();
    const setStatus = vi.fn();
    const setError = vi.fn();
    const loadedSettingsRef = {
      current: { prompt: 'default', mode: 'advanced' },
    };

    const { rerender } = renderHook((dbSettings: { mode: string } | undefined) => useReactQueryModeLoad({
      isCustomMode: false,
      entityId: 'entity-1',
      enabled: true,
      status: 'idle',
      defaults: { prompt: 'default', mode: 'basic' },
      dbSettings,
      rqIsLoading: false,
      debouncedSave: {
        hasPendingFor: vi.fn().mockReturnValue(false),
      } as never,
      loadedSettingsRef,
      transitionReadyWithPendingSave: vi.fn(),
      applyLoadedData: (data) => {
        setSettings(data);
        loadedSettingsRef.current = JSON.parse(JSON.stringify(data));
        setError(null);
      },
      startLoad: vi.fn(),
      markReady: () => setStatus('ready'),
    }), {
      initialProps: { mode: 'advanced' },
    });

    expect(setStatus).toHaveBeenCalledWith('ready');
    expect(setSettings).not.toHaveBeenCalled();

    rerender({ mode: 'expert' });

    expect(setSettings).toHaveBeenCalledWith({ prompt: 'default', mode: 'expert' });
    expect(loadedSettingsRef.current).toEqual({ prompt: 'default', mode: 'expert' });
    expect(setError).toHaveBeenCalledWith(null);
  });
});
