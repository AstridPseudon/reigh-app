import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAuthStateManager } from '@/integrations/supabase/auth/AuthStateManager';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useAuthReferralFinalize } from './useAuthReferralFinalize';
import { getStorageItem, removeStorageItem } from './storage';
import { isStandaloneDisplayMode } from './displayMode';

interface UseHomeAuthSubscriptionOptions {
  setSession: (session: Session | null) => void;
  navigate: (path: string) => void;
  pathname: string;
}

export function useHomeAuthSubscription({
  setSession,
  navigate,
  pathname,
}: UseHomeAuthSubscriptionOptions): void {
  const finalizeReferral = useAuthReferralFinalize();

  useEffect(() => {
    const handleAuthChange = (event: string, session: Session | null) => {
      setSession(session);

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && isStandaloneDisplayMode()) {
        navigate('/tools');
        return;
      }

      if (event !== 'SIGNED_IN' || !session) {
        return;
      }

      const isHomePath = pathname === '/home' || pathname === '/';
      const oauthInProgress = getStorageItem(
        'oauthInProgress',
        'useHomeAuthSubscription.read.oauthInProgress',
      ) === 'true';

      if (oauthInProgress) {
        void (async () => {
          await finalizeReferral();
          removeStorageItem(
            'oauthInProgress',
            'useHomeAuthSubscription.clear.oauthInProgress',
          );
          navigate('/tools');
        })();
        return;
      }

      if (!isHomePath) {
        navigate('/tools');
      }
    };

    const authManager = getAuthStateManager();
    if (authManager) {
      return authManager.subscribe('HomePage', handleAuthChange);
    }

    const { data: listener } = getSupabaseClient().auth.onAuthStateChange(handleAuthChange);
    return () => listener.subscription.unsubscribe();
  }, [finalizeReferral, navigate, pathname, setSession]);
}
