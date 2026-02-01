import React from "react";
import { Filter, Sparkles } from "lucide-react";
import { SkeletonGallery } from "@/shared/components/ui/skeleton-gallery";
import { ProgressiveLoadingManager } from "@/shared/components/ProgressiveLoadingManager";
import { ImagePreloadManager } from "@/shared/components/ImagePreloadManager";
import { MediaGalleryItem } from "@/shared/components/MediaGalleryItem";
import { getImageLoadingStrategy } from '@/shared/lib/imageLoadingPriority';
import { GeneratedImageWithMetadata } from '../index';

export interface MediaGalleryGridProps {
  // Data props
  images: GeneratedImageWithMetadata[];
  paginatedImages: GeneratedImageWithMetadata[];
  filteredImages: GeneratedImageWithMetadata[];

  // Layout props
  reducedSpacing?: boolean;
  whiteText?: boolean;
  gridColumnClasses: string;
  columnsPerRow?: number;
  projectAspectRatio?: string;

  // Loading props
  isLoading?: boolean;
  isGalleryLoading: boolean;
  isServerPagination: boolean;

  // Navigation completion - the SINGLE way to clear loading state
  clearNavigation: () => void;

  // Legacy props (kept for backwards compatibility, but prefer clearNavigation)
  setIsGalleryLoading?: (loading: boolean) => void;
  setLoadingButton?: (button: 'prev' | 'next' | null) => void;
  safetyTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  
  // Progressive loading props
  effectivePage: number;
  isMobile: boolean;
  
  // Lightbox state
  isLightboxOpen?: boolean;
  
  // Preloading props
  enableAdjacentPagePreloading?: boolean;
  page: number;
  serverPage?: number;
  totalFilteredItems: number;
  itemsPerPage: number;
  onPrefetchAdjacentPages?: (prevPage: number | null, nextPage: number | null) => void;
  selectedProjectId?: string;
  
  // Filter state for empty states
  hasFilters: boolean;
  
  // Backfill state
  isBackfillLoading?: boolean;
  setIsBackfillLoading?: (loading: boolean) => void;

  // Props for computing skeleton count dynamically
  totalCount?: number;
  offset?: number;
  optimisticDeletedCount?: number;
  
  // Pagination display state
  hideBottomPagination?: boolean;

  // MediaGalleryItem props - passing through all the props it needs
  [key: string]: any; // This allows passing through all other props
}

