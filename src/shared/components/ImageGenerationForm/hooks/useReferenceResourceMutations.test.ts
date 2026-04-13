import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReferenceResourceMutations } from './useReferenceResourceMutations';

const mocks = vi.hoisted(() => {
  function updateSettingsCacheDouble(
    prev: unknown,
    updater: Record<string, unknown> | ((prevSettings: Record<string, unknown>) => Record<string, unknown>),
  ) {
    const wrapper = Boolean(prev && typeof prev === 'object' && 'settings' in prev);
    const prevSettings = (
      wrapper
        ? ((prev as { settings?: Record<string, unknown> }).settings ?? {})
        : ((prev as Record<string, unknown> | undefined) ?? {})
    );
    const updates = typeof updater === 'function' ? updater(prevSettings) : updater;
    return {
      settings: { ...prevSettings, ...updates },
      hasShotSettings: wrapper ? Boolean((prev as { hasShotSettings?: boolean }).hasShotSettings) : false,
    };
  }

  return {
    updateResourceMutateAsync: vi.fn(),
    deleteResourceMutateAsync: vi.fn(),
    deleteGenerationMutateAsync: vi.fn(),
    maybeSingle: vi.fn(),
    invalidateShotsQueries: vi.fn(),
    normalizeAndPresentError: vi.fn(),
    updateSettingsCache: vi.fn(updateSettingsCacheDouble),
  };
});

vi.mock('@/features/resources/hooks/useResources', () => ({
  useUpdateResource: () => ({ mutateAsync: mocks.updateResourceMutateAsync }),
  useDeleteResource: () => ({ mutateAsync: mocks.deleteResourceMutateAsync }),
}));

vi.mock('@/domains/generation/hooks/useGenerationMutations', () => ({
  useDeleteGeneration: () => ({ mutateAsync: mocks.deleteGenerationMutateAsync }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => mocks.maybeSingle(...args),
        }),
      }),
    }),
  }),
}));

vi.mock('@/shared/hooks/settings/useToolSettings', () => ({
  updateSettingsCache: (...args: unknown[]) => mocks.updateSettingsCache(...args),
}));

vi.mock('@/shared/hooks/shots/cacheUtils', () => ({
  invalidateShotsQueries: (...args: unknown[]) => mocks.invalidateShotsQueries(...args),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mocks.normalizeAndPresentError(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

function buildHydratedReference() {
  return {
    id: 'ref-1',
    resourceId: 'resource-1',
    generationId: 'generation-1',
    name: 'Reference',
    styleReferenceImage: 'https://cdn.example.com/style.jpg',
    styleReferenceImageOriginal: 'https://cdn.example.com/original.jpg',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    styleReferenceStrength: 0.9,
    subjectStrength: 0.1,
    subjectDescription: '',
    inThisScene: false,
    inThisSceneStrength: 0.4,
    referenceMode: 'style' as const,
    styleBoostTerms: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isPublic: false,
    isOwner: true,
  };
}

describe('useReferenceResourceMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateResourceMutateAsync.mockResolvedValue(undefined);
    mocks.deleteResourceMutateAsync.mockResolvedValue(undefined);
    mocks.deleteGenerationMutateAsync.mockResolvedValue(undefined);
  });

  it('deletes the linked generation for uploaded-reference resources', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { type: 'uploaded-reference' },
      error: null,
    });

    const updateProjectImageSettings = vi.fn().mockResolvedValue(undefined);
    const markAsInteracted = vi.fn();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() =>
      useReferenceResourceMutations({
        selectedProjectId: 'project-1',
        referencePointers: [{ id: 'ref-1', resourceId: 'resource-1' }],
        hydratedReferences: [buildHydratedReference()],
        selectedReferenceIdByShot: { 'shot-1': 'ref-1' },
        updateProjectImageSettings,
        markAsInteracted,
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleDeleteReference('ref-1');
    });

    expect(mocks.deleteResourceMutateAsync).toHaveBeenCalledWith({
      id: 'resource-1',
      type: 'style-reference',
    });
    expect(mocks.deleteGenerationMutateAsync).toHaveBeenCalledWith({
      id: 'generation-1',
      projectId: 'project-1',
    });
    expect(mocks.invalidateShotsQueries).toHaveBeenCalledWith(expect.anything(), 'project-1');
    expect(updateProjectImageSettings).toHaveBeenCalledWith('project', {
      references: [],
      selectedReferenceIdByShot: { 'shot-1': null },
    });
    expect(markAsInteracted).toHaveBeenCalled();
  });

  it('leaves AI-generated references linked generation intact on delete', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { type: 'image' },
      error: null,
    });

    const updateProjectImageSettings = vi.fn().mockResolvedValue(undefined);
    const markAsInteracted = vi.fn();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() =>
      useReferenceResourceMutations({
        selectedProjectId: 'project-1',
        referencePointers: [{ id: 'ref-1', resourceId: 'resource-1' }],
        hydratedReferences: [buildHydratedReference()],
        selectedReferenceIdByShot: { 'shot-1': 'ref-1' },
        updateProjectImageSettings,
        markAsInteracted,
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleDeleteReference('ref-1');
    });

    expect(mocks.deleteResourceMutateAsync).toHaveBeenCalledWith({
      id: 'resource-1',
      type: 'style-reference',
    });
    expect(mocks.deleteGenerationMutateAsync).not.toHaveBeenCalled();
    expect(mocks.invalidateShotsQueries).not.toHaveBeenCalled();
    expect(updateProjectImageSettings).toHaveBeenCalledWith('project', {
      references: [],
      selectedReferenceIdByShot: { 'shot-1': null },
    });
  });
});
