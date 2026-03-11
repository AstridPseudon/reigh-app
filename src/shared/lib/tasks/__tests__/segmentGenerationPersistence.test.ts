import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistSegmentEnhancedPrompt,
  resolveSegmentGenerationRoute,
} from '../segmentGenerationPersistence';

const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();
const mockNormalizeAndPresentError = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  }),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mockNormalizeAndPresentError(...args),
}));

describe('resolveSegmentGenerationRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseRpc.mockResolvedValue({ data: 'parent-from-shot', error: null });
  });

  it('keeps an explicitly provided child generation id', async () => {
    const result = await resolveSegmentGenerationRoute({
      projectId: 'project-1',
      parentGenerationId: 'parent-1',
      childGenerationId: 'child-1',
      context: 'segment-test',
    });

    expect(result).toEqual({
      parentGenerationId: 'parent-1',
      childGenerationId: 'child-1',
    });
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('looks up child generation by pair shot generation id first', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'child-by-pair' }, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await resolveSegmentGenerationRoute({
      projectId: 'project-1',
      parentGenerationId: 'parent-1',
      pairShotGenerationId: 'pair-1',
      segmentIndex: 2,
      context: 'segment-test',
    });

    expect(result).toEqual({
      parentGenerationId: 'parent-1',
      childGenerationId: 'child-by-pair',
    });
  });

  it('falls back to child order when pair id is absent', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'child-by-order' }, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await resolveSegmentGenerationRoute({
      projectId: 'project-1',
      parentGenerationId: 'parent-1',
      segmentIndex: 3,
      context: 'segment-test',
    });

    expect(result).toEqual({
      parentGenerationId: 'parent-1',
      childGenerationId: 'child-by-order',
    });
  });
});

describe('persistSegmentEnhancedPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when there is nothing to persist', async () => {
    await expect(
      persistSegmentEnhancedPrompt({
        pairShotGenerationId: 'pair-1',
        enhancedPrompt: 'same',
        promptToEnhance: 'same',
        basePrompt: 'base',
        context: 'segment-test',
      }),
    ).resolves.toBe(false);

    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('merges enhanced prompt metadata into shot_generations', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const single = vi.fn().mockResolvedValue({
      data: { metadata: { existing: true } },
      error: null,
    });
    const selectEq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq: selectEq });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'shot_generations') {
        return { select, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      persistSegmentEnhancedPrompt({
        pairShotGenerationId: 'pair-1',
        enhancedPrompt: 'enhanced prompt',
        promptToEnhance: 'base prompt',
        basePrompt: 'base prompt',
        context: 'segment-test',
      }),
    ).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith({
      metadata: {
        existing: true,
        enhanced_prompt: 'enhanced prompt',
        base_prompt_for_enhancement: 'base prompt',
      },
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'pair-1');
  });
});
