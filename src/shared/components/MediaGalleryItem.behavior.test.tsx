import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGalleryItem } from './MediaGalleryItem';

const mocks = vi.hoisted(() => ({
  prefetchTaskData: vi.fn(),
  navigateToShot: vi.fn(),
  setLastAffectedShotId: vi.fn(),
  handleQuickCreateAndAdd: vi.fn(),
  handleVisitCreatedShot: vi.fn(),
  handleShare: vi.fn(),
  markAllViewed: vi.fn(),
  hasLoadedImage: vi.fn(() => false),
  setImageLoadStatus: vi.fn(),
  getGenerationId: vi.fn((image: { id?: string }) => image.id ?? null),
}));

vi.mock('@/shared/components/DraggableImage', () => ({
  DraggableImage: ({ children }: { children: React.ReactNode }) => <div data-testid="draggable">{children}</div>,
}));

vi.mock('@/shared/components/selectors/ShotSelector', () => ({
  ShotSelector: ({ value }: { value: string }) => <div data-testid="shot-selector">{value}</div>,
}));

vi.mock('@/shared/hooks/ui-image/useProgressiveImage', () => ({
  useProgressiveImage: () => ({
    src: null,
    isThumbShowing: false,
    isFullLoaded: true,
    ref: { current: null },
  }),
}));

vi.mock('@/shared/settings/progressiveLoading', () => ({
  isProgressiveLoadingEnabled: () => false,
}));

vi.mock('@/shared/hooks/tasks/useTaskPrefetch', () => ({
  usePrefetchTaskData: () => mocks.prefetchTaskData,
}));

vi.mock('@/shared/contexts/ProjectContext', () => ({
  useProjectSelectionContext: () => ({ selectedProjectId: 'project-1' }),
  useProject: () => ({ updateProject: vi.fn() }),
}));

vi.mock('@/shared/hooks/shots/useShotNavigation', () => ({
  useShotNavigation: () => ({ navigateToShot: mocks.navigateToShot }),
}));

vi.mock('@/shared/hooks/shots/useLastAffectedShot', () => ({
  useLastAffectedShot: () => ({ setLastAffectedShotId: mocks.setLastAffectedShotId }),
}));

vi.mock('@/shared/hooks/useQuickShotCreate', () => ({
  useQuickShotCreate: () => ({
    quickCreateSuccess: false,
    handleQuickCreateAndAdd: mocks.handleQuickCreateAndAdd,
    handleVisitCreatedShot: mocks.handleVisitCreatedShot,
  }),
}));

vi.mock('@/domains/generation/hooks/tasks/useGenerationTaskMapping', () => ({
  useGenerationTaskMapping: () => ({ data: null }),
}));

vi.mock('@/shared/hooks/tasks/useTasks', () => ({
  useGetTask: () => ({ data: null }),
}));

vi.mock('@/shared/hooks/tasks/useTaskType', () => ({
  useTaskType: () => ({ data: null }),
}));

vi.mock('@/shared/hooks/useShareGeneration', () => ({
  useShareGeneration: () => ({
    handleShare: mocks.handleShare,
    isCreatingShare: false,
    shareCopied: false,
    shareSlug: null,
  }),
}));

vi.mock('@/shared/hooks/variants/useMarkVariantViewed', () => ({
  useMarkVariantViewed: () => ({ markAllViewed: mocks.markAllViewed }),
}));

vi.mock('@/shared/lib/preloading', () => ({
  hasLoadedImage: (...args: unknown[]) => mocks.hasLoadedImage(...args),
  setImageLoadStatus: (...args: unknown[]) => mocks.setImageLoadStatus(...args),
}));

vi.mock('@/shared/lib/media/mediaTypeHelpers', () => ({
  getGenerationId: (...args: unknown[]) => mocks.getGenerationId(...args),
}));

vi.mock('@/shared/lib/dnd/dragDrop', () => ({
  setGenerationDragData: vi.fn(),
  createDragPreview: vi.fn(),
}));

vi.mock('@/domains/generation/components/GenerationDetails', () => ({
  GenerationDetails: () => <div>generation-details</div>,
}));

vi.mock('@/domains/generation/components/GenerationDetails/ImageGenerationDetails', () => ({
  ImageGenerationDetails: () => <div>image-generation-details</div>,
}));

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react');
  return {
    ...actual,
    Share2: () => <svg data-testid="share-icon" />,
    Copy: () => <svg data-testid="copy-icon" />,
    Check: () => <svg data-testid="check-icon" />,
    PlusCircle: () => <svg data-testid="plus-circle-icon" />,
    Eye: () => <svg data-testid="eye-icon" />,
  };
});

