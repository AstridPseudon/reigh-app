/* eslint-disable no-restricted-imports */
import type { GenerationRow } from '@/domains/generation/types';
import { getSupabaseClient } from '@/integrations/supabase/client';

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function loadGenerationForLightbox(generationId: string): Promise<GenerationRow | null> {
  const { data, error } = await getSupabaseClient()
    .from('generations')
    .select(`
      id,
      location,
      thumbnail_url,
      type,
      created_at,
      starred,
      name,
      based_on,
      params,
      primary_variant_id,
      primary_variant:generation_variants!generations_primary_variant_id_fkey (
        location,
        thumbnail_url
      )
    `)
    .eq('id', generationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }

    throw error;
  }

  const location = data.primary_variant?.location || data.location;
  if (!location) {
    return null;
  }

  return {
    id: data.id,
    generation_id: data.id,
    location,
    imageUrl: location,
    thumbUrl: data.primary_variant?.thumbnail_url || data.thumbnail_url || location,
    type: data.type || 'image',
    createdAt: data.created_at,
    starred: data.starred || false,
    name: data.name,
    based_on: data.based_on,
    params: toRecord(data.params),
    primary_variant_id: data.primary_variant_id || null,
  };
}