// Memoized grid component to prevent unnecessary re-renders from parent
const MediaGalleryGridInner: React.FC<MediaGalleryGridProps> = ({
  // Data props
  images,
  paginatedImages,
  filteredImages,

  // Layout props
  reducedSpacing = false,
  whiteText = false,
  gridColumnClasses,
  columnsPerRow = 5,
  projectAspectRatio,

  // Loading props
  isLoading = false,
  isGalleryLoading,
  isServerPagination,

  // Navigation completion - the SINGLE way to clear loading state
  clearNavigation,

  // Legacy props (kept for backwards compatibility)
  setIsGalleryLoading,
  setLoadingButton,
  safetyTimeoutRef,
  
  // Progressive loading props
  effectivePage,
  isMobile,
  
  // Lightbox state
  isLightboxOpen = false,
  
  // Preloading props
  enableAdjacentPagePreloading = true,
  page,
  serverPage,
  totalFilteredItems,
  itemsPerPage,
  onPrefetchAdjacentPages,
  selectedProjectId,
  
  // Filter state
  hasFilters,
  
  // Backfill state
  isBackfillLoading = false,
  setIsBackfillLoading,

  // Props for computing skeleton count dynamically
  totalCount = 0,
  offset = 0,
  optimisticDeletedCount = 0,

  // Pagination display state
  hideBottomPagination = false,

  // Pass through all other props for MediaGalleryItem
  ...itemProps
}) => {

  // === SIMPLE PAGE CHANGE DETECTION ===
  // Create a signature for the current page to detect when new data arrives
  const pageSignature = React.useMemo(() => {
    if (paginatedImages.length === 0) return 'empty';
    const firstId = paginatedImages[0]?.id || 'none';
    const lastId = paginatedImages[paginatedImages.length - 1]?.id || 'none';
    return `${paginatedImages.length}-${firstId}-${lastId}`;
  }, [paginatedImages]);

  const prevPageSignatureRef = React.useRef<string>(pageSignature);
  // Store clearNavigation in a ref to avoid effect dependency issues
  const clearNavigationRef = React.useRef(clearNavigation);
  clearNavigationRef.current = clearNavigation;

  // When page data changes and we're loading, clear navigation immediately
  // This is the moment when the new page becomes visible
  React.useEffect(() => {
    if (prevPageSignatureRef.current !== pageSignature) {
      console.log(`[NAV_STATE] Page signature changed: ${prevPageSignatureRef.current} -> ${pageSignature}, isGalleryLoading: ${isGalleryLoading}`);
      prevPageSignatureRef.current = pageSignature;

      // If we were navigating, we've arrived - clear the loading state
      if (isGalleryLoading) {
        console.log(`[NAV_STATE] Clearing navigation - new page data arrived`);
        clearNavigationRef.current();
      }
    }
  }, [pageSignature, isGalleryLoading]);

  // Clear backfill loading when new data arrives (signature changes while loading)
  const prevSignatureForBackfillRef = React.useRef<string>(pageSignature);
  React.useEffect(() => {
    if (isBackfillLoading && prevSignatureForBackfillRef.current !== pageSignature) {
      console.log('[BackfillV2] Data arrived, clearing backfill loading');
      setIsBackfillLoading?.(false);
    }
    prevSignatureForBackfillRef.current = pageSignature;
  }, [pageSignature, isBackfillLoading, setIsBackfillLoading]);

  // Show full skeleton gallery when loading new data
  if (isLoading) {
    // Match the gap classes used in the actual grid
    const skeletonGapClasses = reducedSpacing ? 'gap-2 sm:gap-4' : 'gap-4';

    return (
      <div className={reducedSpacing ? "" : "min-h-[400px]"}>
        <SkeletonGallery
          count={itemsPerPage}
          fixedColumns={columnsPerRow}
          gapClasses={skeletonGapClasses}
          whiteText={whiteText}
          showControls={false}
          projectAspectRatio={projectAspectRatio}
        />
      </div>
    );
  }

  return (
    <>
      {/* Adjacent Page Preloading Manager - handles preloading in background */}
      <ImagePreloadManager
        enabled={enableAdjacentPagePreloading}
        isServerPagination={isServerPagination}
        page={page}
        serverPage={serverPage}
        totalFilteredItems={totalFilteredItems}
        itemsPerPage={itemsPerPage}
        onPrefetchAdjacentPages={onPrefetchAdjacentPages}
        allImages={filteredImages}
        projectId={selectedProjectId}
        isLightboxOpen={isLightboxOpen}
      />

      {/* Gallery content wrapper with minimum height to prevent layout jump when there are images */}
      <div className={paginatedImages.length > 0 && !reducedSpacing && !hideBottomPagination ? "min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]" : ""}>
        {/* No items match filters message */}
        {images.length > 0 && filteredImages.length === 0 && hasFilters && !isGalleryLoading && (
          <div className={`text-center py-10 mt-6 rounded-lg ${
            whiteText 
              ? "text-zinc-400 border-zinc-700 bg-zinc-800/50" 
              : "text-muted-foreground border bg-card shadow-sm"
          }`}>
            <Filter className={`mx-auto h-10 w-10 mb-3 opacity-60 ${whiteText ? "text-zinc-500" : ""}`} />
            <p className={`font-light ${whiteText ? "text-zinc-300" : ""}`}>No items match the current filters.</p>
            <p className={`text-sm ${whiteText ? "text-zinc-400" : ""}`}>Adjust the filters or clear the search to see all items.</p>
          </div>
        )}

        {/* No images generated yet message */}
        {images.length === 0 && !isGalleryLoading && (
           <div className={`text-center py-12 mt-8 rounded-lg ${
             whiteText 
               ? "text-zinc-400 border-zinc-700 bg-zinc-800/50" 
               : "text-muted-foreground border bg-card shadow-sm"
           }`}>
             <Sparkles className={`mx-auto h-10 w-10 mb-3 opacity-60 ${whiteText ? "text-zinc-500" : ""}`} />
             <p className={`font-light ${whiteText ? "text-zinc-300" : ""}`}>No images generated yet.</p>
             <p className={`text-sm ${whiteText ? "text-zinc-400" : ""}`}>Use the controls above to generate some images.</p>
           </div>
        )}

        {/* Images grid */}
        {paginatedImages.length > 0 && (
          <ProgressiveLoadingManager
            images={paginatedImages}
            page={effectivePage}
            enabled={true}
            isMobile={isMobile}
            isLightboxOpen={isLightboxOpen}
            instanceId={`gallery-${isServerPagination ? (serverPage || 1) : page}`}
            onImagesReady={() => {
              // Clear backfill loading when images are ready to display
              if (isBackfillLoading && setIsBackfillLoading) {
                console.log('[BackfillV2] ProgressiveLoadingManager - images ready, clearing loading');
                setIsBackfillLoading(false);
              }
            }}
          >
            {(showImageIndices) => (
              <div>
                <div
                  className={`grid ${reducedSpacing ? 'gap-2 sm:gap-4' : 'gap-4'} ${(reducedSpacing || hideBottomPagination) ? 'mb-0' : 'mb-12'}`}
                  style={{ gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))` }}
                  data-tour="gallery-grid"
                >
                  {paginatedImages.map((image, index) => {
                    const shouldShow = showImageIndices.has(index);
                    
                    // Use unified loading strategy system
                    const loadingStrategy = getImageLoadingStrategy(index, {
                      isMobile,
                      totalImages: paginatedImages.length,
                      isPreloaded: false // Will be checked inside the component
                    });
                    
                    // Debug logging disabled for performance (was causing excessive re-renders)
                    // if (index < 8 || (loadingStrategy.shouldLoadInInitialBatch && !shouldShow)) {
                    //   console.log(`[GalleryDebug] 🖼️ Image ${index} render:`, {
                    //     imageId: image.id?.substring(0, 8),
                    //     shouldShow,
                    //     batchGroup: loadingStrategy.batchGroup,
                    //     shouldLoadInInitialBatch: loadingStrategy.shouldLoadInInitialBatch,
                    //     showImageIndicesSize: showImageIndices.size,
                    //     showImageIndicesArray: Array.from(showImageIndices).slice(0, 10),
                    //     isGalleryLoading
                    //   });
                    // }
                    
                    return (
                      <MediaGalleryItem
                        key={image.id || `image-${index}`}
                        image={image}
                        index={index}
                        shouldLoad={shouldShow}
                        isPriority={loadingStrategy.shouldLoadInInitialBatch}
                        isGalleryLoading={isGalleryLoading}
                        isMobile={isMobile}
                        projectAspectRatio={projectAspectRatio}
                        {...itemProps}
                      />
                    );
                  })}
                  
                </div>
              </div>
            )}
          </ProgressiveLoadingManager>
        )}
      </div>
    </>
  );
};

// Wrap in React.memo with default shallow comparison
// This prevents re-renders when parent re-renders but props are referentially equal
export const MediaGalleryGrid = React.memo(MediaGalleryGridInner);
