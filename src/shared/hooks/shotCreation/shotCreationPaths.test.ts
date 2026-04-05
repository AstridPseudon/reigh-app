import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyAtomicShotCacheUpdate: vi.fn(),
  enqueueGenerationsInvalidation: vi.fn(),
  insertAutoPositionedShotGeneration: vi.fn(),
}));

vi.mock('./shotCacheUpdate', () => ({
  applyAtomicShotCacheUpdate: (...args: unknown[]) => mocks.applyAtomicShotCacheUpdate(...args),
}));

vi.mock('@/shared/hooks/invalidation/useGenerationInvalidation', () => ({
  enqueueGenerationsInvalidation: (...args: unknown[]) => mocks.enqueueGenerationsInvalidation(...args),
}));

vi.mock('@/shared/hooks/shots/addImageToShotHelpers', () => ({
  insertAutoPositionedShotGeneration: (...args: unknown[]) =>
    mocks.insertAutoPositionedShotGeneration(...args),
}));

import {
  createEmptyShotPath,
  createShotWithFilesPath,
  createShotWithGenerationPath,
  createShotWithGenerationsPath,
} from './shotCreationPaths';

describe('shotCreationPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a shot from an existing generation and updates the optimistic cache', async () => {
    const createShotWithImage = vi.fn().mockResolvedValue({
      shotId: 'shot-1',
      shotName: 'Shot 1',
      shotGenerationId: 'shot-gen-1',
    });

    const result = await createShotWithGenerationPath({
      selectedProjectId: 'project-1',
      shotName: 'Seed Shot',
      generationId: 'generation-1',
      generationPreview: { imageUrl: 'preview.png' },
      shots: [{ id: 'shot-0' }] as never,
      queryClient: { id: 'query-client' } as never,
      createShotWithImage,
    });

    expect(createShotWithImage).toHaveBeenCalledWith({
      projectId: 'project-1',
      shotName: 'Seed Shot',
      generationId: 'generation-1',
    });
    expect(mocks.applyAtomicShotCacheUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedProjectId: 'project-1',
        shotId: 'shot-1',
        shotName: 'Shot 1',
        shotGenerationId: 'shot-gen-1',
        generationId: 'generation-1',
      }),
    );
    expect(result).toEqual({
      shotId: 'shot-1',
      shotName: 'Shot 1',
      generationIds: ['generation-1'],
    });
  });

  it('creates a shot from uploaded files and returns uploaded generation ids', async () => {
    const createShot = vi.fn().mockResolvedValue({
      shot: { id: 'shot-2', name: 'Uploads' },
    });
    const uploadToShot = vi.fn().mockResolvedValue({
      shotId: 'shot-2',
      generationIds: ['gen-a', 'gen-b'],
    });
    const onProgress = vi.fn();
    const files = [new File(['a'], 'a.png', { type: 'image/png' })];

    const result = await createShotWithFilesPath({
      selectedProjectId: 'project-1',
      shotName: 'Uploads',
      files,
      aspectRatio: '16:9',
      shots: [{ id: 'shot-0' }] as never,
      onProgress,
      createShot,
      uploadToShot,
    });

    expect(createShot).toHaveBeenCalledWith({
      name: 'Uploads',
      projectId: 'project-1',
      aspectRatio: '16:9',
      shouldSelectAfterCreation: false,
    });
    expect(uploadToShot).toHaveBeenCalledWith({
      imageFiles: files,
      targetShotId: 'shot-2',
      currentProjectQueryKey: 'project-1',
      currentShotCount: 1,
      onProgress,
    });
    expect(result).toEqual({
      shotId: 'shot-2',
      shotName: 'Uploads',
      shot: { id: 'shot-2', name: 'Uploads' },
      generationIds: ['gen-a', 'gen-b'],
    });
  });

  it('creates a shot from multiple generations in order and invalidates the shot caches once', async () => {
    const createShot = vi.fn().mockResolvedValue({
      shot: { id: 'shot-3', name: 'Shot 3' },
    });

    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    mocks.insertAutoPositionedShotGeneration
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = () => resolve({});
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = () => resolve({});
      }));

    const pendingResult = createShotWithGenerationsPath({
      selectedProjectId: 'project-1',
      shotName: 'Shot 3',
      generationIds: ['gen-1', 'gen-2'],
      shots: [{ id: 'shot-0' }] as never,
      queryClient: { id: 'query-client' } as never,
      createShot,
    });
    await Promise.resolve();

    expect(createShot).toHaveBeenCalledWith({
      name: 'Shot 3',
      projectId: 'project-1',
      shouldSelectAfterCreation: false,
    });
    expect(mocks.insertAutoPositionedShotGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.insertAutoPositionedShotGeneration).toHaveBeenNthCalledWith(1, 'shot-3', 'gen-1');

    resolveFirst?.();
    await Promise.resolve();

    expect(mocks.insertAutoPositionedShotGeneration).toHaveBeenCalledTimes(2);
    expect(mocks.insertAutoPositionedShotGeneration).toHaveBeenNthCalledWith(2, 'shot-3', 'gen-2');

    resolveSecond?.();

    await expect(pendingResult).resolves.toEqual({
      shotId: 'shot-3',
      shotName: 'Shot 3',
      shot: { id: 'shot-3', name: 'Shot 3' },
      generationIds: ['gen-1', 'gen-2'],
    });
    expect(mocks.enqueueGenerationsInvalidation).toHaveBeenCalledWith(
      { id: 'query-client' },
      'shot-3',
      expect.objectContaining({
        reason: 'create-shot-with-generations',
        includeShots: true,
        includeProjectUnified: true,
        projectId: 'project-1',
      }),
    );
  });

  it('throws when createShot does not return a usable shot id', async () => {
    const createShot = vi.fn().mockResolvedValue({ shot: undefined });

    await expect(
      createEmptyShotPath({
        selectedProjectId: 'project-1',
        shotName: 'Empty Shot',
        createShot,
      }),
    ).rejects.toThrow('Shot creation failed - no ID returned');
  });
});
