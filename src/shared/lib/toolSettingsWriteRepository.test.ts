import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callUpdateToolSettingsAtomicRpc,
  resolveSettingsScopeTable,
  selectSettingsForScope,
} from './toolSettingsWriteRepository';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mocks.from(...args),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  }),
}));

describe('toolSettingsWriteRepository', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.single.mockReset();
    mocks.rpc.mockReset();

    mocks.single.mockReturnValue({ data: { settings: {} }, error: null });
    mocks.eq.mockReturnValue({ single: (...args: unknown[]) => mocks.single(...args) });
    mocks.select.mockReturnValue({ eq: (...args: unknown[]) => mocks.eq(...args) });
    mocks.from.mockReturnValue({ select: (...args: unknown[]) => mocks.select(...args) });
    mocks.rpc.mockReturnValue({ data: null, error: null });
  });

  it('maps scope identifiers to the expected backing tables', () => {
    expect(resolveSettingsScopeTable('user')).toBe('users');
    expect(resolveSettingsScopeTable('project')).toBe('projects');
    expect(resolveSettingsScopeTable('shot')).toBe('shots');
  });

  it('selects settings for the resolved scope table and entity id', () => {
    const result = selectSettingsForScope('project', 'project-1');

    expect(mocks.from).toHaveBeenCalledWith('projects');
    expect(mocks.select).toHaveBeenCalledWith('settings');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'project-1');
    expect(mocks.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: { settings: {} }, error: null });
  });

  it('calls the atomic update RPC with the expected payload shape', () => {
    const settings = { enabled: true };

    const result = callUpdateToolSettingsAtomicRpc('shots', 'shot-1', 'timeline', settings);

    expect(mocks.rpc).toHaveBeenCalledWith('update_tool_settings_atomic', {
      p_table_name: 'shots',
      p_id: 'shot-1',
      p_tool_id: 'timeline',
      p_settings: settings,
    });
    expect(result).toEqual({ data: null, error: null });
  });
});
