import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinalVideoSectionDisplay } from './FinalVideoSectionDisplay';

vi.mock('@/shared/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/shared/components/ui/skeleton', () => ({
  Skeleton: ({
    className,
    style,
  }: {
    className?: string;
    style?: React.CSSProperties;
  }) => <div data-testid="skeleton" className={className} style={style} />,
}));

vi.mock('@/shared/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./VideoGallery/components/VideoItem', () => ({
  VideoItem: ({
    video,
    onLightboxOpen,
    onMobileTap,
    projectId,
    hideActions,
  }: {
    video: { id: string };
    onLightboxOpen: () => void;
    onMobileTap: () => void;
    projectId: string;
    hideActions?: boolean;
  }) => (
    <div data-testid="video-item">
      <span>{video.id}</span>
      <span>{projectId}</span>
      <span>{String(hideActions)}</span>
      <button type="button" onClick={onLightboxOpen}>
        open-lightbox
      </button>
      <button type="button" onClick={onMobileTap}>
        mobile-tap
      </button>
    </div>
  ),
}));

describe('FinalVideoSectionDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildProps(
    overrides: Partial<React.ComponentProps<typeof FinalVideoSectionDisplay>> = {},
  ) {
    return {
      projectAspectRatio: '16:9',
      shouldShowSkeleton: false,
      hasFinalOutput: true,
      parentVideoRow: { id: 'video-1', location: 'video.mp4' } as never,
      isMobile: false,
      projectId: 'project-1',
      onLightboxOpen: vi.fn(),
      onMobileTap: vi.fn(),
      onApplySettingsFromTask: vi.fn(),
      readOnly: false,
      onDelete: vi.fn(),
      onDeleteSelected: vi.fn(),
      isDeleting: false,
      isCurrentlyLoading: false,
      hasActiveJoinTask: false,
      ...overrides,
    } satisfies React.ComponentProps<typeof FinalVideoSectionDisplay>;
  }

  it('renders the loading skeleton with the requested aspect ratio', () => {
    render(
      <FinalVideoSectionDisplay
        {...buildProps({
          shouldShowSkeleton: true,
          hasFinalOutput: false,
          parentVideoRow: null,
        })}
      />,
    );

    expect(screen.getByTestId('skeleton')).toHaveStyle({ aspectRatio: '16/9' });
  });

  it('renders the final video and wires lightbox, mobile tap, and delete actions', () => {
    const onLightboxOpen = vi.fn();
    const onMobileTap = vi.fn();
    const onDeleteSelected = vi.fn();

    render(
      <FinalVideoSectionDisplay
        {...buildProps({
          onLightboxOpen,
          onMobileTap,
          onDeleteSelected,
        })}
      />,
    );

    expect(screen.getByTestId('video-item')).toHaveTextContent('video-1');
    expect(screen.getByTestId('video-item')).toHaveTextContent('project-1');
    expect(screen.getByText('Delete final video')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open-lightbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'mobile-tap' }));

    const deleteButtons = screen.getAllByRole('button').filter((button) => button.textContent === '');
    fireEvent.click(deleteButtons[0]);

    expect(onLightboxOpen).toHaveBeenCalledTimes(1);
    expect(onMobileTap).toHaveBeenCalledTimes(1);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('renders loading, join-task, and empty fallback states', () => {
    const { rerender } = render(
      <FinalVideoSectionDisplay
        {...buildProps({
          hasFinalOutput: false,
          parentVideoRow: null,
          isCurrentlyLoading: true,
        })}
      />,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    rerender(
      <FinalVideoSectionDisplay
        {...buildProps({
          hasFinalOutput: false,
          parentVideoRow: null,
          isCurrentlyLoading: false,
          hasActiveJoinTask: true,
        })}
      />,
    );

    expect(screen.getByText('Generating joined clip...')).toBeInTheDocument();

    rerender(
      <FinalVideoSectionDisplay
        {...buildProps({
          hasFinalOutput: false,
          parentVideoRow: null,
          isCurrentlyLoading: false,
          hasActiveJoinTask: false,
        })}
      />,
    );

    expect(screen.getByText('No final video yet')).toBeInTheDocument();
  });
});
