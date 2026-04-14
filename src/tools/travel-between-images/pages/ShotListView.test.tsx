// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shot } from '@/domains/generation/types';
import { ShotListView } from './ShotListView';

let latestShotListDisplayProps: Record<string, unknown> | null = null;
let latestHeaderProps: Record<string, unknown> | null = null;

const mockToggleHidden = vi.fn();
const mockNavigateToShot = vi.fn();
let mockHiddenIds = new Set<string>();

vi.mock('@/shared/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/features/shots/components/CreateShotModal', () => ({
  default: () => null,
}));

vi.mock('../components/VideoGallery/ShotListDisplay', () => ({
  ShotListDisplay: (props: Record<string, unknown>) => {
    latestShotListDisplayProps = props;
    const shots = (props.shots as Shot[] | undefined) ?? [];

    return <div data-testid="shot-list-display">shots:{shots.length}</div>;
  },
}));

vi.mock('@/shared/hooks/mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/shared/hooks/shotCreation/useShotCreation', () => ({
  useShotCreation: () => ({
    createShot: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/shots', () => ({
  useHandleExternalImageDrop: () => ({ mutateAsync: vi.fn() }),
  useAddImageToShot: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/shared/hooks/projects/useProjectGenerations', () => ({
  useProjectGenerations: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock('@/domains/generation/hooks/useDeleteGenerationWithConfirm', () => ({
  useDeleteGenerationWithConfirm: () => ({
    requestDelete: vi.fn(),
    confirmDialogProps: {},
    isPending: false,
  }),
}));

vi.mock('@/domains/generation/hooks/useGenerationMutations', () => ({
  useToggleGenerationStar: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/shared/components/dialogs/DeleteGenerationConfirmDialog', () => ({
  DeleteGenerationConfirmDialog: () => null,
}));

vi.mock('@/shared/hooks/shots/useShotNavigation', () => ({
  useShotNavigation: () => ({
    navigateToShot: mockNavigateToShot,
  }),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: vi.fn(),
}));

vi.mock('../hooks/workflow/useVideoTravelViewMode', () => ({
  useVideoTravelViewMode: () => ({
    showVideosView: false,
    setShowVideosViewRaw: vi.fn(),
    setViewMode: vi.fn(),
    videosViewJustEnabled: false,
    setVideosViewJustEnabled: vi.fn(),
    videoFilters: {
      toolTypeFilter: false,
      mediaType: 'all',
      shotFilter: 'all',
      excludePositioned: false,
      starredOnly: false,
      searchTerm: '',
    },
    setVideoFilters: vi.fn(),
    videoPage: 1,
    setVideoPage: vi.fn(),
    videoSortMode: 'oldest',
    setVideoSortMode: vi.fn(),
    shotSearchQuery: '',
    setShotSearchQuery: vi.fn(),
    clearSearch: vi.fn(),
    isSearchOpen: false,
    setIsSearchOpen: vi.fn(),
    handleSearchToggle: vi.fn(),
    searchInputRef: { current: null },
  }),
}));

vi.mock('../hooks/workflow/useVideoTravelDropHandlers', () => ({
  useVideoTravelDropHandlers: () => ({
    handleGenerationDropOnShot: vi.fn(),
    handleGenerationDropForNewShot: vi.fn(),
    handleFilesDropForNewShot: vi.fn(),
    handleFilesDropOnShot: vi.fn(),
  }),
}));

vi.mock('../hooks/workflow/useVideoTravelAddToShot', () => ({
  useVideoTravelAddToShot: () => ({
    targetShotInfo: {
      targetShotIdForButton: undefined,
      targetShotNameForButtonTooltip: undefined,
    },
    handleAddVideoToTargetShot: vi.fn(),
    handleAddVideoToTargetShotWithoutPosition: vi.fn(),
  }),
}));

vi.mock('../hooks/video/useVideoLayoutConfig', () => ({
  useVideoLayoutConfig: () => ({
    columns: 3,
    itemsPerPage: 12,
  }),
}));

vi.mock('../hooks/useHiddenShots', () => ({
  useHiddenShots: () => ({
    hiddenIds: mockHiddenIds,
    isHidden: (id: string) => mockHiddenIds.has(id),
    hide: vi.fn(),
    unhide: vi.fn(),
    toggle: mockToggleHidden,
  }),
}));

vi.mock('../components/VideoGallery/VideoTravelListHeader', () => ({
  VideoTravelListHeader: (props: Record<string, unknown>) => {
    latestHeaderProps = props;
    return <div data-testid="video-travel-list-header" />;
  },
}));

vi.mock('../components/VideoGallery/VideoTravelVideosGallery', () => ({
  VideoTravelVideosGallery: () => <div data-testid="video-travel-videos-gallery" />,
}));

function buildShot(id: string, name: string): Shot {
  return {
    id,
    name,
    images: [],
    settings: {},
  } as Shot;
}

function renderShotListView() {
  return render(
    <ShotListView
      shots={[
        buildShot('shot-1', 'Shot 1'),
        buildShot('shot-2', 'Shot 2'),
      ]}
      selectedProjectId="project-1"
      projectAspectRatio="16:9"
      refetchShots={vi.fn()}
      projectUISettings={undefined}
      updateProjectUISettings={undefined}
      uploadSettings={undefined}
      shotSortMode="ordered"
      setShotSortMode={vi.fn()}
    />,
  );
}

describe('ShotListView', () => {
  beforeEach(() => {
    latestShotListDisplayProps = null;
    latestHeaderProps = null;
    mockHiddenIds = new Set(['shot-1', 'shot-2']);
    mockToggleHidden.mockReset();
    mockNavigateToShot.mockReset();
  });

  it('shows the all-hidden branch before rendering the generic list empty state and reveals hidden shots on click', () => {
    renderShotListView();

    expect(
      screen.getByText('All shots are hidden. Click Show Hidden (2) to reveal them.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show hidden \(2\)/i })).toBeInTheDocument();
    expect(screen.queryByTestId('shot-list-display')).not.toBeInTheDocument();
    expect((latestHeaderProps?.hidden as { hiddenCount: number } | undefined)?.hiddenCount).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /show hidden \(2\)/i }));

    expect(screen.getByTestId('shot-list-display')).toHaveTextContent('shots:2');
    expect((latestShotListDisplayProps?.shots as Shot[] | undefined)).toHaveLength(2);

    const isHidden = latestShotListDisplayProps?.isHidden as ((shot: Shot) => boolean) | undefined;
    const onToggleHidden = latestShotListDisplayProps?.onToggleHidden as ((shot: Shot) => void) | undefined;

    expect(isHidden?.(buildShot('shot-1', 'Shot 1'))).toBe(true);

    onToggleHidden?.(buildShot('shot-1', 'Shot 1'));
    expect(mockToggleHidden).toHaveBeenCalledWith('shot-1');
  });
});
