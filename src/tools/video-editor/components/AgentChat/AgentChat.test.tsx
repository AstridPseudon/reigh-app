// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentChat } from './AgentChat';

const mocks = vi.hoisted(() => ({
  useAgentChatBridge: vi.fn(),
  useAgentSessions: vi.fn(),
  useCreateSession: vi.fn(),
  useAgentSession: vi.fn(),
  useSendMessage: vi.fn(),
  useCancelSession: vi.fn(),
  useGallerySelection: vi.fn(),
  useAgentVoice: vi.fn(),
  loadGenerationForLightbox: vi.fn(),
}));

vi.mock('@/shared/contexts/AgentChatContext', () => ({
  useAgentChatBridge: (...args: unknown[]) => mocks.useAgentChatBridge(...args),
}));

vi.mock('@/tools/video-editor/hooks/useAgentSession', () => ({
  useAgentSessions: (...args: unknown[]) => mocks.useAgentSessions(...args),
  useCreateSession: (...args: unknown[]) => mocks.useCreateSession(...args),
  useAgentSession: (...args: unknown[]) => mocks.useAgentSession(...args),
  useSendMessage: (...args: unknown[]) => mocks.useSendMessage(...args),
  useCancelSession: (...args: unknown[]) => mocks.useCancelSession(...args),
}));

vi.mock('@/shared/contexts/GallerySelectionContext', () => ({
  useGallerySelection: (...args: unknown[]) => mocks.useGallerySelection(...args),
}));

vi.mock('@/shared/contexts/PanesContext', () => ({
  usePanes: () => ({
    isTasksPaneLocked: false,
    tasksPaneWidth: 0,
    isGenerationsPaneLocked: false,
    isGenerationsPaneOpen: false,
    effectiveGenerationsPaneHeight: 0,
  }),
}));

vi.mock('@/tools/video-editor/hooks/useAgentVoice', () => ({
  useAgentVoice: (...args: unknown[]) => mocks.useAgentVoice(...args),
}));

vi.mock('@/tools/video-editor/lib/generation-utils', () => ({
  loadGenerationForLightbox: (...args: unknown[]) => mocks.loadGenerationForLightbox(...args),
}));

vi.mock('@/domains/media-lightbox/MediaLightbox', () => ({
  MediaLightbox: ({ media }: { media: { id: string } }) => <div data-testid="media-lightbox">{media.id}</div>,
}));

vi.mock('./AgentChatMessage', () => ({
  AgentChatMessage: ({ turn }: { turn: { content: string } }) => <div>{turn.content}</div>,
  AgentChatToolGroup: () => null,
  AgentChatAttachmentStrip: ({
    attachments,
    onRemoveAttachment,
    onRemoveShot,
  }: {
    attachments: Array<{ clipId: string; shotId?: string }>;
    onRemoveAttachment?: (attachment: { clipId: string; shotId?: string }) => void;
    onRemoveShot?: (shotId: string) => void;
  }) => (
    <div>
      {attachments.map((attachment) => (
        <button
          key={`remove-${attachment.clipId}`}
          type="button"
          onClick={() => onRemoveAttachment?.(attachment)}
        >
          {`remove-${attachment.clipId}`}
        </button>
      ))}
      {attachments
        .filter((attachment) => attachment.shotId)
        .map((attachment) => (
          <button
            key={`remove-shot-${attachment.shotId}`}
            type="button"
            onClick={() => onRemoveShot?.(attachment.shotId!)}
          >
            {`remove-shot-${attachment.shotId}`}
          </button>
        ))}
    </div>
  ),
}));

