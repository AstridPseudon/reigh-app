/**
 * ShotImagesEditor - Main editor for shot images in travel-between-images tool.
 *
 * Architecture:
 * - Main component handles Timeline/Batch mode switching and coordination
 * - Hooks handle specific concerns (data, segment slots, transitions, preview, download)
 * - PreviewTogetherDialog: Extracted dialog for previewing all segments together
 * - types.ts: Shared type definitions
 *
 * This component supports both Timeline mode (frame-based positioning) and
 * Batch mode (uniform spacing) for managing shot images.
 */

// Re-export main component
export { default, default as ShotImagesEditor } from '../ShotImagesEditor';

// Re-export sub-components
export { PreviewTogetherDialog } from './components';
export type { PreviewSegment, PreviewTogetherDialogProps } from './components';

// Re-export hooks
export {
  useLightboxTransition,
  useSegmentSlotMode,
  useShotGenerationsData,
  usePreviewSegments,
  useDownloadImages,
  useSmoothContinuations,
} from './hooks';

// Re-export types
export type { ShotImagesEditorProps } from './types';
