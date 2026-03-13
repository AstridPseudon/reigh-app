import { describe, expect, it, vi } from 'vitest';

interface ClientModuleHandles {
  getSupabaseRuntimeClientResult: ReturnType<typeof vi.fn>;
  initializeSupabaseClientRuntime: ReturnType<typeof vi.fn>;
  module: typeof import('@/integrations/supabase/client');
}

async function loadClientModule(options?: {
  runtimeResult?: ReturnType<typeof vi.fn>;
  initializeImpl?: () => unknown;
}): Promise<ClientModuleHandles> {
  vi.resetModules();
  const getSupabaseRuntimeClientResult = vi.fn(
    options?.runtimeResult ?? (() => ({ ok: false, error: new Error('not initialized') })),
  );
  const initializeSupabaseClientRuntime = vi.fn(options?.initializeImpl ?? (() => ({ id: 'client' })));

  vi.doMock('@/integrations/supabase/runtime/supabaseRuntime', () => ({
    getSupabaseRuntimeClientResult,
    initializeSupabaseClientRuntime,
    normalizeSupabaseError: (error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
  }));

  const module = await import('@/integrations/supabase/client');
  return { getSupabaseRuntimeClientResult, initializeSupabaseClientRuntime, module };
}

describe('supabase client facade behavior', () => {
  it('keeps getSupabaseClientResult as a pure post-bootstrap accessor', async () => {
    const { module, getSupabaseRuntimeClientResult, initializeSupabaseClientRuntime } =
      await loadClientModule();

    const result = module.getSupabaseClientResult();

    expect(result.ok).toBe(false);
    expect(getSupabaseRuntimeClientResult).toHaveBeenCalledTimes(1);
    expect(initializeSupabaseClientRuntime).not.toHaveBeenCalled();
  });

  it('throws from getSupabaseClient when bootstrap has not run', async () => {
    const { module, initializeSupabaseClientRuntime } = await loadClientModule();

    expect(() => module.getSupabaseClient()).toThrow('not initialized');
    expect(initializeSupabaseClientRuntime).not.toHaveBeenCalled();
  });

  it('exports the governed registry over the supported browser-runtime entrypoints', async () => {
    const client = { id: 'client' };
    const { module } = await loadClientModule({
      runtimeResult: vi.fn(() => ({ ok: true as const, client })),
      initializeImpl: () => client,
    });

    expect(module.supabaseClientRegistry.initializeSupabase).toBe(module.initializeSupabase);
    expect(module.supabaseClientRegistry.initializeSupabaseResult).toBe(module.initializeSupabaseResult);
    expect(module.supabaseClientRegistry.getSupabaseClientResult).toBe(module.getSupabaseClientResult);
    expect(module.supabaseClientRegistry.getSupabaseClient).toBe(module.getSupabaseClient);
  });
});
