import { useState, useEffect, useCallback } from 'react';
import { handleError } from '@/shared/lib/errorHandler';

interface LocalPreferences {
  videoSoundEnabled: boolean;
}

const LOCAL_PREFERENCES_KEY = 'reigh_local_preferences';

const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
  videoSoundEnabled: true, // Default to sound ON
};

/**
 * Hook for managing device-local preferences stored in localStorage.
 * These do NOT sync across devices - use useUserSettings for cross-device settings.
 *
 * Examples of local preferences:
 * - Sound on/off (different per device)
 * - Panel collapsed states
 * - Window positions
 */
export function useLocalPreferences() {
  const [preferences, setPreferences] = useState<LocalPreferences>(() => {
    try {
      // Try new key first, fall back to old key for migration
      let stored = localStorage.getItem(LOCAL_PREFERENCES_KEY);
      if (!stored) {
        // Migration: check old key
        stored = localStorage.getItem('reigh_user_preferences');
        if (stored) {
          // Migrate to new key
          localStorage.setItem(LOCAL_PREFERENCES_KEY, stored);
          localStorage.removeItem('reigh_user_preferences');
        }
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_LOCAL_PREFERENCES, ...parsed };
      }
    } catch (error) {
      handleError(error, { context: 'useLocalPreferences.load', showToast: false });
    }
    return DEFAULT_LOCAL_PREFERENCES;
  });

  // Save to localStorage whenever preferences change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      handleError(error, { context: 'useLocalPreferences.save', showToast: false });
    }
  }, [preferences]);

  const updatePreferences = useCallback((updates: Partial<LocalPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  }, []);

  const setVideoSoundEnabled = useCallback((enabled: boolean) => {
    updatePreferences({ videoSoundEnabled: enabled });
  }, [updatePreferences]);

  return {
    preferences,
    updatePreferences,
    setVideoSoundEnabled,
  };
}
