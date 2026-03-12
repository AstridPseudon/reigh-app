import { getSupabaseClient } from '@/integrations/supabase/client';

type SettingsScopeIdentifier = 'user' | 'project' | 'shot';
type SettingsScopeTableName = 'users' | 'projects' | 'shots';

const SETTINGS_SCOPE_TABLES: Record<SettingsScopeIdentifier, SettingsScopeTableName> = {
  user: 'users',
  project: 'projects',
  shot: 'shots',
};

function assertNeverScope(scope: never): never {
  throw new Error(`Unsupported settings scope: ${String(scope)}`);
}

export function resolveSettingsScopeTable(scope: SettingsScopeIdentifier): SettingsScopeTableName {
  switch (scope) {
    case 'user':
    case 'project':
    case 'shot':
      return SETTINGS_SCOPE_TABLES[scope];
    default:
      return assertNeverScope(scope);
  }
}

export function selectSettingsForScope(scope: SettingsScopeIdentifier, id: string) {
  const tableName = resolveSettingsScopeTable(scope);
  return getSupabaseClient()
    .from(tableName)
    .select('settings')
    .eq('id', id)
    .single();
}

export function callUpdateToolSettingsAtomicRpc(
  tableName: SettingsScopeTableName,
  id: string,
  toolId: string,
  settings: Record<string, unknown>,
) {
  return getSupabaseClient().rpc('update_tool_settings_atomic', {
    p_table_name: tableName,
    p_id: id,
    p_tool_id: toolId,
    p_settings: settings,
  });
}
