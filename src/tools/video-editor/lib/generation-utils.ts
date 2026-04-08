/* eslint-disable no-restricted-imports */
import type { GenerationRow } from '@/domains/generation/types';
import type { Json } from '@/integrations/supabase/jsonTypes';
import { getSupabaseClient } from '@/integrations/supabase/client';

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function inferGenerationVariantType(type: string | null, location: string): 'image' | 'video' {
  if (type === 'video' || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(location)) {
    return 'video';
  }

  return 'image';
}

export interface DuplicatedGenerationAsset {
  generationId: string;
  variantId: string;
  variantType: 'image' | 'video';
  imageUrl: string;
  thumbUrl: string;
}

export async function duplicateGenerationAsset(params: {
  generationId: string;
  projectId: string;
}): Promise<DuplicatedGenerationAsset> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('generations')
    .select(`
      id,
      type,
      location,
      thumbnail_url,
      params,
      primary_variant:generation_variants!generations_primary_variant_id_fkey (
        id,
        location,
        thumbnail_url
      )
    `)
    .eq('id', params.generationId)
    .eq('project_id', params.projectId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to load generation for duplication');
  }

  const imageUrl = data.primary_variant?.location || data.location;
  if (!imageUrl) {
    throw new Error('Generation is missing a primary asset');
  }

  const thumbUrl = data.primary_variant?.thumbnail_url || data.thumbnail_url || imageUrl;
  const variantType = inferGenerationVariantType(data.type, imageUrl);
  const nextParams = {
    ...toRecord(data.params),
    source: 'video_editor_duplicate',
    source_generation_id: params.generationId,
    duplicated_at: new Date().toISOString(),
  };

  const { data: insertedGeneration, error: generationError } = await client
    .from('generations')
    .insert({
      project_id: params.projectId,
      type: variantType,
      based_on: params.generationId,
      location: imageUrl,
      thumbnail_url: thumbUrl,
      params: nextParams as Json,
    })
    .select('id')
    .single();

  if (generationError || !insertedGeneration?.id) {
    throw generationError ?? new Error('Failed to create duplicated generation');
  }

  const { data: insertedVariant, error: variantError } = await client
    .from('generation_variants')
    .insert({
      generation_id: insertedGeneration.id,
      project_id: params.projectId,
      location: imageUrl,
      thumbnail_url: thumbUrl,
      is_primary: true,
      variant_type: 'original',
      name: 'Original',
      params: nextParams as Json,
    })
    .select('id')
    .single();

  if (variantError || !insertedVariant?.id) {
    throw variantError ?? new Error('Failed to create duplicated generation variant');
  }

  return {
    generationId: insertedGeneration.id,
    variantId: insertedVariant.id,
    variantType,
    imageUrl,
    thumbUrl,
  };
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
