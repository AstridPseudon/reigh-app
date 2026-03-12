import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteExternalApiKey,
  fetchExternalApiKey,
  saveExternalApiKey,
} from './repository';

const mocks = vi.hoisted(() => ({
  requireUserFromSession: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mocks.from(...args),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  }),
}));

vi.mock('@/integrations/supabase/auth/ensureAuthenticatedSession', () => ({
  requireUserFromSession: (...args: unknown[]) => mocks.requireUserFromSession(...args),
}));

describe('externalApiKeys repository', () => {
  beforeEach(() => {
    mocks.requireUserFromSession.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.single.mockReset();
    mocks.rpc.mockReset();

    mocks.requireUserFromSession.mockResolvedValue({ id: 'user-1' });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.single.mockResolvedValue({ data: null, error: null });
    mocks.eq.mockReturnValue({
      eq: (...args: unknown[]) => mocks.eq(...args),
      maybeSingle: (...args: unknown[]) => mocks.maybeSingle(...args),
      single: (...args: unknown[]) => mocks.single(...args),
    });
    mocks.select.mockReturnValue({
      eq: (...args: unknown[]) => mocks.eq(...args),
    });
    mocks.from.mockReturnValue({
      select: (...args: unknown[]) => mocks.select(...args),
    });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('requires an authenticated user before fetching a stored key', async () => {
    mocks.requireUserFromSession.mockRejectedValueOnce(new Error('Not authenticated'));

    await expect(fetchExternalApiKey('openai')).rejects.toThrow('Not authenticated');
  });

  it('fetches the stored key record for the current user and service', async () => {
    const record = {
      id: 'key-1',
      service: 'openai',
      metadata: { label: 'primary' },
    };
    mocks.maybeSingle.mockResolvedValueOnce({ data: record, error: null });

    await expect(fetchExternalApiKey('openai')).resolves.toEqual(record);
    expect(mocks.from).toHaveBeenCalledWith('external_api_keys');
    expect(mocks.select).toHaveBeenCalledWith('id, service, metadata, created_at, updated_at');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eq).toHaveBeenCalledWith('service', 'openai');
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('saves a key through the RPC and refetches the persisted record', async () => {
    const record = {
      id: 'key-1',
      service: 'anthropic',
      metadata: { label: 'backup' },
    };
    mocks.single.mockResolvedValueOnce({ data: record, error: null });

    await expect(saveExternalApiKey('anthropic', 'secret', { label: 'backup' })).resolves.toEqual(record);
    expect(mocks.rpc).toHaveBeenCalledWith('save_external_api_key', {
      p_service: 'anthropic',
      p_key_value: 'secret',
      p_metadata: { label: 'backup' },
    });
    expect(mocks.single).toHaveBeenCalledTimes(1);
  });

  it('deletes a key through the delete RPC and propagates RPC failures', async () => {
    await deleteExternalApiKey('openai');
    expect(mocks.rpc).toHaveBeenCalledWith('delete_external_api_key', {
      p_service: 'openai',
    });

    const rpcError = new Error('delete failed');
    mocks.rpc.mockResolvedValueOnce({ error: rpcError });

    await expect(deleteExternalApiKey('openai')).rejects.toBe(rpcError);
  });

  it('requires an authenticated user before deleting a stored key', async () => {
    mocks.requireUserFromSession.mockRejectedValueOnce(new Error('Not authenticated'));

    await expect(deleteExternalApiKey('openai')).rejects.toThrow('Not authenticated');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
