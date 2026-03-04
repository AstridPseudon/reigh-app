import React, { useCallback, useMemo } from "react";
import { Eye } from "lucide-react";
import { DraggableImage } from "@/shared/components/DraggableImage";
import { TimeStamp } from "@/shared/components/TimeStamp";
import type { Shot } from "@/domains/generation/types";
import type { MediaGalleryItemProps } from "./MediaGalleryItem/types";
import { VideoContent } from "./MediaGalleryItem/components/VideoContent";
import { ImageContent } from "./MediaGalleryItem/components/ImageContent";
import { ShotActions } from "./MediaGalleryItem/components/ShotActions";
import { ActionButtons } from "./MediaGalleryItem/components/ActionButtons";
import { ItemShotBadges } from "./MediaGalleryItem/components/ItemShotBadges";
import { ItemMetadataBar } from "./MediaGalleryItem/components/ItemMetadataBar";
import { useShotActions } from "./MediaGalleryItem/hooks/useShotActions";
import { useImageLoading } from "./MediaGalleryItem/hooks/useImageLoading";
import { useMediaGalleryItemState } from "./MediaGalleryItem/hooks/useMediaGalleryItemState";
import { useStableMediaUrls } from "./MediaGalleryItem/hooks/useStableMediaUrls";
import { useShotPositionChecks } from "./MediaGalleryItem/hooks/useShotPositionChecks";
import { useItemInteraction } from "./MediaGalleryItem/hooks/useItemInteraction";
import { resolveAspectRatioPadding } from "./MediaGalleryItem/lib/aspectRatioPaddingHelper";
import { setGenerationDragData, createDragPreview } from '@/shared/lib/dnd/dragDrop';
import CreateShotModal from "@/features/shots/components/CreateShotModal";
import { useProjectSelectionContext } from "@/shared/contexts/ProjectContext";
import { TOOL_IDS } from '@/shared/lib/toolIds';
import { useShotNavigation } from "@/shared/hooks/useShotNavigation";
import { useLastAffectedShot } from "@/shared/hooks/useLastAffectedShot";
import { useQuickShotCreate } from "@/shared/hooks/useQuickShotCreate";
import { useTaskFromUnifiedCache, usePrefetchTaskData } from "@/shared/hooks/tasks/useTaskPrefetch";
import { useTaskType } from "@/shared/hooks/tasks/useTaskType";
import { useGetTask } from "@/shared/hooks/tasks/useTasks";
import { useShareGeneration } from "@/shared/hooks/useShareGeneration";
import { deriveGalleryInputImages } from "./MediaGallery/utils";
import { isImageEditTaskType } from "@/shared/lib/taskParamsUtils";
import { useMarkVariantViewed } from "@/shared/hooks/useMarkVariantViewed";
import { getGenerationId } from '@/shared/lib/media/mediaTypeHelpers';

