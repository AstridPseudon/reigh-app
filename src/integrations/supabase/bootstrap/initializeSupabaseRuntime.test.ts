import { describe, expect, it, vi } from 'vitest';
import { initializeSupabaseRuntime } from './initializeSupabaseRuntime';

const {
  initAuthStateManagerMock,
  initializeReconnectSchedulerMock,
  maybeAutoLoginMock,
} = vi.hoisted(() => ({
  initAuthStateManagerMock: vi.fn(),
  initializeReconnectSchedulerMock: vi.fn(),
  maybeAutoLoginMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/auth/AuthStateManager', () => ({
  initAuthStateManager: initAuthStateManagerMock,
}));

vi.mock('@/integrations/supabase/support/reconnect/ReconnectScheduler', () => ({
  initializeReconnectScheduler: initializeReconnectSchedulerMock,
}));

vi.mock('@/integrations/supabase/support/dev/autoLogin', () => ({
  maybeAutoLogin: maybeAutoLoginMock,
}));

describe('initializeSupabaseRuntime', () => {
  it('wires runtime subsystems in order', () => {
    const client = { id: 'client' } as never;

    initializeSupabaseRuntime(client);

    expect(initializeReconnectSchedulerMock).toHaveBeenCalledTimes(1);
    expect(initAuthStateManagerMock).toHaveBeenCalledWith(client);
    expect(maybeAutoLoginMock).toHaveBeenCalledWith(client);
  });
});
