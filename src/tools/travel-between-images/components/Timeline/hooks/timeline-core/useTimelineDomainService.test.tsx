// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationRow } from '@/domains/generation/types';

const mocks = vi.hoisted(() => ({
  filterTimelineEligiblePositionedImages: vi.fn((images: GenerationRow[]) => images),
  useTimelineCore: vi.fn(),
  useTimelinePositionUtils: vi.fn(),
  usePositionManagement: vi.fn(),
}));

vi.mock('@/shared/lib/timelineEligibility', () => ({
  filterTimelineEligiblePositionedImages: mocks.filterTimelineEligiblePositionedImages,
}));

vi.mock('@/shared/hooks/timeline/useTimelineCore', () => ({
  useTimelineCore: mocks.useTimelineCore,
}));

vi.mock('../../../../hooks/timeline/useTimelinePositionUtils', () => ({
  useTimelinePositionUtils: mocks.useTimelinePositionUtils,
}));

vi.mock('../usePositionManagement', () => ({
  usePositionManagement: mocks.usePositionManagement,
}));

import { useTimelineDomainService } from './useTimelineDomainService';

function createGeneration(
  id: string,
  timeline_frame: number | null,
  extra: Partial<GenerationRow> = {},
): GenerationRow {
  return {
    id,
    timeline_frame,
    ...extra,
  } as GenerationRow;
}

describe('useTimelineDomainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filterTimelineEligiblePositionedImages.mockImplementation((images: GenerationRow[]) => [...images]);
    mocks.useTimelineCore.mockReturnValue({
      positionedItems: [
        createGeneration('core-2', 20),
        createGeneration('core-1', 0),
      ],
      pairPrompts: { 1: { prompt: 'core', negativePrompt: 'none' } },
      refetch: vi.fn(),
    });
    mocks.useTimelinePositionUtils.mockReturnValue({
      pairPrompts: { 2: { prompt: 'utils', negativePrompt: 'none' } },
      loadPositions: vi.fn(),
    });
    mocks.usePositionManagement.mockReturnValue({
      positions: new Map([['img-1', 0]]),
      updatePositions: vi.fn(),
    });
  });

  it('uses prop-backed generations through the utils path and returns sorted images', () => {
    const propAllGenerations = [
      createGeneration('img-b', 10),
      createGeneration('img-a', 0),
      createGeneration('img-c', 10),
    ];

    const { result } = renderHook(() => useTimelineDomainService({
      shotId: 'shot-1',
      projectId: 'project-1',
      frameSpacing: 5,
      isDragInProgress: false,
      onFramePositionsChange: vi.fn(),
      propAllGenerations,
      readOnly: true,
    }));

    expect(mocks.useTimelineCore).toHaveBeenCalledWith(null);
    expect(mocks.useTimelinePositionUtils).toHaveBeenCalledWith({
      shotId: 'shot-1',
      generations: propAllGenerations,
      projectId: 'project-1',
    });
    expect(mocks.usePositionManagement).toHaveBeenCalledWith(expect.objectContaining({
      shotId: 'shot-1',
      shotGenerations: propAllGenerations,
      frameSpacing: 5,
      isDragInProgress: false,
    }));
    expect(result.current.shotGenerations).toEqual(propAllGenerations);
    expect(result.current.images.map((image) => image.id)).toEqual(['img-a', 'img-b', 'img-c']);
    expect(result.current.readOnlyGenerations).toEqual(propAllGenerations);
    expect(result.current.actualPairPrompts).toEqual({ 2: { prompt: 'utils', negativePrompt: 'none' } });
    expect(result.current.positions).toEqual(new Map([['img-1', 0]]));
    expect(result.current.updatePositions).toBe(mocks.usePositionManagement.mock.results[0]?.value.updatePositions);
    expect(result.current.loadPositions).toBe(mocks.useTimelinePositionUtils.mock.results[0]?.value.loadPositions);
  });

  it('falls back to timeline-core data and refetch-based loading when prop generations are absent', async () => {
    const coreRefetch = vi.fn();
    mocks.useTimelineCore.mockReturnValueOnce({
      positionedItems: [
        createGeneration('core-2', 20),
        createGeneration('core-1', 0),
      ],
      pairPrompts: { 1: { prompt: 'core', negativePrompt: 'none' } },
      refetch: coreRefetch,
    });

    const { result } = renderHook(() => useTimelineDomainService({
      shotId: 'shot-2',
      frameSpacing: 9,
      isDragInProgress: true,
      readOnly: false,
    }));

    expect(mocks.useTimelineCore).toHaveBeenCalledWith('shot-2');
    expect(mocks.useTimelinePositionUtils).toHaveBeenCalledWith({
      shotId: null,
      generations: [],
      projectId: undefined,
    });
    expect(result.current.shotGenerations.map((image) => image.id)).toEqual(['core-2', 'core-1']);
    expect(result.current.images.map((image) => image.id)).toEqual(['core-1', 'core-2']);
    expect(result.current.actualPairPrompts).toEqual({ 1: { prompt: 'core', negativePrompt: 'none' } });
    expect(result.current.readOnlyGenerations).toBeUndefined();

    await act(async () => {
      await result.current.loadPositions({ silent: true, reason: 'test' });
    });

    expect(coreRefetch).toHaveBeenCalledTimes(1);
  });
});
