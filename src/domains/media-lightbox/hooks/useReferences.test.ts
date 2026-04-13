import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReferences } from './useReferences';

const mocks = vi.hoisted(() => ({
  createResourceMutateAsync: vi.fn(),
  updateProjectImageSettings: vi.fn(),
  normalizeAndPresentError: vi.fn(),
}));

vi.mock('@/features/resources/hooks/useResources', () => ({
  useCreateResource: () => ({ mutateAsync: mocks.createResourceMutateAsync }),
}));

vi.mock('@/shared/hooks/settings/useToolSettings', () => ({
  useToolSettings: () => ({
    settings: {
      references: [],
      selectedReferenceIdByShot: {},
    },
    update: mocks.updateProjectImageSettings,
  }),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mocks.normalizeAndPresentError(...args),
}));

describe('useReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createResourceMutateAsync.mockResolvedValue({
      id: 'resource-1',
      type: 'style-reference',
      metadata: {},
    });
    mocks.updateProjectImageSettings.mockResolvedValue(undefined);
  });

  it('creates a reference resource using the underlying generation id instead of the shot_generation id', async () => {
    const media = {
      id: 'shot-generation-1',
      generation_id: 'generation-1',
      location: 'https://cdn.example.com/generated.png',
      thumbUrl: 'https://cdn.example.com/generated-thumb.png',
      type: 'image',
    } as import('@/domains/generation/types').GenerationRow;

    const { result } = renderHook(() =>
      useReferences({
        media,
        selectedProjectId: 'project-1',
        selectedShotId: 'shot-1',
        isVideo: false,
      }),
    );

    await act(async () => {
      await result.current.handleAddToReferences();
    });

    expect(mocks.createResourceMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      type: 'style-reference',
      generation_id: 'generation-1',
      metadata: expect.objectContaining({
        generationId: 'generation-1',
        styleReferenceImage: 'https://cdn.example.com/generated.png',
        thumbnailUrl: 'https://cdn.example.com/generated-thumb.png',
      }),
    }));
    expect(mocks.createResourceMutateAsync.mock.calls[0][0].generation_id).not.toBe('shot-generation-1');
    expect(mocks.updateProjectImageSettings).toHaveBeenCalledWith(
      'project',
      expect.objectContaining({
        references: [expect.objectContaining({ resourceId: 'resource-1' })],
        selectedReferenceIdByShot: { 'shot-1': expect.any(String), none: expect.any(String) },
      }),
    );
    expect(mocks.normalizeAndPresentError).not.toHaveBeenCalled();
  });
});
