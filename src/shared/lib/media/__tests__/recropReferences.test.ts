import { describe, it, expect, vi, beforeEach } from 'vitest';

import { operationSuccess } from '@/shared/lib/operationResult';
import type { HydratedReferenceImage } from '@/shared/types/referenceHydration';

const mocks = vi.hoisted(() => ({
  processStyleReferenceForAspectRatioString: vi.fn(),
  uploadImageToStorage: vi.fn(),
  dataURLtoFile: vi.fn(),
  generateClientThumbnail: vi.fn(),
  uploadImageWithThumbnail: vi.fn(),
  normalizeAndPresentError: vi.fn(),
}));

// Mock all external dependencies
vi.mock('../styleReferenceProcessor', () => ({
  processStyleReferenceForAspectRatioString: (...args: unknown[]) =>
    mocks.processStyleReferenceForAspectRatioString(...args),
}));

vi.mock('../imageUploader', () => ({
  uploadImageToStorage: (...args: unknown[]) => mocks.uploadImageToStorage(...args),
}));

vi.mock('../fileConversion', () => ({
  dataURLtoFile: (...args: unknown[]) => mocks.dataURLtoFile(...args),
}));

vi.mock('@/shared/media/clientThumbnailGenerator', () => ({
  generateClientThumbnail: (...args: unknown[]) => mocks.generateClientThumbnail(...args),
  uploadImageWithThumbnail: (...args: unknown[]) => mocks.uploadImageWithThumbnail(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      }),
    },
  }),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mocks.normalizeAndPresentError(...args),
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock FileReader
class MockFileReader {
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | null = null;

  readAsDataURL() {
    this.result = 'data:image/png;base64,original';
    setTimeout(() => this.onloadend?.(), 0);
  }
}
vi.stubGlobal('FileReader', MockFileReader);

import { recropAllReferences } from '../recropReferences';

describe('recropAllReferences', () => {
  const makeRef = (overrides: Partial<HydratedReferenceImage> = {}): HydratedReferenceImage => ({
    id: 'ref-1',
    resourceId: 'resource-1',
    generationId: 'generation-1',
    name: 'Test Reference',
    styleReferenceImage: 'https://storage.com/cropped.jpg',
    styleReferenceImageOriginal: 'https://storage.com/original.jpg',
    thumbnailUrl: 'https://storage.com/thumb.jpg',
    styleReferenceStrength: 0.5,
    subjectStrength: 0.5,
    subjectDescription: '',
    inThisScene: false,
    inThisSceneStrength: 0.4,
    referenceMode: 'style',
    styleBoostTerms: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    isPublic: false,
    isOwner: true,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processStyleReferenceForAspectRatioString.mockResolvedValue('data:image/png;base64,processed');
    mocks.uploadImageToStorage.mockResolvedValue('https://storage.com/uploaded.jpg');
    mocks.dataURLtoFile.mockReturnValue(
      operationSuccess(new File(['test'], 'test.png', { type: 'image/png' }))
    );
    mocks.generateClientThumbnail.mockResolvedValue({
      thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
      thumbnailWidth: 150,
      thumbnailHeight: 100,
      originalWidth: 1920,
      originalHeight: 1080,
    });
    mocks.uploadImageWithThumbnail.mockResolvedValue({
      imageUrl: 'https://storage.com/processed.jpg',
      thumbnailUrl: 'https://storage.com/thumb.jpg',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['image-data'], { type: 'image/png' })),
    });
  });

  it('returns empty array for empty input', async () => {
    const result = await recropAllReferences([], '16:9');
    expect(result).toEqual([]);
  });

  it('skips references without original image', async () => {
    const ref = makeRef({ styleReferenceImageOriginal: null });
    const onProgress = vi.fn();

    const result = await recropAllReferences([ref], '16:9', onProgress);

    expect(result).toEqual([]);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it('reprocesses references and returns resource-keyed recrop results', async () => {
    const ref = makeRef();
    const result = await recropAllReferences([ref], '16:9');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      resourceId: 'resource-1',
      generationId: 'generation-1',
      styleReferenceImage: 'https://storage.com/processed.jpg',
      thumbnailUrl: 'https://storage.com/thumb.jpg',
    }));
  });

  it('calls progress callback correctly', async () => {
    const refs = [makeRef({ id: 'ref-1' }), makeRef({ id: 'ref-2' })];
    const onProgress = vi.fn();

    await recropAllReferences(refs, '1:1', onProgress);

    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('drops failed references from the result set and reports the error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const ref = makeRef();
    const result = await recropAllReferences([ref], '16:9');

    expect(result).toEqual([]);
    expect(mocks.normalizeAndPresentError).toHaveBeenCalled();
  });
});
