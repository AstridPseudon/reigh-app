import { getSupabaseClient } from '@/integrations/supabase/client';
import {
  createInvalidRowShapeError,
  createRepositoryQueryError,
  isRepositoryNoRowsError,
} from './repositoryErrors';

interface PresetResourceRecord<TMetadata = unknown> {
  id: string;
  metadata: TMetadata;
}

function isPresetResourceRecord(value: unknown): value is PresetResourceRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { id?: unknown };
  return typeof candidate.id === 'string' && 'metadata' in candidate;
}

export async function fetchPresetResourceById<TMetadata = unknown>(
  presetId: string,
): Promise<PresetResourceRecord<TMetadata> | null> {
  const { data, error } = await getSupabaseClient()
    .from('resources')
    .select('*')
    .eq('id', presetId)
    .maybeSingle();

  if (error) {
    if (isRepositoryNoRowsError(error)) {
      return null;
    }
    throw createRepositoryQueryError('preset resource', error, { presetId });
  }

  if (!data) {
    return null;
  }
  if (!isPresetResourceRecord(data)) {
    throw createInvalidRowShapeError('preset resource', { presetId });
  }

  return data as PresetResourceRecord<TMetadata>;
}