export const MediaGalleryItem: React.FC<MediaGalleryItemProps> = ({
  image,
  index,
  shotWorkflow,
  mobileInteraction,
  features,
  actions,
  loading,
  projectAspectRatio,
  dataTour,
}) => {
  // ── Destructure grouped props ──

  const {
    selectedShotIdLocal,
    simplifiedShotOptions,
    setSelectedShotIdLocal,
    setLastAffectedShotId,
    showTickForImageId,
    onShowTick,
    onShowSecondaryTick,
    optimisticUnpositionedIds,
    optimisticPositionedIds,
    onOptimisticUnpositioned,
    onOptimisticPositioned,
    addingToShotImageId,
    setAddingToShotImageId,
    addingToShotWithoutPositionImageId,
    setAddingToShotWithoutPositionImageId,
    currentViewingShotId,
    onCreateShot,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
  } = shotWorkflow;

  const {
    isMobile,
    mobileActiveImageId,
    mobilePopoverOpenImageId,
    onMobileTap,
  } = mobileInteraction;

  const {
    showShare = true,
    showDelete = true,
    showEdit = true,
    showStar = true,
    showAddToShot = true,
    enableSingleClick = false,
    videosAsThumbnails = false,
  } = features;

  const {
    onOpenLightbox,
    onDelete,
    onToggleStar,
    onImageClick,
    onImageLoaded,
  } = actions;

  const {
    shouldLoad = true,
    isPriority = false,
    isDeleting,
  } = loading;

  // Consolidated local UI state management
  const {
    localStarred,
    setLocalStarred,
    isTogglingStar,
    setIsTogglingStar,
    isInfoOpen,
    setIsInfoOpen,
    isShotSelectorOpen,
    setIsShotSelectorOpen,
    isDragging,
    setIsDragging,
    isCreateShotModalOpen,
    setIsCreateShotModalOpen,
    isCreatingShot,
    handleCreateShot,
  } = useMediaGalleryItemState({ image, onCreateShot });

  // Prefetch task data on hover for faster lightbox loading
  const prefetchTaskData = usePrefetchTaskData();

  // Fetch task data for video tasks to show proper details
  // Try to get task ID from metadata first (more efficient), fallback to cache query
  // IMPORTANT: Use generation_id (actual generations.id) when available, falling back to id
  // For ShotImageManager images, id is shot_generations.id but generation_id is the actual generation ID
  const taskIdFromMetadata = image.metadata?.taskId as string | undefined;
  const actualGenerationId = getGenerationId(image);
  const generationIdForActions = actualGenerationId || image.id;
  const { selectedProjectId } = useProjectSelectionContext();
  const { data: taskIdMapping } = useTaskFromUnifiedCache(actualGenerationId ?? '');
  const taskIdFromCache = typeof taskIdMapping?.taskId === 'string' ? taskIdMapping.taskId : null;
  const taskId: string | null = taskIdFromMetadata || taskIdFromCache;

  const { data: taskData } = useGetTask(taskId ?? '', selectedProjectId ?? null);

  // Prefetch task data on mouse enter (desktop only)
  const handleMouseEnter = useCallback(() => {
    if (!isMobile && actualGenerationId) {
      prefetchTaskData(actualGenerationId);
    }
  }, [isMobile, actualGenerationId, prefetchTaskData]);

  // Derive input images for guidance tooltip
  const inputImages = useMemo(() => deriveGalleryInputImages(taskData), [taskData]);

  // Only use the actual task type name (like 'wan_2_2_t2i'), not tool_type (like 'image-generation')
  // tool_type and task type name are different concepts - tool_type is a broader category
  const taskType = taskData?.taskType;
  const { data: taskTypeInfo } = useTaskType(taskType || '');

  // Determine if this should show task details (GenerationDetails)
  // Use content_type from task_types table. Fallback to legacy tool_type for video travel.
  const isVideoTask = taskTypeInfo?.content_type === 'video' ||
    (!taskTypeInfo && image.metadata?.tool_type === TOOL_IDS.TRAVEL_BETWEEN_IMAGES);
  const isImageEditTask = isImageEditTaskType(taskType || undefined);
  const shouldShowTaskDetails = (!!taskData) && (isVideoTask || isImageEditTask);

  // Share functionality
  const { handleShare, isCreatingShare, shareCopied, shareSlug } = useShareGeneration(image.id, taskId);

  const { markAllViewed } = useMarkVariantViewed();

  // Callback to mark all variants for this generation as viewed
  const handleMarkAllVariantsViewed = useCallback(() => {
    if (actualGenerationId) {
      markAllViewed(actualGenerationId);
    }
  }, [actualGenerationId, markAllViewed]);

  const { navigateToShot } = useShotNavigation();
  const { setLastAffectedShotId: updateLastAffectedShotId } = useLastAffectedShot();

  // Use consolidated hook for quick shot creation
  const {
    quickCreateSuccess,
    handleQuickCreateAndAdd,
    handleQuickCreateSuccess,
  } = useQuickShotCreate({
    generationId: generationIdForActions,
    generationPreview: {
      imageUrl: image.url,
      thumbUrl: image.thumbUrl,
      type: image.type,
      location: image.location,
    },
    shots: simplifiedShotOptions,
    onShotChange: (shotId) => {
      updateLastAffectedShotId(shotId);
      setSelectedShotIdLocal(shotId);
    },
    onLoadingStart: () => setAddingToShotImageId(image.id),
    onLoadingEnd: () => setAddingToShotImageId(null),
  });
  // Stable media URLs (handles progressive loading + token-rotation stability)
  const {
    isVideoContent,
    displayUrl,
    stableDisplayUrl,
    stableVideoUrl,
    progressiveEnabled,
    isThumbShowing,
    isFullLoaded,
    progressiveRef,
  } = useStableMediaUrls({ image, isPriority });

  // Image loading state management (error handling, retry logic, loading state)
  const {
    actualSrc,
    actualDisplayUrl,
    imageLoaded,
    imageLoadError,
    handleImageLoad,
    handleImageError,
    retryImageLoad,
    setImageLoading,
  } = useImageLoading({
    image,
    displayUrl,
    shouldLoad,
    onImageLoaded,
  });

  // Shot actions with retry logic
  const { addToShot, addToShotWithoutPosition } = useShotActions({
    imageId: image.id,
    generationId: generationIdForActions,
    imageUrl: image.url,
    thumbUrl: image.thumbUrl ?? image.url,
    displayUrl: displayUrl || image.url,
    selectedShotId: selectedShotIdLocal,
    isMobile,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
    onShowTick,
    onShowSecondaryTick,
    onOptimisticPositioned,
    onOptimisticUnpositioned,
    setAddingToShotImageId,
    setAddingToShotWithoutPositionImageId,
  });

  // Check if we should show metadata details (only when tooltip/popover is open for performance)
  const shouldShowMetadata = useMemo(() => {
    if (!image.metadata) return false;

    // On mobile, only show when popover is open; on desktop, only when tooltip might be shown
    return isMobile
      ? (mobilePopoverOpenImageId === image.id)
      : isInfoOpen;
  }, [image.metadata, isMobile, mobilePopoverOpenImageId, image.id, isInfoOpen]);
  const isCurrentDeleting = isDeleting === true || isDeleting === image.id;
  const imageKey = image.id || `image-${actualDisplayUrl}-${index}`;


  // Placeholder check
  const isPlaceholder = !image.id && actualDisplayUrl === "/placeholder.svg";
  const currentTargetShotName = selectedShotIdLocal ? simplifiedShotOptions.find(s => s.id === selectedShotIdLocal)?.name : undefined;

  // Handle drag start for dropping onto timeline
  const handleDragStart = useCallback((e: React.DragEvent) => {
    // Only enable drag on desktop
    if (isMobile) {
      e.preventDefault();
      return;
    }

    setIsDragging(true);

    // Use shared utility to set drag data
    setGenerationDragData(e, {
      generationId: image.id,
      imageUrl: image.url,
      thumbUrl: image.thumbUrl,
      metadata: image.metadata
    });

    // Create drag preview and clean up after brief moment
    const cleanup = createDragPreview(e);
    if (cleanup) {
      setTimeout(cleanup, 0);
    }
  }, [image, isMobile, setIsDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, [setIsDragging]);

  const { handleTouchStart, handleInteraction } = useItemInteraction({
    image,
    isMobile,
    mobileActiveImageId,
    enableSingleClick,
    onImageClick,
    onMobileTap,
  });

  // Shot position state (positioned, associated-without-position, viewing selected shot)
  const {
    isAlreadyPositionedInSelectedShot,
    isAlreadyAssociatedWithoutPosition,
    shouldShowAddWithoutPositionButton,
  } = useShotPositionChecks({
    image,
    selectedShotIdLocal,
    currentViewingShotId,
    optimisticPositionedIds,
    optimisticUnpositionedIds,
    onAddToLastShotWithoutPosition,
    showTickForImageId,
    addingToShotImageId,
  });

  const aspectRatioPadding = resolveAspectRatioPadding(image, projectAspectRatio);
  const minHeight = '120px'; // Minimum height for very small images

  // If it's a placeholder, render simplified placeholder item
  if (isPlaceholder) {
    return (
      <div
        key={imageKey}
        className="border rounded-lg overflow-hidden bg-muted animate-pulse"
      >
        <div style={{ paddingBottom: aspectRatioPadding }} className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Eye className="h-12 w-12 text-muted-foreground opacity-30" />
          </div>
        </div>
      </div>
    );
  }

  // Conditionally wrap with DraggableImage only on desktop to avoid interfering with mobile scrolling
  const imageContent = (
    <div
        className={`border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 relative group bg-card ${
          isDragging ? 'opacity-50 scale-75' : ''
        } ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={!isMobile}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={handleMouseEnter}
        data-tour={dataTour}
        onClick={enableSingleClick || !isMobile ? (e) => {
          if (onImageClick) {
            e.stopPropagation();
            onImageClick(image);
          } else {
            // Fallback to standard behavior if onImageClick not provided but enabled
            onOpenLightbox(image);
          }
        } : undefined}
        // Mobile touch handlers on outer div as fallback for iPad Safari
        // This ensures touch events are captured even if inner elements don't receive them
        onTouchStart={isMobile && !enableSingleClick && !isVideoContent ? handleTouchStart : undefined}
        onTouchEnd={isMobile && !enableSingleClick && !isVideoContent ? handleInteraction : undefined}
    >
      <div className="relative w-full">
      <div
        style={{
          paddingBottom: aspectRatioPadding,
          minHeight: minHeight
        }}
        className="relative bg-muted/50"
      >
          {isVideoContent ? (
            <VideoContent
              image={image}
              stableDisplayUrl={stableDisplayUrl}
              stableVideoUrl={stableVideoUrl}
              actualSrc={actualSrc}
              shouldLoad={shouldLoad}
              imageLoaded={imageLoaded}
              videosAsThumbnails={videosAsThumbnails}
              isMobile={isMobile}
              enableSingleClick={enableSingleClick}
              onOpenLightbox={onOpenLightbox}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleInteraction}
              onVideoError={handleImageError}
              onLoadStart={() => setImageLoading(true)}
              onLoadedData={handleImageLoad}
            />
          ) : (
            <ImageContent
              image={image}
              index={index}
              actualSrc={actualSrc}
              imageLoaded={imageLoaded}
              imageLoadError={imageLoadError}
              progressiveEnabled={progressiveEnabled}
              isThumbShowing={isThumbShowing}
              isFullLoaded={isFullLoaded}
              progressiveRef={progressiveRef}
              isMobile={isMobile}
              onOpenLightbox={onOpenLightbox}
              onImageLoad={handleImageLoad}
              onImageError={handleImageError}
              onRetry={retryImageLoad}
              setImageLoading={setImageLoading}
            />
          )}
      </div>
      </div>

      {/* Action buttons and UI elements */}
      {image.id && ( // Ensure image has ID for actions
      <>
          <ItemShotBadges
            image={image}
            isVideoContent={isVideoContent}
            simplifiedShotOptions={simplifiedShotOptions}
            onMarkAllVariantsViewed={handleMarkAllVariantsViewed}
            onNavigateToShot={(shotId) => {
              const targetShot = simplifiedShotOptions.find((shot) => shot.id === shotId);
              if (targetShot) {
                navigateToShot(targetShot as Shot, { scrollToTop: true });
              }
            }}
          />

          {/* Add to Shot UI - Top Left (for non-video content) */}
          {showAddToShot && simplifiedShotOptions.length > 0 && onAddToLastShot && (
            <ShotActions
              image={image}
              selector={{
                selectedShotId: selectedShotIdLocal,
                simplifiedShotOptions,
                isShotSelectorOpen,
                setIsShotSelectorOpen,
                setSelectedShotIdLocal,
                setLastAffectedShotId,
              }}
              status={{
                isMobile,
                isVideoContent,
                addingToShotImageId,
                addingToShotWithoutPositionImageId: addingToShotWithoutPositionImageId ?? null,
                showTickForImageId,
                isAlreadyPositionedInSelectedShot,
                isAlreadyAssociatedWithoutPosition,
                shouldShowAddWithoutPositionButton,
                currentTargetShotName,
              }}
              quickCreate={{
                quickCreateSuccess,
                handleQuickCreateAndAdd,
                handleQuickCreateSuccess,
              }}
              actions={{
                onCreateShot,
                onNavigateToShot: (shot) => navigateToShot(shot, { scrollToTop: true }),
                onAddToShot: addToShot,
                onAddToShotWithoutPosition: addToShotWithoutPosition,
              }}
            />
          )}

          {/* Timestamp - Top Right (hides on hover for images, stays visible for videos) */}
          <TimeStamp
            createdAt={image.createdAt}
            position="top-right"
            showOnHover={false}
            hideOnHover={!isVideoContent}
            className="z-30"
          />

          <ItemMetadataBar
            image={image}
            isVideoContent={isVideoContent}
            isMobile={isMobile}
            taskData={taskData}
            inputImages={inputImages}
            shouldShowMetadata={shouldShowMetadata}
            shouldShowTaskDetails={shouldShowTaskDetails}
            setIsInfoOpen={setIsInfoOpen}
            showShare={showShare}
            taskId={taskId}
            handleShare={handleShare}
            isCreatingShare={isCreatingShare}
            shareCopied={shareCopied}
            shareSlug={shareSlug}
            onMarkAllVariantsViewed={handleMarkAllVariantsViewed}
          />

          <ActionButtons
            image={image}
            localStarred={localStarred}
            isTogglingStar={isTogglingStar}
            isDeleting={isCurrentDeleting}
            showStar={showStar}
            showEdit={showEdit}
            showDelete={showDelete}
            onToggleStar={onToggleStar}
            setIsTogglingStar={setIsTogglingStar}
            setLocalStarred={setLocalStarred}
            onOpenLightbox={onOpenLightbox}
            onDelete={onDelete}
          />
      </>)
      }
    </div>
  );

  // On mobile, drag is already disabled by using the non-draggable branch.
  return isMobile ? (
    <React.Fragment key={imageKey}>
      {imageContent}
      {onCreateShot && (
        <CreateShotModal
          isOpen={isCreateShotModalOpen}
          onClose={() => setIsCreateShotModalOpen(false)}
          onSubmit={handleCreateShot}
          isLoading={isCreatingShot}
          projectId={selectedProjectId ?? undefined}
        />
      )}
    </React.Fragment>
  ) : (
    <DraggableImage key={`draggable-${imageKey}`} image={image} onDoubleClick={() => onOpenLightbox(image)}>
      {imageContent}
      {onCreateShot && (
        <CreateShotModal
          isOpen={isCreateShotModalOpen}
          onClose={() => setIsCreateShotModalOpen(false)}
          onSubmit={handleCreateShot}
          isLoading={isCreatingShot}
          projectId={selectedProjectId ?? undefined}
        />
      )}
    </DraggableImage>
  );
};
