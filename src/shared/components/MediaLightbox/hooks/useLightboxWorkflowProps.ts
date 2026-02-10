/**
 * useLightboxWorkflowProps - Builds workflow, panel, and navigation props
 *
 * Edit mode state → ImageEditContext, video edit state → VideoEditContext,
 * controlsPanelProps → built in each caller (ImageLightbox/VideoLightbox).
 * This hook only composes workflowBarProps + workflowControlsProps + layout chrome.
 */

import { useMemo, RefObject, ReactNode } from 'react';
import type { AdjacentSegmentsData, SegmentSlotModeData } from '../types';
import type { LightboxLayoutProps } from '../components/layouts/types';

// Input types - workflow + panel + navigation
interface UseLightboxWorkflowPropsInput {
  // Panel
  showPanel: boolean;
  shouldShowSidePanel: boolean;
  effectiveTasksPaneOpen: boolean;
  effectiveTasksPaneWidth: number;

  // Button group props (pre-built)
  buttonGroupProps: {
    topLeft: ReactNode;
    topRight: ReactNode;
    bottomLeft: ReactNode;
    bottomRight: ReactNode;
  };

  // Workflow props
  allShots: Array<{ id: string; name: string }>;
  selectedShotId?: string;
  onAddToShot?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  onAddToShotWithoutPosition?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  onDelete?: (id: string) => void;
  onApplySettings?: (metadata: Record<string, unknown>) => void;
  onShotChange?: (shotId: string) => void;
  onCreateShot?: (shotName: string, files: File[]) => Promise<{ shotId?: string; shotName?: string } | void>;
  showTickForImageId?: string | null;
  showTickForSecondaryImageId?: string | null;
  onShowTick?: (imageId: string) => void;
  onShowSecondaryTick?: (imageId: string) => void;
  onOptimisticPositioned?: (mediaId: string, shotId: string) => void;
  onOptimisticUnpositioned?: (mediaId: string, shotId: string) => void;
  isAlreadyPositionedInSelectedShot: boolean;
  isAlreadyAssociatedWithoutPosition: boolean;
  contentRef: RefObject<HTMLDivElement>;
  handleApplySettings: () => void;
  handleNavigateToShotFromSelector: (shot: { id: string; name: string }) => void;
  handleAddVariantAsNewGenerationToShot: (shotId: string, variantId: string, currentTimelineFrame?: number) => Promise<boolean>;

  // Workflow controls (below-media, centered layout only)
  isDeleting?: string | null;
  handleDelete: () => void;

  // Adjacent segment navigation
  adjacentSegments?: AdjacentSegmentsData;

  // Segment slot mode (for constituent image navigation)
  segmentSlotMode?: SegmentSlotModeData;
}

interface UseLightboxWorkflowPropsReturn {
  layoutProps: LightboxLayoutProps;
}

export function useLightboxWorkflowProps(
  input: UseLightboxWorkflowPropsInput
): UseLightboxWorkflowPropsReturn {
  // Build workflow bar props (shared across all layouts)
  const workflowBarProps = useMemo(() => ({
    onAddToShot: input.onAddToShot,
    onDelete: input.onDelete,
    onApplySettings: input.onApplySettings,
    allShots: input.allShots,
    selectedShotId: input.selectedShotId,
    onShotChange: input.onShotChange,
    onCreateShot: input.onCreateShot,
    isAlreadyPositionedInSelectedShot: input.isAlreadyPositionedInSelectedShot,
    isAlreadyAssociatedWithoutPosition: input.isAlreadyAssociatedWithoutPosition,
    showTickForImageId: input.showTickForImageId,
    showTickForSecondaryImageId: input.showTickForSecondaryImageId,
    onAddToShotWithoutPosition: input.onAddToShotWithoutPosition,
    onShowTick: input.onShowTick,
    onShowSecondaryTick: input.onShowSecondaryTick,
    onOptimisticPositioned: input.onOptimisticPositioned,
    onOptimisticUnpositioned: input.onOptimisticUnpositioned,
    contentRef: input.contentRef,
    handleApplySettings: input.handleApplySettings,
    handleNavigateToShotFromSelector: input.handleNavigateToShotFromSelector,
    handleAddVariantAsNewGenerationToShot: input.handleAddVariantAsNewGenerationToShot,
  }), [
    input.onAddToShot, input.onDelete, input.onApplySettings, input.allShots,
    input.selectedShotId, input.onShotChange, input.onCreateShot,
    input.isAlreadyPositionedInSelectedShot, input.isAlreadyAssociatedWithoutPosition,
    input.showTickForImageId, input.showTickForSecondaryImageId,
    input.onAddToShotWithoutPosition, input.onShowTick, input.onShowSecondaryTick,
    input.onOptimisticPositioned, input.onOptimisticUnpositioned, input.contentRef,
    input.handleApplySettings, input.handleNavigateToShotFromSelector,
    input.handleAddVariantAsNewGenerationToShot,
  ]);

  // Build workflow controls props (below-media, centered layout only)
  const workflowControlsProps = useMemo(() => ({
    ...workflowBarProps,
    isDeleting: input.isDeleting,
    handleDelete: input.handleDelete,
  }), [workflowBarProps, input.isDeleting, input.handleDelete]);

  // Build unified layout props
  // Note: controlsPanelProps is built in the caller (ImageLightbox/VideoLightbox)
  // and passed directly to LightboxLayout.
  const layoutProps: LightboxLayoutProps = useMemo(() => ({
    showPanel: input.showPanel,
    shouldShowSidePanel: input.shouldShowSidePanel,
    // Panel
    effectiveTasksPaneOpen: input.effectiveTasksPaneOpen,
    effectiveTasksPaneWidth: input.effectiveTasksPaneWidth,
    // Composed props
    buttonGroupProps: input.buttonGroupProps,
    workflowBarProps,
    workflowControlsProps: input.showPanel ? undefined : workflowControlsProps,
    // Navigation
    adjacentSegments: input.adjacentSegments,
    segmentSlotMode: input.segmentSlotMode,
  }), [
    input.showPanel, input.shouldShowSidePanel,
    input.effectiveTasksPaneOpen, input.effectiveTasksPaneWidth,
    input.buttonGroupProps, workflowBarProps,
    workflowControlsProps, input.adjacentSegments, input.segmentSlotMode,
  ]);

  return { layoutProps };
}
