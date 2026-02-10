import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useSettingsModal() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [settingsCreditsTab, setSettingsCreditsTab] = useState<'purchase' | 'history' | undefined>(undefined);
  const location = useLocation();

  const handleOpenSettings = useCallback((initialTab?: string, creditsTab?: 'purchase' | 'history') => {
    setSettingsInitialTab(initialTab);
    setSettingsCreditsTab(creditsTab);
    setIsSettingsModalOpen(true);
  }, []);

  // Check for settings navigation state
  useEffect(() => {
    const state = location.state as { openSettings?: boolean; settingsTab?: string; creditsTab?: 'purchase' | 'history' } | null;
    if (state?.openSettings) {
      handleOpenSettings(state.settingsTab, state.creditsTab);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleOpenSettings]);

  // Listen for settings open event from welcome modal
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { tab } = event.detail;
      setIsSettingsModalOpen(true);
      if (tab) {
        setSettingsInitialTab(tab);
      }
    };

    window.addEventListener('openSettings', handler as EventListener);
    return () => {
      window.removeEventListener('openSettings', handler as EventListener);
    };
  }, []);

  return {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settingsInitialTab,
    settingsCreditsTab,
    handleOpenSettings,
  };
}
