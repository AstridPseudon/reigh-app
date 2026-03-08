import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GenerationHelpPopover } from './GenerationHelpPopover';

vi.mock('@/shared/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('GenerationHelpPopover', () => {
  it('renders mobile help copy and triggers AI-instructions copy action', () => {
    const onCopyAIInstructions = vi.fn();

    render(
      <GenerationHelpPopover
        isMobile={true}
        copiedAIInstructions={false}
        onCopyAIInstructions={onCopyAIInstructions}
      />,
    );

    expect(screen.getByRole('button', { name: /Need help\?/i })).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting steps:')).toBeInTheDocument();
    expect(screen.getByText(/running each line of the commands one-at-a-time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy instructions to get help from AI/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy instructions to get help from AI/i }));
    expect(onCopyAIInstructions).toHaveBeenCalledTimes(1);

    const discordLink = screen.getByRole('link', { name: /help channel/i });
    expect(discordLink).toHaveAttribute('href', 'https://discord.gg/WXrdkbkj');
  });

  it('renders desktop-specific text and copied state', () => {
    const onCopyAIInstructions = vi.fn();

    render(
      <GenerationHelpPopover
        isMobile={false}
        copiedAIInstructions={true}
        onCopyAIInstructions={onCopyAIInstructions}
      />,
    );

    expect(screen.getByText(/Try running each line one-at-a-time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reigh discord/i })).toHaveAttribute('href', 'https://discord.gg/WXrdkbkj');

    fireEvent.click(screen.getByRole('button', { name: 'Copied!' }));
    expect(onCopyAIInstructions).toHaveBeenCalledTimes(1);
  });
});
