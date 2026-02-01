/**
 * MediaLightbox - Modular Component with Type-Specialized Branches
 *
 * Architecture:
 * - MediaLightbox: Thin dispatcher that routes to specialized components
 * - ImageLightbox: Handles image-specific features (inpaint, upscale, reposition)
 * - VideoLightbox: Handles video-specific features (trim, regenerate, enhance)
 * - useSharedLightboxState: Consolidated hooks shared by both branches
 *
 * Available Hooks (all in ./hooks/):
 * - useSharedLightboxState: Consolidated shared state (variants, nav, star, etc.)
 * - useUpscale: Image upscaling with localStorage persistence
 * - useInpainting: Canvas-based inpainting with mask generation
 * - useRepositionMode: Image repositioning, scaling, rotation, and flipping
 * - useReferences: Adding images to project references with processing
 * - useGenerationLineage: Fetching source/derived generations
 * - useShotCreation: Atomic shot creation with images
 * - useLightboxNavigation: Keyboard controls and safe closing
 * - useStarToggle: Star toggle with optimistic UI updates
 * - useShotPositioning: Shot positioning checks and navigation
 * - useLightboxVideoMode: Consolidated video editing hooks
 *
 * Available Components (all in ./components/):
 * - MediaDisplay: Image/video rendering with progressive loading
 * - NavigationButtons: Left/right navigation arrows
 * - InpaintControlsPanel: Inpainting UI
 * - TaskDetailsSection: Generation lineage display
 * - MediaControls: Top control bar
 * - WorkflowControls: Bottom control bar
 *
 * Available Utils (all in ./utils/):
 * - downloadMedia: Media download with timeout handling
 */

// Export the main implementation
export { default } from './MediaLightbox';
export type { MediaLightboxProps, ShotOption } from './MediaLightbox';

// Export specialized lightbox components (used internally by MediaLightbox dispatcher)
export { ImageLightbox } from './ImageLightbox';
export type { ImageLightboxProps } from './ImageLightbox';
export { VideoLightbox } from './VideoLightbox';
export type { VideoLightboxProps } from './VideoLightbox';

// Re-export hooks for use in other components
export {
  useUpscale,
  useInpainting,
  useReferences,
  useGenerationLineage,
  useShotCreation,
  useLightboxNavigation,
  useStarToggle,
  useShotPositioning,
  useSharedLightboxState,
  useLightboxVideoMode,
} from './hooks';

// Re-export hook types
export type {
  UseSharedLightboxStateProps,
  UseSharedLightboxStateReturn,
  UseLightboxVideoModeProps,
  UseLightboxVideoModeReturn,
} from './hooks';

// Re-export components for use elsewhere
export {
  MediaDisplay,
  NavigationButtons,
  InpaintControlsPanel,
  TaskDetailsSection,
} from './components';

// Re-export utils
export { downloadMedia } from './utils';
