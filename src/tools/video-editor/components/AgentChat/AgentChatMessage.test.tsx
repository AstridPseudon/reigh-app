// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentChatMessage } from './AgentChatMessage';

describe('AgentChatMessage', () => {
  it('renders attachment summaries for gallery-style attachments that include generationId', () => {
    render(
      <AgentChatMessage
        turn={{
          role: 'assistant',
          content: 'I used your selected references.',
          attachments: [
            {
              clipId: 'gallery-gen-1',
              url: 'https://example.com/image.png',
              mediaType: 'image',
              generationId: 'gen-1',
            },
            {
              clipId: 'gallery-gen-2',
              url: 'https://example.com/video.mp4',
              mediaType: 'video',
              generationId: 'gen-2',
            },
          ],
          timestamp: '2026-04-04T12:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText('I used your selected references.')).toBeInTheDocument();
    expect(screen.getByText('1 image, 1 video attached')).toBeInTheDocument();
  });
});
