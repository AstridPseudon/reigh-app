import { useMemo } from 'react';
import type { MediaGalleryLightboxSession } from '../components/MediaGalleryLightbox';

interface UseMediaGalleryLightboxSessionParams {
  stateHook: any;
  actionsHook: any;
  filtersHook: any;
  paginationHook: any;
  serverPage?: number;
  handleNextImage: () => void;
  handlePreviousImage: () => void;
  handleSetActiveLightboxIndex: (index: number) => void;
  lightboxDeletingId: string | null;
  onApplySettings?: ((...args: any[]) => Promise<void> | void) | undefined;
  simplifiedShotOptions: any[];
  onAddToLastShot?: ((...args: any[]) => Promise<boolean>) | undefined;
  onAddToLastShotWithoutPosition?: ((...args: any[]) => Promise<boolean>) | undefined;
  isMobile: boolean;
  task: any;
  taskDetailsLoading: boolean;
  taskError: any;
  inputImages: any[];
  lightboxTaskMapping: any;
  onCreateShot?: ((...args: any[]) => Promise<any>) | undefined;
  handleNavigateToShot: (...args: any[]) => void;
  handleShowTaskDetails: (...args: any[]) => void;
  currentToolType?: string;
  showDelete: boolean;
}

export function useMediaGalleryLightboxSession(params: UseMediaGalleryLightboxSessionParams): MediaGalleryLightboxSession {
  const {
    stateHook,
    actionsHook,
    filtersHook,
    paginationHook,
    serverPage,
    handleNextImage,
    handlePreviousImage,
    handleSetActiveLightboxIndex,
    lightboxDeletingId,
    onApplySettings,
    simplifiedShotOptions,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
    isMobile,
    task,
    taskDetailsLoading,
    taskError,
    inputImages,
    lightboxTaskMapping,
    onCreateShot,
    handleNavigateToShot,
    handleShowTaskDetails,
    currentToolType,
    showDelete,
  } = params;

  return useMemo<MediaGalleryLightboxSession>(() => ({
    activeLightboxMedia: stateHook.state.activeLightboxMedia,
    autoEnterEditMode: stateHook.state.autoEnterEditMode,
    onClose: actionsHook.handleCloseLightbox,
    filteredImages: filtersHook.filteredImages,
    isServerPagination: paginationHook.isServerPagination,
    serverPage,
    totalPages: paginationHook.totalPages,
    onNext: handleNextImage,
    onPrevious: handlePreviousImage,
    onDelete: showDelete ? actionsHook.handleOptimisticDelete : undefined,
    isDeleting: lightboxDeletingId,
    onApplySettings,
    simplifiedShotOptions,
    selectedShotIdLocal: stateHook.state.selectedShotIdLocal,
    onShotChange: actionsHook.handleShotChange,
    onAddToShot: onAddToLastShot,
    onAddToShotWithoutPosition: onAddToLastShotWithoutPosition,
    showTickForImageId: stateHook.state.showTickForImageId,
    setShowTickForImageId: stateHook.setShowTickForImageId,
    showTickForSecondaryImageId: stateHook.state.showTickForSecondaryImageId,
    setShowTickForSecondaryImageId: stateHook.setShowTickForSecondaryImageId,
    optimisticPositionedIds: stateHook.state.optimisticPositionedIds,
    optimisticUnpositionedIds: stateHook.state.optimisticUnpositionedIds,
    onOptimisticPositioned: stateHook.markOptimisticPositioned,
    onOptimisticUnpositioned: stateHook.markOptimisticUnpositioned,
    isMobile,
    showTaskDetailsModal: stateHook.state.showTaskDetailsModal,
    setShowTaskDetailsModal: stateHook.setShowTaskDetailsModal,
    selectedImageForDetails: stateHook.state.selectedImageForDetails,
    setSelectedImageForDetails: stateHook.setSelectedImageForDetails,
    onShowTaskDetails: handleShowTaskDetails,
    task,
    isLoadingTask: taskDetailsLoading,
    taskError,
    inputImages,
    lightboxTaskMapping,
    onCreateShot,
    onNavigateToShot: handleNavigateToShot,
    toolTypeOverride: currentToolType,
    setActiveLightboxIndex: handleSetActiveLightboxIndex,
  }), [
    actionsHook.handleCloseLightbox,
    actionsHook.handleOptimisticDelete,
    actionsHook.handleShotChange,
    currentToolType,
    filtersHook.filteredImages,
    handleNavigateToShot,
    handleNextImage,
    handlePreviousImage,
    handleSetActiveLightboxIndex,
    handleShowTaskDetails,
    inputImages,
    isMobile,
    lightboxDeletingId,
    lightboxTaskMapping,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
    onApplySettings,
    onCreateShot,
    paginationHook.isServerPagination,
    paginationHook.totalPages,
    serverPage,
    showDelete,
    simplifiedShotOptions,
    stateHook.markOptimisticPositioned,
    stateHook.markOptimisticUnpositioned,
    stateHook.setSelectedImageForDetails,
    stateHook.setShowTaskDetailsModal,
    stateHook.setShowTickForImageId,
    stateHook.setShowTickForSecondaryImageId,
    stateHook.state.activeLightboxMedia,
    stateHook.state.autoEnterEditMode,
    stateHook.state.optimisticPositionedIds,
    stateHook.state.optimisticUnpositionedIds,
    stateHook.state.selectedImageForDetails,
    stateHook.state.selectedShotIdLocal,
    stateHook.state.showTaskDetailsModal,
    stateHook.state.showTickForImageId,
    stateHook.state.showTickForSecondaryImageId,
    task,
    taskDetailsLoading,
    taskError,
  ]);
}
