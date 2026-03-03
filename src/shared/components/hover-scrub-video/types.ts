import type React from 'react';

export interface HoverScrubVideoProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onTouchEnd' | 'onLoadStart' | 'onLoadedData'> {
  /**
   * Source URL for the video. Can be a full URL or relative path handled by getDisplayUrl.
   */
  src: string;
  /**
   * Optional poster (thumbnail) URL.
   */
  poster?: string;
  /**
   * Extra className applied to the root div.
   */
  className?: string;
  /**
   * Extra className applied to the underlying <video> element.
   */
  videoClassName?: string;
  /**
   * Loop the video (defaults to true).
   */
  loop?: boolean;
  /**
   * Mute the video (defaults to true).
   */
  muted?: boolean;
  /**
   * Handle double-click events (desktop only).
   */
  onDoubleClick?: () => void;
  /**
   * Handle touch end events (mobile only).
   */
  onTouchEnd?: (e: React.TouchEvent<HTMLVideoElement>) => void;
  preload?: 'auto' | 'metadata' | 'none';
  showSpeedControls?: boolean;
  showNativeControls?: boolean;
  speedControlsPosition?: 'top-left' | 'bottom-center';
  /**
   * Disable scrubbing behavior for lightbox/fullscreen usage (defaults to false).
   */
  disableScrubbing?: boolean;
  /**
   * Load video content on demand (first hover/interaction) for better performance
   */
  loadOnDemand?: boolean;
  /**
   * Lightweight thumbnail mode: disables scrubbing and heavy listeners/logging,
   * uses preload="none" for minimal overhead. Ideal for small previews.
   */
  thumbnailMode?: boolean;
  /**
   * Autoplays video on hover, disabling scrubbing (defaults to false).
   */
  autoplayOnHover?: boolean;
  /**
   * If true, do not set video src until user interaction. Only the poster is shown.
   */
  posterOnlyUntilClick?: boolean;
  /**
   * When true, toggle play/pause on click (helpful on mobile where hover is absent)
   */
  playOnClick?: boolean;
  /**
   * Callback for video load error
   */
  onVideoError?: React.ReactEventHandler<HTMLVideoElement>;
  /**
   * Callback for video load start
   */
  onLoadStart?: React.ReactEventHandler<HTMLVideoElement>;
  /**
   * Callback for video loaded data
   */
  onLoadedData?: React.ReactEventHandler<HTMLVideoElement>;
}
