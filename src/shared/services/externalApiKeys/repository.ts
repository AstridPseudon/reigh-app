import { getSupabaseClient } from '@/integrations/supabase/client';
import { requireUserFromSession } from '@/integrations/supabase/auth/ensureAuthenticatedSession';
import type {
  ExternalApiKey,
  ExternalApiKeyMetadata,
  ExternalService,
} from '@/shared/services/externalApiKeys/types';

const getSupabase = () => getSupabaseClient();

async function requireExternalApiKeyUser(context: string) {
  return requireUserFromSession(getSupabase(), context);
}

export async function fetchExternalApiKey(
  service: ExternalService
): Promise<ExternalApiKey | null> {
  const user = await requireExternalApiKeyUser('externalApiKeys.fetchExternalApiKey');

  const { data, error } = await getSupabase()
    .from('external_api_keys')
    .select('id, service, metadata, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('service', service)
    .maybeSingle();

  if (error) throw error;
  return data as ExternalApiKey | null;
}

export async function saveExternalApiKey(
  service: ExternalService,
  keyValue: string,
  metadata?: ExternalApiKeyMetadata
): Promise<ExternalApiKey> {
  const user = await requireExternalApiKeyUser('externalApiKeys.saveExternalApiKey');

  const { error } = await getSupabase().rpc('save_external_api_key', {
    p_service: service,
    p_key_value: keyValue,
    p_metadata: metadata || {},
  });
  if (error) throw error;

  const { data: record, error: fetchError } = await getSupabase()
    .from('external_api_keys')
    .select('id, service, metadata, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('service', service)
    .single();
  if (fetchError) throw fetchError;

  return record as ExternalApiKey;
}

export async function deleteExternalApiKey(service: ExternalService): Promise<void> {
  await requireExternalApiKeyUser('externalApiKeys.deleteExternalApiKey');
  const { error } = await getSupabase().rpc('delete_external_api_key', {
    p_service: service,
  });
  if (error) throw error;
}
