import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/integrations/supabase/client';

export function setSessionFromTokens(accessToken: string, refreshToken: string) {
  return getSupabaseClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

export function fetchCurrentSession() {
  return getSupabaseClient().auth.getSession();
}

export function subscribeToAuthStateChanges(
  handler: (event: string, session: Session | null) => void,
): () => void {
  const { data: listener } = getSupabaseClient().auth.onAuthStateChange(handler);
  return () => listener.subscription.unsubscribe();
}

function rpcCreateReferralFromSession(sessionId: string, fingerprint: string) {
  return getSupabaseClient().rpc('create_referral_from_session', {
    p_session_id: sessionId,
    p_fingerprint: fingerprint,
  });
}
