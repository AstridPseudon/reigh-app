import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockImplementation(() => ({
        eq: (...args: unknown[]) => mockEq(...args),
      })),
    }),
  },
}));

vi.mock('@/shared/lib/errorHandling/handleError', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/shared/lib/queryKeys/generations', () => ({
  generationQueryKeys: {
    lineageChain: (id: string) => ['generations', 'lineage', id],
    derived: (id: string) => ['generations', 'derived', id],
  },
}));

import { useLineageChain } from '../useLineageChain';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useLineageChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty chain and not loading when variantId is null', () => {
    const { result } = renderHook(
      () => useLineageChain(null),
      { wrapper: createWrapper() }
    );

    expect(result.current.chain).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasLineage).toBe(false);
  });

  it('fetches single variant (no lineage) correctly', async () => {
    mockEq
      .mockReturnValueOnce({
        single: (...args: unknown[]) => mockSingle(...args),
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'variant-1',
          generation_id: 'gen-1',
          params: {},
          location: 'https://example.com/v1.jpg',
          thumbnail_url: 'https://example.com/v1-thumb.jpg',
          created_at: '2024-01-01T00:00:00Z',
          variant_type: 'inpaint',
        }],
        error: null,
      });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'variant-1',
        generation_id: 'gen-1',
        params: {},
        location: 'https://example.com/v1.jpg',
        thumbnail_url: 'https://example.com/v1-thumb.jpg',
        created_at: '2024-01-01T00:00:00Z',
        variant_type: 'inpaint',
      },
      error: null,
    });

    const { result } = renderHook(
      () => useLineageChain('variant-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.chain).toHaveLength(1);
    expect(result.current.chain[0].id).toBe('variant-1');
    expect(result.current.hasLineage).toBe(false);
  });

  it('follows source_variant_id chain for lineage', async () => {
    mockEq
      .mockReturnValueOnce({
        single: (...args: unknown[]) => mockSingle(...args),
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'variant-2',
            generation_id: 'gen-1',
            params: { source_variant_id: 'variant-1' },
            location: 'https://example.com/v2.jpg',
            thumbnail_url: null,
            created_at: '2024-01-02T00:00:00Z',
            variant_type: 'outpaint',
          },
          {
            id: 'variant-1',
            generation_id: 'gen-1',
            params: {},
            location: 'https://example.com/v1.jpg',
            thumbnail_url: 'https://example.com/v1-thumb.jpg',
            created_at: '2024-01-01T00:00:00Z',
            variant_type: 'inpaint',
          },
        ],
        error: null,
      });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'variant-2',
        generation_id: 'gen-1',
        params: { source_variant_id: 'variant-1' },
        location: 'https://example.com/v2.jpg',
        thumbnail_url: null,
        created_at: '2024-01-02T00:00:00Z',
        variant_type: 'outpaint',
      },
      error: null,
    });

    const { result } = renderHook(
      () => useLineageChain('variant-2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.chain).toHaveLength(2);
    expect(result.current.chain[0].id).toBe('variant-1');
    expect(result.current.chain[1].id).toBe('variant-2');
    expect(result.current.hasLineage).toBe(true);
  });

  it('handles errors during fetch', async () => {
    mockEq.mockReturnValueOnce({
      single: (...args: unknown[]) => mockSingle(...args),
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const { result } = renderHook(
      () => useLineageChain('nonexistent'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.chain).toEqual([]);
    expect(result.current.hasLineage).toBe(false);
  });

  it('provides loading state while fetching', () => {
    mockEq.mockReturnValueOnce({
      single: () => new Promise(() => {}),
    });

    const { result } = renderHook(
      () => useLineageChain('variant-1'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
  });
});