describe('AgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

    mocks.useAgentChatBridge.mockReturnValue({
      timelineId: 'timeline-1',
      timelineClips: [],
      replaceSelectedTimelineClips: vi.fn(),
    });
    mocks.useAgentSessions.mockReturnValue({
      data: [{ id: 'session-1' }],
      isLoading: false,
    });
    mocks.useCreateSession.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: 'session-2' }),
    });
    mocks.useAgentSession.mockReturnValue({
      data: {
        id: 'session-1',
        status: 'waiting_user',
        turns: [],
      },
      isLoading: false,
    });
    mocks.useSendMessage.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      localError: null,
    });
    mocks.useCancelSession.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mocks.useGallerySelection.mockReturnValue({
      gallerySelectionMap: new Map(),
      selectedGalleryClips: [],
      deselectGalleryItems: vi.fn(),
      clearGallerySelection: vi.fn(),
    });
    mocks.useAgentVoice.mockReturnValue({
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      isRecording: false,
      isProcessing: false,
      remainingSeconds: 30,
    });
    mocks.loadGenerationForLightbox.mockResolvedValue({
      id: 'gen-1',
      generation_id: 'gen-1',
      location: 'https://example.com/shared.png',
      imageUrl: 'https://example.com/shared.png',
      thumbUrl: 'https://example.com/shared.png',
      type: 'image',
      primary_variant_id: null,
      name: 'Shared image',
    });
  });

  it('shows a no-timeline prompt and does not auto-create a session', async () => {
    const createSession = {
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    };
    mocks.useAgentChatBridge.mockReturnValue({
      timelineId: null,
      timelineClips: [],
      replaceSelectedTimelineClips: vi.fn(),
    });
    mocks.useAgentSessions.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mocks.useCreateSession.mockReturnValue(createSession);

    render(<AgentChat />);

    fireEvent.click(screen.getByRole('button', { name: /timeline agent/i }));

    expect(await screen.findByText('Create a timeline to start chatting.')).toBeInTheDocument();
    await waitFor(() => expect(createSession.mutate).not.toHaveBeenCalled());
  });

  it('auto-creates a session when the chat opens with a timeline available', async () => {
    const createSession = {
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: 'session-2' }),
    };
    mocks.useAgentSessions.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mocks.useCreateSession.mockReturnValue(createSession);

    render(<AgentChat />);

    fireEvent.click(screen.getByRole('button', { name: /timeline agent/i }));

    await waitFor(() => expect(createSession.mutate).toHaveBeenCalledTimes(1));
  });

  it('opens the chat instead of starting recording when no timeline exists', async () => {
    const voice = {
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      isRecording: false,
      isProcessing: false,
      remainingSeconds: 30,
    };
    mocks.useAgentChatBridge.mockReturnValue({
      timelineId: null,
      timelineClips: [],
      replaceSelectedTimelineClips: vi.fn(),
    });
    mocks.useAgentSessions.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mocks.useAgentVoice.mockReturnValue(voice);

    render(<AgentChat />);

    fireEvent.keyDown(window, {
      key: 'r',
      metaKey: true,
      shiftKey: true,
    });

    expect(voice.startRecording).not.toHaveBeenCalled();
    expect(await screen.findByText('Create a timeline to start chatting.')).toBeInTheDocument();
  });

  it('routes attachment removal through the bridge callback', async () => {
    const replaceSelectedTimelineClips = vi.fn();
    mocks.useAgentChatBridge.mockReturnValue({
      timelineId: 'timeline-1',
      timelineClips: [
        {
          clipId: 'clip-1',
          assetKey: 'asset-1',
          url: 'https://example.com/1.png',
          mediaType: 'image',
          isTimelineBacked: true,
        },
        {
          clipId: 'clip-2',
          assetKey: 'asset-2',
          url: 'https://example.com/2.png',
          mediaType: 'image',
          isTimelineBacked: true,
        },
      ],
      replaceSelectedTimelineClips,
    });

    render(<AgentChat />);

    fireEvent.click(screen.getByRole('button', { name: /timeline agent/i }));
    fireEvent.click(screen.getByRole('button', { name: 'remove-clip-1' }));

    expect(replaceSelectedTimelineClips).toHaveBeenCalledWith([
      expect.objectContaining({ clipId: 'clip-2' }),
    ]);
  });
});
