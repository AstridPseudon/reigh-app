import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createExternalUploadGeneration,
  deleteGenerationInProject,
  deleteVariantInProject,
  updateGenerationLocationInProject,
  updateGenerationStarInProject,
} from './generationMutationsRepository';

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  resolveGenerationProjectScope: vi.fn(),
  resolveVariantProjectScope: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: (...args: unknown[]) => mocks.getSupabaseClient(...args),
}));

vi.mock('@/shared/lib/generationTaskRepository', () => ({
  resolveGenerationProjectScope: (...args: unknown[]) => mocks.resolveGenerationProjectScope(...args),
  resolveVariantProjectScope: (...args: unknown[]) => mocks.resolveVariantProjectScope(...args),
}));

describe('generationMutationsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveGenerationProjectScope.mockResolvedValue({
      generationId: 'g1',
      projectId: 'p1',
      status: 'ok',
    });
    mocks.resolveVariantProjectScope.mockResolvedValue({
      variantId: 'v1',
      generationId: 'g1',
      projectId: 'p1',
      status: 'ok',
    });
  });

  it('updates generation location scoped by generation and project id', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'g1' }], error: null });
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));
    mocks.getSupabaseClient.mockReturnValue({ from });

    await updateGenerationLocationInProject({
      id: 'g1',
      projectId: 'p1',
      location: 'https://cdn.example.com/new.png',
      thumbnailUrl: 'https://cdn.example.com/new-thumb.png',
    });

    expect(mocks.resolveGenerationProjectScope).toHaveBeenCalledWith('g1', 'p1');
    expect(from).toHaveBeenCalledWith('generations');
    expect(update).toHaveBeenCalledWith({
      location: 'https://cdn.example.com/new.png',
      thumbnail_url: 'https://cdn.example.com/new-thumb.png',
    });
    expect(firstEq).toHaveBeenCalledWith('id', 'g1');
    expect(secondEq).toHaveBeenCalledWith('project_id', 'p1');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('creates a generation and its primary variant through the repository boundary', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'g2' }, error: null });
    const select = vi.fn(() => ({ single }));
    const generationInsert = vi.fn(() => ({ select }));

    const variantInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string) => {
      if (table === 'generations') return { insert: generationInsert };
      if (table === 'generation_variants') return { insert: variantInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.getSupabaseClient.mockReturnValue({ from });

    const result = await createExternalUploadGeneration({
      imageUrl: 'https://cdn.example.com/original.png',
      thumbnailUrl: 'https://cdn.example.com/thumb.png',
      fileType: 'image',
      projectId: 'p2',
      generationParams: { prompt: 'hello' },
    });

    expect(result).toEqual({ id: 'g2' });
    expect(generationInsert).toHaveBeenCalledWith({
      location: 'https://cdn.example.com/original.png',
      thumbnail_url: 'https://cdn.example.com/thumb.png',
      type: 'image',
      project_id: 'p2',
      params: { prompt: 'hello' },
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledTimes(1);

    expect(variantInsert).toHaveBeenCalledWith({
      generation_id: 'g2',
      location: 'https://cdn.example.com/original.png',
      thumbnail_url: 'https://cdn.example.com/thumb.png',
      is_primary: true,
      variant_type: 'original',
      name: 'Original',
      params: { prompt: 'hello' },
    });
  });

  it('updates starred state and deletes a scoped generation', async () => {
    const selectStar = vi.fn().mockResolvedValue({ data: [{ id: 'g3', starred: true }], error: null });
    const eqStarProject = vi.fn(() => ({ select: selectStar }));
    const eqStarId = vi.fn(() => ({ eq: eqStarProject }));
    const update = vi.fn(() => ({ eq: eqStarId }));

    const selectDeleteGeneration = vi.fn().mockResolvedValue({ data: [{ id: 'g3' }], error: null });
    const eqDeleteGenProject = vi.fn(() => ({ select: selectDeleteGeneration }));
    const eqDeleteGenId = vi.fn(() => ({ eq: eqDeleteGenProject }));
    const deleteGeneration = vi.fn(() => ({ eq: eqDeleteGenId }));

    const from = vi.fn((table: string) => {
      if (table === 'generations') {
        return {
          update,
          delete: deleteGeneration,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.getSupabaseClient.mockReturnValue({ from });
    mocks.resolveGenerationProjectScope.mockResolvedValue({
      generationId: 'g3',
      projectId: 'p3',
      status: 'ok',
    });

    await updateGenerationStarInProject({ id: 'g3', projectId: 'p3', starred: true });
    await deleteGenerationInProject({ id: 'g3', projectId: 'p3' });

    expect(update).toHaveBeenCalledWith({ starred: true });
    expect(eqStarId).toHaveBeenCalledWith('id', 'g3');
    expect(eqStarProject).toHaveBeenCalledWith('project_id', 'p3');
    expect(selectStar).toHaveBeenCalledWith('id, starred');

    expect(deleteGeneration).toHaveBeenCalledTimes(1);
    expect(eqDeleteGenId).toHaveBeenCalledWith('id', 'g3');
    expect(eqDeleteGenProject).toHaveBeenCalledWith('project_id', 'p3');
    expect(selectDeleteGeneration).toHaveBeenCalledWith('id');
    expect(mocks.resolveGenerationProjectScope).toHaveBeenCalledWith('g3', 'p3');
  });

  it('deletes a variant using the resolved parent generation scope', async () => {
    const selectDeleteVariant = vi.fn().mockResolvedValue({ data: [{ id: 'v3' }], error: null });
    const eqDeleteVariantGeneration = vi.fn(() => ({ select: selectDeleteVariant }));
    const eqDeleteVariantId = vi.fn(() => ({ eq: eqDeleteVariantGeneration }));
    const deleteVariant = vi.fn(() => ({ eq: eqDeleteVariantId }));
    const from = vi.fn(() => ({
      delete: deleteVariant,
    }));

    mocks.getSupabaseClient.mockReturnValue({ from });
    mocks.resolveVariantProjectScope.mockResolvedValue({
      variantId: 'v3',
      generationId: 'g3',
      projectId: 'p3',
      status: 'ok',
    });

    await deleteVariantInProject({ id: 'v3', projectId: 'p3' });

    expect(mocks.resolveVariantProjectScope).toHaveBeenCalledWith('v3', 'p3');
    expect(from).toHaveBeenCalledWith('generation_variants');
    expect(deleteVariant).toHaveBeenCalledTimes(1);
    expect(eqDeleteVariantId).toHaveBeenCalledWith('id', 'v3');
    expect(eqDeleteVariantGeneration).toHaveBeenCalledWith('generation_id', 'g3');
    expect(selectDeleteVariant).toHaveBeenCalledWith('id');
  });

  it('rejects mutations when generation scope validation fails', async () => {
    mocks.resolveGenerationProjectScope.mockResolvedValue({
      generationId: 'g4',
      projectId: 'other-project',
      status: 'scope_mismatch',
    });

    await expect(
      updateGenerationLocationInProject({
        id: 'g4',
        projectId: 'p4',
        location: 'https://cdn.example.com/new.png',
      }),
    ).rejects.toThrow('Generation scope validation failed (scope_mismatch)');
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });
});
