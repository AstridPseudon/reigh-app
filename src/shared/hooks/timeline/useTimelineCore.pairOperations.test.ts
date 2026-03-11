import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationRow } from '@/domains/generation/types';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useTimelinePairOperations } from './useTimelineCore.pairOperations';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  normalizeAndPresentError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mocks.from(...args),
  }),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mocks.normalizeAndPresentError(...args),
}));

function createGeneration(overrides: Record<string, unknown>): GenerationRow {
  return {
    id: 'sg-default',
    timeline_frame: 0,
    metadata: {},
    ...overrides,
  } as unknown as GenerationRow;
}

describe('useTimelinePairOperations', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.update.mockReset();
    mocks.eq.mockReset();
    mocks.normalizeAndPresentError.mockReset();

    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockImplementation(() => ({
      eq: (...args: unknown[]) => mocks.eq(...args),
    }));
    mocks.from.mockImplementation(() => ({
      update: (...args: unknown[]) => mocks.update(...args),
    }));
  });

  it('derives pair prompts and segment overrides from positioned item metadata', () => {
    const invalidateGenerations = vi.fn();
    const queryClient = {
      invalidateQueries: vi.fn(),
    };
    const positionedItems = [
      createGeneration({
        id: 'sg-1',
        shotImageEntryId: 'sg-1',
        metadata: {
          segmentOverrides: {
            prompt: 'pair prompt',
            negativePrompt: 'pair negative',
            amountOfMotion: 25,
          },
        },
      }),
      createGeneration({
        id: 'sg-2',
        shotImageEntryId: 'sg-2',
        metadata: {},
      }),
    ];

    const { result } = renderHook(() => useTimelinePairOperations(
      'shot-1',
      positionedItems,
      invalidateGenerations,
      queryClient as never,
    ));

    expect(result.current.pairPrompts).toEqual({
      0: {
        prompt: 'pair prompt',
        negativePrompt: 'pair negative',
      },
    });
    expect(result.current.getSegmentOverrides(0)).toMatchObject({
      prompt: 'pair prompt',
      negativePrompt: 'pair negative',
      amountOfMotion: 25,
    });
    expect(result.current.getSegmentOverrides(5)).toEqual({});
  });

  it('updates pair prompts, merges existing overrides, and invalidates the pair metadata query', async () => {
    const invalidateGenerations = vi.fn();
    const queryClient = {
      invalidateQueries: vi.fn(),
    };
    const positionedItems = [
      createGeneration({
        id: 'sg-1',
        shotImageEntryId: 'sg-1',
        metadata: {
          segmentOverrides: {
            motionMode: 'basic',
          },
        },
      }),
      createGeneration({
        id: 'sg-2',
        shotImageEntryId: 'sg-2',
        metadata: {},
      }),
    ];

    const { result } = renderHook(() => useTimelinePairOperations(
      'shot-1',
      positionedItems,
      invalidateGenerations,
      queryClient as never,
    ));

    await act(async () => {
      await result.current.updatePairPrompts('sg-1', 'new prompt', 'new negative');
    });

    expect(mocks.from).toHaveBeenCalledWith('shot_generations');
    expect(mocks.update).toHaveBeenCalledWith({
      metadata: {
        segmentOverrides: {
          motionMode: 'basic',
          prompt: 'new prompt',
          negativePrompt: 'new negative',
        },
      },
    });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'sg-1');
    expect(invalidateGenerations).toHaveBeenCalledWith('shot-1', {
      reason: 'update-pair-prompts',
      scope: 'metadata',
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.segments.pairMetadata('sg-1'),
    });
  });

  it('updates segment overrides by pair index and preserves existing metadata', async () => {
    const invalidateGenerations = vi.fn();
    const queryClient = {
      invalidateQueries: vi.fn(),
    };
    const positionedItems = [
      createGeneration({
        id: 'sg-1',
        shotImageEntryId: 'sg-1',
        metadata: {
          segmentOverrides: {
            negativePrompt: 'existing negative',
          },
        },
      }),
      createGeneration({
        id: 'sg-2',
        shotImageEntryId: 'sg-2',
        metadata: {},
      }),
    ];

    const { result } = renderHook(() => useTimelinePairOperations(
      'shot-1',
      positionedItems,
      invalidateGenerations,
      queryClient as never,
    ));

    await act(async () => {
      await result.current.updateSegmentOverrides(0, {
        prompt: 'refined prompt',
        amountOfMotion: 40,
      });
    });

    expect(mocks.update).toHaveBeenCalledWith({
      metadata: {
        segmentOverrides: {
          negativePrompt: 'existing negative',
          prompt: 'refined prompt',
          amountOfMotion: 40,
        },
      },
    });
    expect(invalidateGenerations).toHaveBeenCalledWith('shot-1', {
      reason: 'update-segment-overrides',
      scope: 'metadata',
    });
  });

  it('normalizes and rethrows pair prompt update failures', async () => {
    const invalidateGenerations = vi.fn();
    const queryClient = {
      invalidateQueries: vi.fn(),
    };
    const originalError = new Error('db failure');
    const normalizedError = new Error('normalized pair failure');
    const positionedItems = [
      createGeneration({
        id: 'sg-1',
        shotImageEntryId: 'sg-1',
        metadata: {},
      }),
      createGeneration({
        id: 'sg-2',
        shotImageEntryId: 'sg-2',
        metadata: {},
      }),
    ];

    mocks.eq.mockResolvedValueOnce({ error: originalError });
    mocks.normalizeAndPresentError.mockReturnValue(normalizedError);

    const { result } = renderHook(() => useTimelinePairOperations(
      'shot-1',
      positionedItems,
      invalidateGenerations,
      queryClient as never,
    ));

    await expect(result.current.updatePairPrompts('sg-1', 'prompt', 'negative')).rejects.toBe(normalizedError);
    expect(mocks.normalizeAndPresentError).toHaveBeenCalledWith(originalError, {
      context: 'useTimelineCore.updatePairPrompts',
      toastTitle: 'Failed to update pair prompts',
      showToast: false,
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
