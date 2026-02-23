import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsModal } from './useSettingsModal';
import { dispatchAppEvent } from '@/shared/lib/typedEvents';

let locationState: unknown = null;

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: locationState }),
}));

describe('useSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState = null;
  });

  it('opens settings modal with explicit tab arguments', () => {
    const { result } = renderHook(() => useSettingsModal());

    act(() => {
      result.current.handleOpenSettings('profile', 'history');
    });

    expect(result.current.isSettingsModalOpen).toBe(true);
    expect(result.current.settingsInitialTab).toBe('profile');
    expect(result.current.settingsCreditsTab).toBe('history');
  });

  it('opens from route navigation state and clears history state', () => {
    locationState = {
      openSettings: true,
      settingsTab: 'api-keys',
      creditsTab: 'purchase',
    };
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);

    const { result } = renderHook(() => useSettingsModal());

    expect(result.current.isSettingsModalOpen).toBe(true);
    expect(result.current.settingsInitialTab).toBe('api-keys');
    expect(result.current.settingsCreditsTab).toBe('purchase');
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it('responds to openSettings custom event', () => {
    const { result } = renderHook(() => useSettingsModal());

    act(() => {
      dispatchAppEvent('openSettings', { tab: 'credits' });
    });

    expect(result.current.isSettingsModalOpen).toBe(true);
    expect(result.current.settingsInitialTab).toBe('credits');
  });
});
