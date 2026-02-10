import { useEffect, useState } from 'react';
import { VisibilityManager, type VisibilitySignals, type VisibilityEventType } from '@/shared/lib/VisibilityManager';

/**
 * Hook to track page visibility and provide debugging for polling issues
 * This helps understand when polling might be paused due to background state
 * 
 * Now uses centralized VisibilityManager to prevent duplicate listeners
 */
export function usePageVisibility() {
  const [state, setState] = useState(() => {
    const initialState = VisibilityManager.getState();
    return {
      isVisible: initialState.isVisible,
      visibilityChangeCount: initialState.changeCount,
      lastVisibilityChange: new Date(initialState.lastVisibilityChangeAt),
    };
  });

  useEffect(() => {
    // Subscribe to VisibilityManager instead of direct DOM events
    const subscriptionId = VisibilityManager.subscribe((signals: VisibilitySignals, eventType: VisibilityEventType) => {
      if (eventType === 'visibilitychange') {
        const now = new Date(signals.lastVisibilityChangeAt);

        // Update state
        setState(() => ({
          isVisible: signals.isVisible,
          visibilityChangeCount: signals.changeCount,
          lastVisibilityChange: now,
        }));

      }
    }, {
      id: 'use-page-visibility',
      eventTypes: ['visibilitychange'],
      includeNoChange: false // Only get actual changes
    });

    return () => {
      VisibilityManager.unsubscribe(subscriptionId);
    };
  }, []);

  return state;
}
