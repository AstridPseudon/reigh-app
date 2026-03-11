import type { Json } from '@/integrations/supabase/jsonTypes';
import type { GenerationRow } from '@/domains/generation/types';
import type { GenerationRowDto } from '@/domains/generation/types/generationRowDto';

export function mapGenerationRowDtoToRow(
  dto: GenerationRowDto & { params?: Json | null },
): GenerationRow {
  return {
    id: dto.id,
    generation_id: dto.generation_id,
    location: dto.location ?? null,
    imageUrl: dto.location ?? undefined,
    thumbUrl: dto.thumbnail_url ?? dto.location ?? undefined,
    type: dto.type ?? null,
    createdAt: dto.createdAt ?? dto.created_at,
    metadata: dto.metadata ?? null,
    name: dto.name ?? null,
    timeline_frame: dto.timeline_frame ?? null,
    starred: dto.starred,
    based_on: dto.based_on ?? null,
    params: (dto.params ?? undefined) as GenerationRow['params'],
    parent_generation_id: dto.parent_generation_id ?? null,
    is_child: dto.is_child,
    child_order: dto.child_order ?? null,
    pair_shot_generation_id: dto.pair_shot_generation_id ?? null,
    primary_variant_id: dto.primary_variant_id ?? null,
    source_task_id: dto.source_task_id ?? null,
  };
}
