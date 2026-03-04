import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchCurrentSession } from '@/integrations/supabase/repositories/homeAuthRepository';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { isStandaloneDisplayMode } from './displayMode';

interface UseStandaloneAuthRedirectOptions {
  setSession: (session: Session | null) => void;
  navigate: (to: string) => void;
}

export function useStandaloneAuthRedirect({
  setSession,
  navigate,
}: UseStandaloneAuthRedirectOptions): void {
  useEffect(() => {
    let cancelled = false;
    let delayedCheckTimer: ReturnType<typeof setTimeout> | null = null;

    const syncSessionAndRedirect = async () => {
      try {
        const { data, error } = await fetchCurrentSession();
        if (error) {
          throw error;
        }
        if (cancelled) {
          return;
        }

        const session = data.session;
        setSession(session);
        if (session && isStandaloneDisplayMode()) {
          navigate('/tools');
        }
      } catch (error) {
        normalizeAndPresentError(error, {
          context: 'useStandaloneAuthRedirect.syncSessionAndRedirect',
          showToast: false,
        });
      }
    };

    void syncSessionAndRedirect();

    if (isStandaloneDisplayMode()) {
      delayedCheckTimer = setTimeout(() => {
        void syncSessionAndRedirect();
      }, 500);
    }

    return () => {
      cancelled = true;
      if (delayedCheckTimer) {
        clearTimeout(delayedCheckTimer);
      }
    };
  }, [navigate, setSession]);
}
