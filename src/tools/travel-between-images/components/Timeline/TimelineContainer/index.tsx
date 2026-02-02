/**
 * TimelineContainer - Main timeline UI for the travel-between-images tool
 *
 * Architecture:
 * - TimelineContainer.tsx: Main component orchestrating timeline display and interactions
 * - components/: Extracted UI sub-components (ZoomControls, GuidanceVideoControls, etc.)
 * - types.ts: Shared type definitions
 *
 * Related hooks live in ../hooks/ (shared across Timeline components)
 */

export { default } from './TimelineContainer';
export { default as TimelineContainer } from './TimelineContainer';
export type { TimelineContainerProps, PairData } from './types';

// Re-export sub-components for external use if needed
export { ZoomControls } from './components';
export { GuidanceVideoControls } from './components';
export { TimelineBottomControls } from './components';
export { TimelineSkeletonItem } from './components';
export { PendingFrameMarker } from './components';
export { AddAudioButton } from './components';
