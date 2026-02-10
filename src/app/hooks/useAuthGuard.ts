import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

// Returns undefined while loading, null when unauthenticated, Session when authenticated
export function useAuthGuard() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const authManager = window.__AUTH_MANAGER__;
    let unsubscribe: (() => void) | null = null;

    if (authManager) {
      unsubscribe = authManager.subscribe('Layout', (_event, session) => {
        setSession(session);
      });
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      unsubscribe = () => subscription?.unsubscribe();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { session };
}
