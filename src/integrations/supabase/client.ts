import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { installWindowOnlyInstrumentation } from '@/integrations/supabase/instrumentation/window';
import { createSupabaseClient } from '@/integrations/supabase/bootstrap/createSupabaseClient';
import { initializeSupabaseRuntime } from '@/integrations/supabase/bootstrap/initializeSupabaseRuntime';

function registerSupabaseGlobals(client: ReturnType<typeof createClient<Database>>): void {
  if (typeof window === 'undefined') return;
  window.__supabase_client__ = client;
  window.supabase = client;
}

// ---------------------------------------------------------------------------
// Singleton client factory.
//
// `supabase` is still created eagerly at this module's import boundary.
// The factory keeps behavior centralized and HMR-safe (single instrumentation
// install, shared window client reuse), but importing this module does perform
// client initialization side effects.
// ---------------------------------------------------------------------------

let _instrumentationInstalled = false;

const getOrCreateSupabaseClient = (): ReturnType<typeof createClient<Database>> => {
  // Check if we already have a client from a previous module execution (HMR)
  if (typeof window !== 'undefined' && window.__supabase_client__) {
    return window.__supabase_client__ as ReturnType<typeof createClient<Database>>;
  }

  // Install window-only instrumentation once, before client creation.
  // Moved here from module scope so it only runs when a client is actually needed.
  if (!_instrumentationInstalled) {
    _instrumentationInstalled = true;
    installWindowOnlyInstrumentation();
  }

  const client = createSupabaseClient();

  // Store on window to reuse on HMR and for diagnostics
  registerSupabaseGlobals(client);

  initializeSupabaseRuntime(client);

  return client;
};

// Export an eager singleton from the factory.
// This keeps one initialization path while preserving existing import contract.
export const supabase = getOrCreateSupabaseClient();
