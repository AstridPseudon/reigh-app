import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/test-utils';

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'user-1' } } },
        })
      ),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  }),
}));

vi.mock('@/shared/lib/imageUploader', () => ({
  uploadImageToStorage: vi.fn().mockResolvedValue('uploaded.jpg'),
}));

vi.mock('@/shared/media/clientThumbnailGenerator', () => ({
  generateClientThumbnail: vi.fn().mockResolvedValue({
    thumbnailBlob: new Blob(),
    width: 300,
    height: 200,
  }),
  uploadImageWithThumbnail: vi.fn().mockResolvedValue({
    imageUrl: 'uploaded.jpg',
    thumbnailUrl: 'thumb.jpg',
  }),
}));

vi.mock('@/shared/lib/imageCropper', () => ({
  cropImageToProjectAspectRatio: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/lib/media/aspectRatios', () => ({
  parseRatio: vi.fn(() => 16 / 9),
}));

vi.mock('@/shared/hooks/invalidation/useGenerationInvalidation', () => ({
  enqueueGenerationsInvalidation: vi.fn(),
}));

vi.mock('../useShotsCrud', () => ({
  useCreateShot: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({
      shot: { id: 'new-shot-1', name: 'Shot 1' },
    }),
  })),
}));

vi.mock('../useShotGenerationMutations', () => ({
  useAddImageToShot: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    mutateAsyncWithoutPosition: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { useHandleExternalImageDrop } from '../useShotCreation';

describe('useHandleExternalImageDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { aspect_ratio: '16:9', settings: {} },
            error: null,
          }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'gen-new', location: 'uploaded.jpg' },
            error: null,
          }),
        })),
      })),
    });
  });

  it('returns a mutation', () => {
    const { result } = renderHookWithProviders(() =>
      useHandleExternalImageDrop()
    );

    expect(typeof result.current.mutateAsync).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('returns null when no project ID', async () => {
    const { result } = renderHookWithProviders(() =>
      useHandleExternalImageDrop()
    );

    let mutateResult: unknown;
    await act(async () => {
      mutateResult = await result.current.mutateAsync({
        imageFiles: [new File(['data'], 'test.jpg', { type: 'image/jpeg' })],
        targetShotId: 'shot-1',
        currentProjectQueryKey: null,
        currentShotCount: 0,
      });
    });

    expect(mutateResult).toBeNull();
  });
});
