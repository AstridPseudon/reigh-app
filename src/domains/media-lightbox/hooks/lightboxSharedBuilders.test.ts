import { describe, expect, it, vi } from 'vitest';

import {
  buildImageSharedLightboxInput,
  buildVariantSegmentImages,
  buildVideoSharedLightboxInput,
} from './lightboxSharedBuilders';

describe('lightboxSharedBuilders', () => {
  it('builds image shared-lightbox input from the neutral task-details boundary', () => {
    const handleUpscale = vi.fn();

    const result = buildImageSharedLightboxInput({
      props: {
        media: { id: 'img-1' } as never,
        onClose: vi.fn(),
        readOnly: true,
        shotId: 'shot-1',
        initialVariantId: 'variant-1',
        navigation: { hasNext: true, hasPrevious: false },
        shotWorkflow: { selectedShotId: 'shot-1' },
        features: { showTaskDetails: true, showDownload: true },
        actions: { onDelete: vi.fn(), isDeleting: 'img-1', starred: true },
      },
      env: {
        selectedProjectId: 'project-1',
        isMobile: false,
        variantFetchGenerationId: 'img-1',
        isCloudMode: false,
        isDownloading: false,
        setIsDownloading: vi.fn(),
        upscaleHook: {
          isUpscaling: true,
          effectiveImageUrl: 'https://image.test/full.png',
          handleUpscale,
        },
        imageDimensions: { width: 1024, height: 1024 },
        projectAspectRatio: '1:1',
      } as never,
      modeSnapshot: { isInpaintMode: false, isMagicEditMode: true },
      handleSlotNavNext: vi.fn(),
      handleSlotNavPrev: vi.fn(),
    });

    expect(result.layout.showTaskDetails).toBe(true);
    expect(result.navigation.swipeDisabled).toBe(true);
    expect(result.actions.isUpscaling).toBe(true);
  });

  it('builds video shared-lightbox input and keeps video-specific navigation ownership', () => {
    const result = buildVideoSharedLightboxInput({
      props: {
        media: { id: 'video-1' },
        onClose: vi.fn(),
        navigation: { showNavigation: true },
        features: { showTaskDetails: true, showDownload: true },
        actions: { onDelete: vi.fn(), isDeleting: 'video-1', starred: false },
      } as never,
      modeModel: {
        isFormOnlyMode: false,
        hasNext: true,
        hasPrevious: true,
        handleSlotNavNext: vi.fn(),
        handleSlotNavPrev: vi.fn(),
      } as never,
      env: {
        selectedProjectId: 'project-1',
        isMobile: false,
        variantFetchGenerationId: 'video-1',
        videoEditSubMode: 'trim',
        isCloudMode: false,
        isDownloading: false,
        setIsDownloading: vi.fn(),
        effectiveImageUrl: 'https://video.test/poster.png',
        imageDimensions: { width: 1920, height: 1080 },
        projectAspectRatio: '16:9',
      } as never,
    });

    expect(result.core.isVideo).toBe(true);
    expect(result.navigation.hasNext).toBe(true);
    expect(result.navigation.swipeDisabled).toBe(true);
  });

  it('prefers segment-slot imagery when building variant segment images', () => {
    const result = buildVariantSegmentImages(
      {
        pairData: {
          startImage: {
            id: 'start-shot-gen',
            generationId: 'start-gen',
            primaryVariantId: 'start-variant',
            url: 'https://image.test/start.png',
          },
          endImage: {
            id: 'end-shot-gen',
            generationId: 'end-gen',
            primaryVariantId: 'end-variant',
            url: 'https://image.test/end.png',
          },
        },
      } as never,
      {
        startUrl: 'fallback-start',
        endUrl: 'fallback-end',
      } as never,
    );

    expect(result).toEqual({
      startUrl: 'https://image.test/start.png',
      endUrl: 'https://image.test/end.png',
      startGenerationId: 'start-gen',
      endGenerationId: 'end-gen',
      startShotGenerationId: 'start-shot-gen',
      endShotGenerationId: 'end-shot-gen',
      startVariantId: 'start-variant',
      endVariantId: 'end-variant',
    });
  });
});
