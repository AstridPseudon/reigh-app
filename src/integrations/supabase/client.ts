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
// Lazy singleton — no side-effects at import time.
//
// Previously this module called installWindowOnlyInstrumentation() and
// createSupabaseClient() at module scope, which meant importing this file
// immediately patched window.WebSocket, triggered auth, set window globals,
// and threw if env vars were missing.
//
// Now everything is deferred to the first call to getOrCreateSupabaseClient(),
// which happens when `supabase` is first accessed (still module scope of the
// *importer*, but only that importer — not every transitive import).
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

// Export the client directly from the function call.
// This avoids top-level variable declarations that cause HMR issues.
// The side-effects (instrumentation, client creation, runtime init) are
// deferred to this call rather than happening at bare import time.
export const supabase = getOrCreateSupabaseClient();
