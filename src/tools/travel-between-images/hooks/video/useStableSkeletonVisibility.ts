import { useState, useEffect, useRef } from 'react';

export const useStableSkeletonVisibility = (
  isLoading: boolean,
  hideDelay: number = 120
): boolean => {
  const [showStableSkeleton, setShowStableSkeleton] = useState<boolean>(false);
  const hideTimeoutRef = useRef<number | null>(null);
  const lastLoadingStateRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (isLoading !== lastLoadingStateRef.current) {
      lastLoadingStateRef.current = isLoading;
      
      if (isLoading) {
        if (hideTimeoutRef.current) {
          window.clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        setShowStableSkeleton(true);
      } else {
        hideTimeoutRef.current = window.setTimeout(() => {
          setShowStableSkeleton(false);
          hideTimeoutRef.current = null;
        }, hideDelay);
      }
    }
    
    return () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [isLoading, hideDelay]);

  return showStableSkeleton;
};
