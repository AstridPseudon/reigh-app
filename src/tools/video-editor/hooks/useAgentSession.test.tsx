// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSendMessage } from './useAgentSession';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    functions: {
      invoke: invokeMock,
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useSendMessage', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        session_id: 'session-1',
        status: 'waiting_user',
        turns_added: 1,
      },
      error: null,
    });
  });

  it('includes optional generation and shot metadata only for attachments that provide it', async () => {
    const { result } = renderHook(
      () => useSendMessage('session-1', 'timeline-1'),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync({
        message: 'Use these as references',
        attachments: [
          {
            clipId: 'clip-1',
            url: 'https://example.com/image.png',
            mediaType: 'image',
            generationId: 'gen-1',
            shotId: 'shot-1',
            shotName: 'Hero Shot',
            shotSelectionClipCount: 4,
          },
          {
            clipId: 'clip-2',
            url: 'https://example.com/video.mp4',
            mediaType: 'video',
          },
        ],
      });
    });

    expect(invokeMock).toHaveBeenCalledWith('ai-timeline-agent', {
      body: {
        session_id: 'session-1',
        user_message: 'Use these as references',
        selected_clips: [
          {
            clip_id: 'clip-1',
            url: 'https://example.com/image.png',
            media_type: 'image',
            generation_id: 'gen-1',
            shot_id: 'shot-1',
            shot_name: 'Hero Shot',
            shot_selection_clip_count: 4,
          },
          {
            clip_id: 'clip-2',
            url: 'https://example.com/video.mp4',
            media_type: 'video',
          },
        ],
      },
    });
  });
});
