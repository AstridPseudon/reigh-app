import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mocks = vi.hoisted(() => ({
  useSpecificResources: vi.fn(),
  resourceState: {
    data: [] as unknown[],
    isLoading: false,
  },
}));

vi.mock('@/shared/hooks/useSpecificResources', () => ({
  useSpecificResources: (...args: unknown[]) => mocks.useSpecificResources(...args),
}));

vi.mock('@/shared/contexts/ProjectContext', () => ({
  useProjectIdentityContext: () => ({ userId: 'user-1' }),
}));

import { useHydratedReferences } from '../useHydratedReferences';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useHydratedReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resourceState.data = [];
    mocks.resourceState.isLoading = false;
    mocks.useSpecificResources.mockImplementation(() => mocks.resourceState);
  });

  it('returns empty array when referencePointers is undefined', () => {
    const { result } = renderHook(
      () => useHydratedReferences(undefined),
      { wrapper: createWrapper() }
    );

    expect(result.current.hydratedReferences).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasLegacyReferences).toBe(false);
  });

  it('returns empty array when referencePointers is empty', () => {
    const { result } = renderHook(
      () => useHydratedReferences([]),
      { wrapper: createWrapper() }
    );

    expect(result.current.hydratedReferences).toEqual([]);
    expect(result.current.hasLegacyReferences).toBe(false);
  });

  it('hydrates references from linked generation data when generation_id is present', () => {
    mocks.resourceState.data = [
      {
        id: 'resource-1',
        userId: 'user-1',
        user_id: 'user-1',
        generation_id: 'generation-1',
        generation: {
          id: 'generation-1',
          location: 'https://example.com/generated.jpg',
          thumbnail_url: 'https://example.com/generated-thumb.jpg',
          type: 'uploaded-reference',
        },
        metadata: {
          name: 'Test Style',
          styleReferenceImage: 'https://example.com/style.jpg',
          styleReferenceImageOriginal: 'https://example.com/style-original.jpg',
          thumbnailUrl: 'https://example.com/style-thumb.jpg',
          updatedAt: '2024-01-01T00:00:00Z',
          is_public: false,
          referenceMode: 'style',
          styleReferenceStrength: 1.1,
          subjectStrength: 0.0,
          subjectDescription: '',
          inThisScene: false,
          inThisSceneStrength: 1.0,
          styleBoostTerms: '',
        },
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const pointers = [
      {
        id: 'ref-1',
        resourceId: 'resource-1',
        name: 'Test Style',
        styleReferenceStrength: 0.8,
      },
    ];

    const { result } = renderHook(
      () => useHydratedReferences(pointers as unknown),
      { wrapper: createWrapper() }
    );

    expect(result.current.hydratedReferences).toHaveLength(1);
    const hydrated = result.current.hydratedReferences[0];
    expect(hydrated.resourceId).toBe('resource-1');
    expect(hydrated.generationId).toBe('generation-1');
    expect(hydrated.name).toBe('Test Style');
    expect(hydrated.styleReferenceImage).toBe('https://example.com/generated.jpg');
    expect(hydrated.styleReferenceImageOriginal).toBe('https://example.com/generated.jpg');
    expect(hydrated.thumbnailUrl).toBe('https://example.com/generated-thumb.jpg');
    // Pointer override for strength
    expect(hydrated.styleReferenceStrength).toBe(0.8);
    expect(hydrated.isOwner).toBe(true);
  });

  it('falls back to metadata-backed URLs when a resource is not generation-backed', () => {
    mocks.resourceState.data = [
      {
        id: 'resource-1',
        userId: 'user-1',
        user_id: 'user-1',
        generation_id: null,
        generation: null,
        metadata: {
          name: 'Metadata Style',
          generationId: 'legacy-generation',
          styleReferenceImage: 'https://example.com/style.jpg',
          styleReferenceImageOriginal: 'https://example.com/style-original.jpg',
          thumbnailUrl: 'https://example.com/style-thumb.jpg',
          updatedAt: '2024-01-01T00:00:00Z',
          is_public: false,
          referenceMode: 'style',
          styleReferenceStrength: 1.1,
          subjectStrength: 0.0,
          subjectDescription: '',
          inThisScene: false,
          inThisSceneStrength: 1.0,
          styleBoostTerms: '',
        },
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const pointers = [{ id: 'ref-1', resourceId: 'resource-1' }];

    const { result } = renderHook(
      () => useHydratedReferences(pointers as unknown),
      { wrapper: createWrapper() }
    );

    expect(result.current.hydratedReferences).toHaveLength(1);
    expect(result.current.hydratedReferences[0]).toEqual(expect.objectContaining({
      resourceId: 'resource-1',
      generationId: 'legacy-generation',
      styleReferenceImage: 'https://example.com/style.jpg',
      styleReferenceImageOriginal: 'https://example.com/style-original.jpg',
      thumbnailUrl: 'https://example.com/style-thumb.jpg',
    }));
  });

  it('detects legacy references (no resourceId)', () => {
    const pointers = [
      {
        id: 'ref-legacy',
        name: 'Legacy Ref',
        styleReferenceImage: 'https://example.com/legacy.jpg',
        styleReferenceImageOriginal: 'https://example.com/legacy-original.jpg',
      },
    ];

    const { result } = renderHook(
      () => useHydratedReferences(pointers as unknown),
      { wrapper: createWrapper() }
    );

    expect(result.current.hasLegacyReferences).toBe(true);
    expect(result.current.hydratedReferences).toHaveLength(1);
    expect(result.current.hydratedReferences[0].resourceId).toBe('');
  });

  it('filters out references whose resources are not found', () => {
    mocks.resourceState.data = [];

    const pointers = [
      {
        id: 'ref-missing',
        resourceId: 'resource-nonexistent',
        name: 'Missing',
      },
    ];

    const { result } = renderHook(
      () => useHydratedReferences(pointers as unknown),
      { wrapper: createWrapper() }
    );

    expect(result.current.hydratedReferences).toHaveLength(0);
    expect(result.current.hasLegacyReferences).toBe(false);
  });
});
