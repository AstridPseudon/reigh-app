// Centralized environment and feature flags for Supabase client/instrumentation

// ---------------------------------------------------------------------------
// Supabase configuration — lazy getters so importing this module never throws.
// The env vars are validated on first access (i.e. when the Supabase client is
// actually created), not at import time.  This avoids side-effects for modules
// that transitively import this file but never touch the URL/key (e.g. utility
// functions in taskCreation.ts that only need expandArrayToCount).
//
// MIGRATION: All call sites must use getSupabaseUrl() / getSupabasePublishableKey()
// instead of the old SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY constants.
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${name}`);
  }
  return value;
}

let _supabaseUrl: string | undefined;
/** Supabase project URL — throws on first access if VITE_SUPABASE_URL is missing. */
export function getSupabaseUrl(): string {
  return (_supabaseUrl ??= requireEnv('VITE_SUPABASE_URL'));
}

let _supabaseKey: string | undefined;
/** Supabase anon/publishable key — throws on first access if VITE_SUPABASE_ANON_KEY is missing. */
export function getSupabasePublishableKey(): string {
  return (_supabaseKey ??= requireEnv('VITE_SUPABASE_ANON_KEY'));
}

// Dev gating: enable heavy instrumentation only in dev/local
export const __IS_DEV_ENV__ = import.meta.env.VITE_APP_ENV === 'dev' || (typeof window !== 'undefined' && window.location?.hostname === 'localhost');
export const __WS_INSTRUMENTATION_ENABLED__ = true; // FORCE ENABLED to catch corruption
export const __REALTIME_DOWN_FIX_ENABLED__ = __IS_DEV_ENV__;
export const __CORRUPTION_TRACE_ENABLED__ = true; // FORCE ENABLED to catch corruption
