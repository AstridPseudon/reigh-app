import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/databasePublicTypes';
import { initAuthStateManager } from '@/integrations/supabase/auth/AuthStateManager';
import { initializeReconnectScheduler } from '@/integrations/supabase/support/reconnect/ReconnectScheduler';
import { maybeAutoLogin } from '@/integrations/supabase/support/dev/autoLogin';

export function initializeSupabaseRuntime(
  client: ReturnType<typeof createClient<Database>>,
): void {
  // Shared runtime wiring after client construction.
  initializeReconnectScheduler();
  initAuthStateManager(client);
  maybeAutoLogin(client);
}