function buildProps(overrides: Record<string, unknown> = {}) {
  const image = {
    id: 'img-1',
    url: 'https://cdn/image.png',
    thumbUrl: 'https://cdn/thumb.png',
    prompt: 'Sunset over water',
    metadata: { taskId: 'task-1' },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...((overrides.image as object | undefined) ?? {}),
  };

  return {
    image,
    index: 0,
    shotWorkflow: {
      selectedShotIdLocal: 'shot-1',
      simplifiedShotOptions: [{ id: 'shot-1', name: 'Shot 1' }],
      setSelectedShotIdLocal: vi.fn(),
      setLastAffectedShotId: vi.fn(),
      showTickForImageId: null,
      onShowTick: vi.fn(),
      onShowSecondaryTick: vi.fn(),
      optimisticUnpositionedIds: new Set<string>(),
      optimisticPositionedIds: new Set<string>(),
      onOptimisticUnpositioned: vi.fn(),
      onOptimisticPositioned: vi.fn(),
      addingToShotImageId: null,
      setAddingToShotImageId: vi.fn(),
      addingToShotWithoutPositionImageId: null,
      setAddingToShotWithoutPositionImageId: vi.fn(),
      currentViewingShotId: 'other-shot',
      onCreateShot: vi.fn(),
      onAddToLastShot: vi.fn(async () => true),
      onAddToLastShotWithoutPosition: vi.fn(async () => true),
      ...((overrides.shotWorkflow as object | undefined) ?? {}),
    },
    mobileInteraction: {
      isMobile: false,
      mobileActiveImageId: null,
      mobilePopoverOpenImageId: null,
      onMobileTap: vi.fn(),
      setMobilePopoverOpenImageId: vi.fn(),
      ...((overrides.mobileInteraction as object | undefined) ?? {}),
    },
    features: {
      showShare: true,
      showDelete: true,
      showDownload: true,
      showEdit: true,
      showStar: true,
      showAddToShot: true,
      enableSingleClick: false,
      videosAsThumbnails: false,
      ...((overrides.features as object | undefined) ?? {}),
    },
    actions: {
      onOpenLightbox: vi.fn(),
      onDelete: vi.fn(),
      onDownloadImage: vi.fn(),
      onToggleStar: vi.fn(),
      onImageClick: undefined,
      onImageLoaded: vi.fn(),
      ...((overrides.actions as object | undefined) ?? {}),
    },
    loading: {
      shouldLoad: true,
      isPriority: false,
      isDeleting: false,
      downloadingImageId: null,
      ...((overrides.loading as object | undefined) ?? {}),
    },
    projectAspectRatio: '16:9',
    ...overrides,
  };
}

describe('MediaGalleryItem behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasLoadedImage.mockReturnValue(false);
  });

  it('renders the placeholder fallback when the item has no persisted id and only a placeholder url', () => {
    const props = buildProps({
      image: {
        id: '',
        url: '/placeholder.svg',
        thumbUrl: '/placeholder.svg',
        metadata: undefined,
      },
    });

    const { container } = render(<MediaGalleryItem {...props} />);

    const image = screen.getByAltText('Generated image 1');
    expect(image).toHaveAttribute('src', expect.stringContaining('/placeholder.svg'));
    expect(image).not.toBeVisible();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('opens the lightbox when the rendered image is clicked', async () => {
    mocks.hasLoadedImage.mockReturnValue(true);
    const props = buildProps();

    render(<MediaGalleryItem {...props} />);

    const image = await screen.findByAltText('Sunset over water');
    fireEvent.click(image);

    expect(props.actions.onOpenLightbox).toHaveBeenCalledWith(props.image);
  });

  it('shows add-to-shot affordances and executes the add action for the selected shot', async () => {
    mocks.hasLoadedImage.mockReturnValue(true);
    const props = buildProps();

    const { container } = render(<MediaGalleryItem {...props} />);

    const addButton = screen.getByLabelText("Add to 'Shot 1' at final position");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(props.shotWorkflow.onAddToLastShot).toHaveBeenCalledWith(
        'shot-1',
        'img-1',
        'https://cdn/image.png',
        'https://cdn/thumb.png',
      );
    });

    const shotActions = container.querySelector('.absolute.top-1\\.5.left-1\\.5.right-1\\.5');
    expect(shotActions).not.toBeNull();
    expect(within(shotActions as HTMLElement).getByTestId('shot-selector')).toHaveTextContent('shot-1');
  });
});
