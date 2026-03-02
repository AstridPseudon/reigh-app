import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockUseDeleteGeneration, mockMutateAsync, mockNormalizeAndPresentError } = vi.hoisted(() => ({
  mockUseDeleteGeneration: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockNormalizeAndPresentError: vi.fn(),
}));

vi.mock('@/domains/generation/hooks/useGenerationMutations', () => ({
  useDeleteGeneration: () => mockUseDeleteGeneration(),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mockNormalizeAndPresentError(...args),
}));

import { useDeleteGenerationAction } from '@/domains/generation/hooks/useDeleteGenerationAction';

describe('useDeleteGenerationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteGeneration.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it('sets pendingDeleteId when requestDelete is called', () => {
    const { result } = renderHook(() => useDeleteGenerationAction({ projectId: 'project-1' }));

    act(() => {
      result.current.requestDelete('gen-1');
    });

    expect(result.current.pendingDeleteId).toBe('gen-1');
  });

  it('confirms delete and clears pending/deleting state on success', async () => {
    const { result } = renderHook(() => useDeleteGenerationAction({ projectId: 'project-1' }));

    act(() => {
      result.current.requestDelete('gen-1');
    });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'gen-1', projectId: 'project-1' });
    expect(result.current.pendingDeleteId).toBeNull();
    expect(result.current.deletingId).toBeNull();
  });

  it('keeps dialog pending state on failed delete so users can retry/cancel', async () => {
    mockMutateAsync.mockRejectedValue(new Error('delete failed'));
    const { result } = renderHook(() => useDeleteGenerationAction({ projectId: 'project-1' }));

    act(() => {
      result.current.requestDelete('gen-1');
    });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(result.current.pendingDeleteId).toBe('gen-1');
    expect(result.current.deletingId).toBeNull();
    expect(mockNormalizeAndPresentError).toHaveBeenCalledTimes(1);
  });

  it('uses the latest requested id across repeated delete requests', async () => {
    const { result } = renderHook(() => useDeleteGenerationAction({ projectId: 'project-1' }));

    act(() => {
      result.current.requestDelete('gen-1');
      result.current.requestDelete('gen-2');
    });

    expect(result.current.pendingDeleteId).toBe('gen-2');

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'gen-2', projectId: 'project-1' });
    expect(result.current.pendingDeleteId).toBeNull();
    expect(result.current.deletingId).toBeNull();
  });

  it('cancels pending delete when project scope is missing', async () => {
    const { result } = renderHook(() => useDeleteGenerationAction({ projectId: null }));

    act(() => {
      result.current.requestDelete('gen-1');
    });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(result.current.pendingDeleteId).toBeNull();
  });
});
