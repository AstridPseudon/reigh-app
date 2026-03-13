import type { GenerationRow } from '@/domains/generation/types';
import type { Database } from '@/integrations/supabase/databasePublicTypes';
import { coerceGenerationRowDto, mapGenerationRowDtoToRow } from '@/domains/generation/mappers/generationRowMapper';
import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import {
  createRepositoryQueryError,
  createInvalidRowShapeError,
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

  const row = coerceGenerationRowDto(data);
  if (!row) {
    throw createInvalidRowShapeError('generation', { generationId });
  }

  return mapGenerationRowDtoToRow(row);
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
