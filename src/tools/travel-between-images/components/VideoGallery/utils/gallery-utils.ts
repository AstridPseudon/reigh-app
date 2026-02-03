import { GenerationRow } from '@/types/shots';

// Re-export from shared for backwards compatibility
export { extractSegmentImages, type SegmentImageInfo } from '@/shared/lib/galleryUtils';

/**
 * Mobile double-tap detection logic with video preloading on first tap
 */
export const createMobileTapHandler = (
  lastTouchTimeRef: React.MutableRefObject<number>,
  doubleTapTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
  onLightboxOpen: (index: number) => void,
  onFirstTapPreload?: (index: number) => void
) => {
  return (originalIndex: number) => {
    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - lastTouchTimeRef.current;
    
    console.log('[MobileTapFlow] createMobileTapHandler INVOKED', {
      originalIndex,
      currentTime,
      lastTouchTime: lastTouchTimeRef.current,
      timeSinceLastTap,
      isDoubleTap: timeSinceLastTap < 300 && timeSinceLastTap > 0,
      hasOnFirstTapPreload: !!onFirstTapPreload,
      onLightboxOpenType: typeof onLightboxOpen,
      timestamp: Date.now()
    });
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // This is a double-tap, clear any pending timeout and open lightbox
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
        doubleTapTimeoutRef.current = null;
      }
      console.log('[MobileTapFlow] ✅ DOUBLE-TAP detected - calling onLightboxOpen', {
        originalIndex,
        timeSinceLastTap,
        timestamp: Date.now()
      });
      onLightboxOpen(originalIndex);
      console.log('[MobileTapFlow] ✅ onLightboxOpen RETURNED', {
        originalIndex,
        timestamp: Date.now()
      });
    } else {
      // This is a single tap, start preloading the video for faster lightbox experience
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
      }
      
      // NEW: Start preloading video immediately on first tap
      if (onFirstTapPreload) {
        console.log('[MobileTapFlow] First tap detected - starting video preload', {
          originalIndex,
          timeSinceLastTap,
          timestamp: Date.now()
        });
        onFirstTapPreload(originalIndex);
      } else {
        console.log('[MobileTapFlow] First tap detected - NO preload callback', {
          originalIndex,
          timeSinceLastTap,
          timestamp: Date.now()
        });
      }
      
      doubleTapTimeoutRef.current = setTimeout(() => {
        // Single tap timeout - video preloading continues in background
        console.log('[MobileTapFlow] Single tap timeout - video continues preloading', {
          originalIndex,
          timestamp: Date.now()
        });
        doubleTapTimeoutRef.current = null;
      }, 300);
    }
    
    lastTouchTimeRef.current = currentTime;
  };
};

/**
 * Handle hover preview opening details
 */
export const createHoverDetailsHandler = (
  hoveredVideo: GenerationRow | null,
  sortedVideoOutputs: GenerationRow[],
  isMobile: boolean,
  setSelectedVideoForDetails: (video: GenerationRow | null) => void,
  setLightboxIndex: (index: number | null) => void,
  handleHoverEnd: () => void
) => {
  return () => {
    if (hoveredVideo) {
      if (isMobile) {
        // On mobile, open the modal for better UX
        setSelectedVideoForDetails(hoveredVideo);
      } else {
        // On desktop, open the lightbox
        const videoIndex = sortedVideoOutputs.findIndex(v => v.id === hoveredVideo.id);
        if (videoIndex !== -1) {
          setLightboxIndex(videoIndex);
        }
      }
      // Clear hover state when opening details
      handleHoverEnd();
    }
  };
};

/**
 * Create stable callback for showing task details
 */
export const createTaskDetailsHandler = (
  lightboxIndex: number | null,
  sortedVideoOutputs: GenerationRow[],
  setSelectedVideoForDetails: (video: GenerationRow | null) => void,
  setShowTaskDetailsModal: (show: boolean) => void,
  setLightboxIndex: (index: number | null) => void
) => {
  return () => {
    console.log('[TaskToggle] VideoOutputsGallery: handleShowTaskDetails called', { 
      lightboxIndex, 
      video: sortedVideoOutputs[lightboxIndex || 0]?.id,
    });
    const currentVideo = sortedVideoOutputs[lightboxIndex || 0];
    if (currentVideo) {
      // Set up task details modal state first
      setSelectedVideoForDetails(currentVideo);
      // Use setTimeout to ensure state update happens before opening modal
      setTimeout(() => {
        setShowTaskDetailsModal(true);
        // Close lightbox after modal is set to open
        setLightboxIndex(null);
        console.log('[TaskToggle] VideoOutputsGallery: State updated for task details modal', {
          newSelectedVideo: currentVideo.id,
          newShowModal: true,
          closedLightbox: true
        });
      }, 100);
    } else {
      console.error('[TaskToggle] VideoOutputsGallery: No current video found for lightboxIndex:', lightboxIndex);
    }
  };
};
