import { useMediaGalleryInteractionController } from './useMediaGalleryInteractionController';
import { useMediaGalleryItemProps } from './useMediaGalleryItemProps';

interface UseMediaGalleryViewInteractionsParams {
  allShots: any[];
  simplifiedShotOptions: any[];
  navigateToShot: (...args: any[]) => void;
  actionsHook: any;
  formAssociatedShotId?: string;
  onSwitchToAssociatedShot?: ((shotId: string) => void) | undefined;
  filtersHook: any;
  stateHook: any;
  isMobile: boolean;
  onCreateShot?: ((...args: any[]) => Promise<any>) | undefined;
  onAddToLastShot?: ((...args: any[]) => Promise<boolean>) | undefined;
  onAddToLastShotWithoutPosition?: ((...args: any[]) => Promise<boolean>) | undefined;
  showDelete: boolean;
  showDownload: boolean;
  showShare: boolean;
  showEdit: boolean;
  showStar: boolean;
  showAddToShot: boolean;
  enableSingleClick: boolean;
  videosAsThumbnails: boolean;
  onToggleStar?: ((...args: any[]) => Promise<void>) | undefined;
  onApplySettings?: ((...args: any[]) => Promise<void> | void) | undefined;
  onImageClick?: ((...args: any[]) => void) | undefined;
  isDeleting?: string | null;
  currentViewingShotId?: string;
  activeLightboxMediaId?: string;
  downloadingImageId?: string | null;
}

export function useMediaGalleryViewInteractions(params: UseMediaGalleryViewInteractionsParams) {
  const {
    allShots,
    simplifiedShotOptions,
    navigateToShot,
    actionsHook,
    formAssociatedShotId,
    onSwitchToAssociatedShot,
    filtersHook,
    stateHook,
    isMobile,
    onCreateShot,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
    showDelete,
    showDownload,
    showShare,
    showEdit,
    showStar,
    showAddToShot,
    enableSingleClick,
    videosAsThumbnails,
    onToggleStar,
    onApplySettings,
    onImageClick,
    isDeleting,
    currentViewingShotId,
    activeLightboxMediaId,
    downloadingImageId,
  } = params;

  const { galleryHandlers, mobileInteractions } = useMediaGalleryInteractionController({
    handlers: {
      allShots,
      simplifiedShotOptions,
      navigateToShot,
      closeLightbox: actionsHook.handleCloseLightbox,
      formAssociatedShotId,
      onSwitchToAssociatedShot,
      setShotFilter: filtersHook.setShotFilter,
      activeLightboxMedia: stateHook.state.activeLightboxMedia,
      setSelectedImageForDetails: stateHook.setSelectedImageForDetails,
      setShowTaskDetailsModal: stateHook.setShowTaskDetailsModal,
      setActiveLightboxMedia: stateHook.setActiveLightboxMedia,
    },
    mobile: {
      isMobile,
      setMobileActiveImageId: stateHook.setMobileActiveImageId,
      mobilePopoverOpenImageId: stateHook.state.mobilePopoverOpenImageId,
      setMobilePopoverOpenImageId: stateHook.setMobilePopoverOpenImageId,
      onOpenLightbox: actionsHook.handleOpenLightbox,
    },
  });

  const {
    handleNavigateToShot,
    handleVisitShotFromNotifier,
    handleSwitchToAssociatedShot,
    handleShowAllShots,
    handleShowTaskDetails,
  } = galleryHandlers;

  const {
    itemShotWorkflow,
    itemMobileInteraction,
    itemFeatures,
    itemActions,
    itemLoading,
    lightboxDeletingId,
  } = useMediaGalleryItemProps({
    simplifiedShotOptions,
    currentViewingShotId,
    onCreateShot,
    onAddToLastShot,
    onAddToLastShotWithoutPosition,
    showDelete,
    showDownload,
    showShare,
    showEdit,
    showStar,
    showAddToShot,
    enableSingleClick,
    videosAsThumbnails,
    onToggleStar,
    onApplySettings,
    onImageClick,
    isDeleting,
    selectedShotIdLocal: stateHook.state.selectedShotIdLocal,
    setSelectedShotIdLocal: stateHook.setSelectedShotIdLocal,
    onShotChange: actionsHook.handleShotChange,
    showTickForImageId: stateHook.state.showTickForImageId,
    onShowTick: actionsHook.handleShowTick,
    showTickForSecondaryImageId: stateHook.state.showTickForSecondaryImageId,
    onShowSecondaryTick: actionsHook.handleShowSecondaryTick,
    optimisticUnpositionedIds: stateHook.state.optimisticUnpositionedIds,
    optimisticPositionedIds: stateHook.state.optimisticPositionedIds,
    optimisticDeletedIds: stateHook.state.optimisticDeletedIds,
    onOptimisticUnpositioned: stateHook.markOptimisticUnpositioned,
    onOptimisticPositioned: stateHook.markOptimisticPositioned,
    addingToShotImageId: stateHook.state.addingToShotImageId,
    setAddingToShotImageId: stateHook.setAddingToShotImageId,
    addingToShotWithoutPositionImageId: stateHook.state.addingToShotWithoutPositionImageId,
    setAddingToShotWithoutPositionImageId: stateHook.setAddingToShotWithoutPositionImageId,
    mobileActiveImageId: stateHook.state.mobileActiveImageId,
    mobilePopoverOpenImageId: stateHook.state.mobilePopoverOpenImageId,
    onMobileTap: mobileInteractions.handleMobileTap,
    setMobilePopoverOpenImageId: stateHook.setMobilePopoverOpenImageId,
    onOpenLightbox: actionsHook.handleOpenLightbox,
    onDelete: actionsHook.handleOptimisticDelete,
    onDownloadImage: actionsHook.handleDownloadImage,
    activeLightboxMediaId,
    downloadingImageId,
  });

  return {
    handleNavigateToShot,
    handleVisitShotFromNotifier,
    handleSwitchToAssociatedShot,
    handleShowAllShots,
    handleShowTaskDetails,
    itemShotWorkflow,
    itemMobileInteraction,
    itemFeatures,
    itemActions,
    itemLoading,
    lightboxDeletingId,
  };
}
