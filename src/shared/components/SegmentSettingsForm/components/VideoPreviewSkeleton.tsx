/**
 * VideoPreviewSkeleton Component
 *
 * A skeleton loader for 3-frame video previews, used while structure video
 * frames are being loaded/extracted.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface VideoPreviewSkeletonProps {
  /** Loading message to display */
  message?: string;
  /** Whether to show the loading spinner */
  showSpinner?: boolean;
}

export const VideoPreviewSkeleton: React.FC<VideoPreviewSkeletonProps> = ({
  message = 'Loading video...',
  showSpinner = true,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {showSpinner && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        <span>{message}</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 relative">
            <div className="w-full aspect-video bg-muted/50 rounded animate-pulse" />
            <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/60 text-white py-0.5 rounded-b">
              {i === 0 ? 'Start' : i === 1 ? 'Mid' : 'End'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoPreviewSkeleton;
