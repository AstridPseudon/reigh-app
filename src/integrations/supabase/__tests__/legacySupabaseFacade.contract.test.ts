import { describe, expect, it } from 'vitest';
import {
  getSupabaseClient,
} from '@/integrations/supabase/client';
describe('supabase client facade governance contract', () => {
  it('exposes only the supported browser-runtime accessors and no module-level supabase facade', async () => {
    const legacyModule = await import('@/integrations/supabase/client');

    expect(typeof legacyModule.initializeSupabase).toBe('function');
    expect(typeof legacyModule.initializeSupabaseResult).toBe('function');
    expect(typeof legacyModule.getSupabaseClientResult).toBe('function');
    expect(typeof legacyModule.getSupabaseClient).toBe('function');
    expect(getSupabaseClient).toBe(legacyModule.getSupabaseClient);
    expect(typeof legacyModule.supabaseClientRegistry).toBe('object');
    expect('supabase' in legacyModule).toBe(false);
    expect('getOrInitializeSupabaseClientResult' in legacyModule).toBe(false);
    expect('getLegacySupabaseImportBudget' in legacyModule).toBe(false);
  });

  it('keeps the registry aligned with the supported facade entrypoints', async () => {
    const legacyModule = await import('@/integrations/supabase/client');

    expect(legacyModule.supabaseClientRegistry).toEqual({
      initializeSupabase: legacyModule.initializeSupabase,
      initializeSupabaseResult: legacyModule.initializeSupabaseResult,
      getSupabaseClientResult: legacyModule.getSupabaseClientResult,
      getSupabaseClient: legacyModule.getSupabaseClient,
    });
  });
});
