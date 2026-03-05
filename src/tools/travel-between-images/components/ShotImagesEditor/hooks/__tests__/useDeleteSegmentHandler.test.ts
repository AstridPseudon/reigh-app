import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeleteSegmentHandler } from '../useDeleteSegmentHandler';

const { mockDeleteSegmentGenerationGroup, mockSyncSegmentDeletionCaches, mockNormalizeAndPresentError } = vi.hoisted(() => ({
  mockDeleteSegmentGenerationGroup: vi.fn(),
  mockSyncSegmentDeletionCaches: vi.fn(),
  mockNormalizeAndPresentError: vi.fn(),
}));

vi.mock('../../services/segmentDeletionService', () => ({
  deleteSegmentGenerationGroup: mockDeleteSegmentGenerationGroup,
  syncSegmentDeletionCaches: mockSyncSegmentDeletionCaches,
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: mockNormalizeAndPresentError,
}));

describe('useDeleteSegmentHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a fail-closed result when project scope is missing', async () => {
    const setDeletingSegmentId = vi.fn();
    const queryClient = {} as ReturnType<typeof import('@tanstack/react-query').useQueryClient>;
    const { result } = renderHook(() =>
      useDeleteSegmentHandler(queryClient, setDeletingSegmentId),
    );

    let operation:
      | Awaited<ReturnType<ReturnType<typeof useDeleteSegmentHandler>>>
      | undefined;

    await act(async () => {
      operation = await result.current('generation-1');
    });

    expect(operation).toBeDefined();
    expect(operation?.ok).toBe(false);
    if (operation?.ok === false) {
      expect(operation.errorCode).toBe('shot_editor_segment_delete_missing_project_scope');
      expect(operation.recoverable).toBe(false);
    }
    expect(setDeletingSegmentId).not.toHaveBeenCalled();
  });

  it('returns success without cache sync when segment was not deleted', async () => {
    mockDeleteSegmentGenerationGroup.mockResolvedValue({ deleted: false });
    const setDeletingSegmentId = vi.fn();
    const queryClient = { invalidateQueries: vi.fn() } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>;

    const { result } = renderHook(() =>
      useDeleteSegmentHandler(queryClient, setDeletingSegmentId, 'project-1'),
    );

    let operation:
      | Awaited<ReturnType<ReturnType<typeof useDeleteSegmentHandler>>>
      | undefined;

    await act(async () => {
      operation = await result.current('generation-2');
    });

    expect(operation?.ok).toBe(true);
    if (operation?.ok) {
      expect(operation.value).toEqual({ deleted: false });
    }
    expect(mockSyncSegmentDeletionCaches).not.toHaveBeenCalled();
    expect(setDeletingSegmentId).toHaveBeenCalledWith('generation-2');
    expect(setDeletingSegmentId).toHaveBeenLastCalledWith(null);
  });

  it('syncs caches when deletion succeeds', async () => {
    mockDeleteSegmentGenerationGroup.mockResolvedValue({
      deleted: true,
      parentGenerationId: 'parent-1',
      idsToDelete: ['generation-3', 'generation-4'],
    });
    mockSyncSegmentDeletionCaches.mockResolvedValue(undefined);

    const setDeletingSegmentId = vi.fn();
    const queryClient = { invalidateQueries: vi.fn() } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>;

    const { result } = renderHook(() =>
      useDeleteSegmentHandler(queryClient, setDeletingSegmentId, 'project-1'),
    );

    let operation:
      | Awaited<ReturnType<ReturnType<typeof useDeleteSegmentHandler>>>
      | undefined;

    await act(async () => {
      operation = await result.current('generation-3');
    });

    expect(operation?.ok).toBe(true);
    if (operation?.ok) {
      expect(operation.value).toEqual({ deleted: true });
    }
    expect(mockSyncSegmentDeletionCaches).toHaveBeenCalledWith({
      queryClient,
      projectId: 'project-1',
      parentGenerationId: 'parent-1',
      idsToDelete: ['generation-3', 'generation-4'],
    });
    expect(setDeletingSegmentId).toHaveBeenLastCalledWith(null);
  });

  it('returns structured failure and reports error when deletion throws', async () => {
    mockDeleteSegmentGenerationGroup.mockRejectedValue(new Error('delete failed'));
    const setDeletingSegmentId = vi.fn();
    const queryClient = {} as ReturnType<typeof import('@tanstack/react-query').useQueryClient>;

    const { result } = renderHook(() =>
      useDeleteSegmentHandler(queryClient, setDeletingSegmentId, 'project-1'),
    );

    let operation:
      | Awaited<ReturnType<ReturnType<typeof useDeleteSegmentHandler>>>
      | undefined;

    await act(async () => {
      operation = await result.current('generation-5');
    });

    expect(operation?.ok).toBe(false);
    if (operation?.ok === false) {
      expect(operation.errorCode).toBe('shot_editor_segment_delete_failed');
      expect(operation.recoverable).toBe(true);
    }
    expect(mockNormalizeAndPresentError).toHaveBeenCalled();
    expect(setDeletingSegmentId).toHaveBeenLastCalledWith(null);
  });
});
