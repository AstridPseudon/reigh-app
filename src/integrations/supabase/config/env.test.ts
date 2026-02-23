import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('supabase env config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('loads required env vars and computes dev environment', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_APP_ENV', 'dev');

    const mod = await import('./env');

    expect(mod.getSupabaseUrl()).toBe('https://example.supabase.co');
    expect(mod.getSupabasePublishableKey()).toBe('anon-key');
    expect(mod.__IS_DEV_ENV__).toBe(true);
    expect(mod.__REALTIME_DOWN_FIX_ENABLED__).toBe(true);
  });

  it('throws when required supabase URL is missing on first access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    const mod = await import('./env');

    // Module loads without throwing — the throw happens on first getter call
    expect(() => mod.getSupabaseUrl()).toThrow(
      'Missing required Supabase environment variable: VITE_SUPABASE_URL'
    );
  });

  it('throws when required supabase anon key is missing on first access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const mod = await import('./env');

    expect(() => mod.getSupabasePublishableKey()).toThrow(
      'Missing required Supabase environment variable: VITE_SUPABASE_ANON_KEY'
    );
  });

  it('caches the value after first access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    const mod = await import('./env');

    const first = mod.getSupabaseUrl();
    const second = mod.getSupabaseUrl();
    expect(first).toBe(second);
    expect(first).toBe('https://example.supabase.co');
  });
});
