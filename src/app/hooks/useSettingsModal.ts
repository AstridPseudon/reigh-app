import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppEventListener } from '@/shared/lib/typedEvents';

type SettingsCreditsTab = 'purchase' | 'history';

interface SettingsLocationState {
  openSettings?: boolean;
  settingsTab?: string;
  creditsTab?: SettingsCreditsTab;
}

function parseSettingsLocationState(state: unknown): SettingsLocationState | null {
  if (!state || typeof state !== 'object') return null;
  const record = state as Record<string, unknown>;
  const creditsTab = record.creditsTab === 'purchase' || record.creditsTab === 'history'
    ? record.creditsTab
    : undefined;

  return {
    openSettings: record.openSettings === true,
    settingsTab: typeof record.settingsTab === 'string' ? record.settingsTab : undefined,
    creditsTab,
  };
}

export function useSettingsModal() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [settingsCreditsTab, setSettingsCreditsTab] = useState<SettingsCreditsTab | undefined>(undefined);
  const location = useLocation();

  const handleOpenSettings = useCallback((initialTab?: string, creditsTab?: SettingsCreditsTab) => {
    setSettingsInitialTab(initialTab);
    setSettingsCreditsTab(creditsTab);
    setIsSettingsModalOpen(true);
  }, []);

  // Check for settings navigation state
  useEffect(() => {
    const state = parseSettingsLocationState(location.state);
    if (state?.openSettings) {
      handleOpenSettings(state.settingsTab, state.creditsTab);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleOpenSettings]);

  // Listen for settings open event from welcome modal
  useAppEventListener('openSettings', useCallback(({ tab }) => {
    setIsSettingsModalOpen(true);
    if (tab) {
      setSettingsInitialTab(tab);
    }
  }, []));

  return {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settingsInitialTab,
    settingsCreditsTab,
    handleOpenSettings,
  };
}
