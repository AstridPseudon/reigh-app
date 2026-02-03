/**
 * VideoTrimEditor Module
 *
 * Provides video trimming functionality for segment videos.
 * Uses server-side Edge Function (trim-video) for MP4 conversion with proper duration metadata.
 *
 * Usage:
 * ```tsx
 * import { useVariants, useVideoTrimming, useTrimSave } from '@/shared/components/VideoTrimEditor/hooks';
 * import { TrimControlsPanel, VariantSelector, TrimTimelineBar } from '@/shared/components/VideoTrimEditor/components';
 * ```
 */

// Re-export hooks
export * from './hooks';

// Re-export components
export * from './components';

// Re-export types
export * from './types';
