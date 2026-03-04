import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useOAuthHashSessionRestore } from './auth/useOAuthHashSessionRestore';
import { useStandaloneAuthRedirect } from './auth/useStandaloneAuthRedirect';
import { useHomeAuthSubscription } from './auth/useHomeAuthSubscription';

export function useHomeAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Session restoration for OAuth hash redirects.
  useOAuthHashSessionRestore({ setSession });
  // Standalone/PWA auth bootstrap + redirect policy.
  useStandaloneAuthRedirect({ setSession, navigate });
  // Ongoing auth event subscription + post-signin side effects.
  useHomeAuthSubscription({
    setSession,
    navigate,
    pathname: location.pathname,
  });

  return { session };
}
