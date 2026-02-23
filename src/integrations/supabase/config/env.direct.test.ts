import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
});

import * as envModule from './env';

describe('env module direct import', () => {
  it('exposes lazy getter functions for supabase constants', () => {
    expect(envModule.getSupabaseUrl()).toBe('https://example.supabase.co');
    expect(envModule.getSupabasePublishableKey()).toBe('anon-key');
  });
});
