/** @publicContract Supabase browser runtime entrypoint. */

import {
  type SupabaseClientAccessResult,
  getSupabaseRuntimeClientResult,
  initializeSupabaseClientRuntime,
  normalizeSupabaseError,
} from '@/integrations/supabase/runtime/supabaseRuntime';

export type { SupabaseClientAccessResult };

/** Runtime bootstrap entrypoint for app startup. */
export function initializeSupabase() {
  return initializeSupabaseClientRuntime();
}

export interface SupabaseClientRegistry {
  initializeSupabase: typeof initializeSupabase;
  initializeSupabaseResult: typeof initializeSupabaseResult;
  getSupabaseClientResult: typeof getSupabaseClientResult;
  getSupabaseClient: typeof getSupabaseClient;
}

export function initializeSupabaseResult(): SupabaseClientAccessResult {
  try {
    const client = initializeSupabase();
    return { ok: true, client };
  } catch (error) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }
}

/** Pure runtime accessor that never throws and never bootstraps. */
export function getSupabaseClientResult(): SupabaseClientAccessResult {
  const result = getSupabaseRuntimeClientResult();
  return result.ok ? result : { ok: false, error: normalizeSupabaseError(result.error) };
}

/** Runtime accessor for initialized app runtime. Throws if bootstrap has not run. */
export function getSupabaseClient() {
  const result = getSupabaseClientResult();
  if (!result.ok) {
    throw result.error;
  }
  return result.client;
}

export const supabaseClientRegistry: SupabaseClientRegistry = {
  initializeSupabase,
  initializeSupabaseResult,
  getSupabaseClientResult,
  getSupabaseClient,
};
