import type { GenerationRow } from '@/domains/generation/types';
import type { Database } from '@/integrations/supabase/databasePublicTypes';
import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import {
  createRepositoryQueryError,
  isRepositoryNoRowsError,
} from './repositoryErrors';

type GenerationRecord = Database['public']['Tables']['generations']['Row'] & Record<string, unknown>;

export async function fetchGenerationById(generationId: string): Promise<GenerationRow | null> {
  const { data, error } = await supabase().from('generations')
    .select('*')
    .eq('id', generationId)
    .maybeSingle();

  if (error) {
    if (isRepositoryNoRowsError(error)) {
      return null;
    }
    throw createRepositoryQueryError('generation', error, { generationId });
  }

  if (!data) {
    return null;
  }

  return data as GenerationRow;
}

export async function fetchGenerationRecordById(generationId: string): Promise<GenerationRecord | null> {
  const { data, error } = await supabase().from('generations')
    .select('*')
    .eq('id', generationId)
    .maybeSingle();

  if (error) {
    if (isRepositoryNoRowsError(error)) {
      return null;
    }
    throw createRepositoryQueryError('generation record', error, { generationId });
  }

  if (!data) {
    return null;
  }

  return data as GenerationRecord;
}
