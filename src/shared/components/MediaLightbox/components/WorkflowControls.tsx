import React from 'react';
import type { ShotOption } from '@/domains/generation/types';
import type { LightboxDeleteHandler } from '../types';
import { WorkflowControlsBar } from './WorkflowControlsBar';

export interface WorkflowControlsProps {
  // Media info
  mediaId: string;
  imageUrl?: string;
  thumbUrl?: string;
  isVideo: boolean;
  
  // Mode state  
  isInpaintMode?: boolean; // Optional - for defensive rendering (parent already checks)
  
  // Shot selection
  allShots: ShotOption[];
  selectedShotId: string | undefined;
  onShotChange?: (shotId: string) => void;
  onCreateShot?: (shotName: string, files: File[]) => Promise<{shotId?: string; shotName?: string} | void>;
  contentRef: React.RefObject<HTMLDivElement>;
  
  // Shot positioning
  isAlreadyPositionedInSelectedShot: boolean;
  isAlreadyAssociatedWithoutPosition: boolean;
  showTickForImageId?: string | null;
  showTickForSecondaryImageId?: string | null;
  
  // Shot actions
  // CRITICAL: targetShotId is the shot selected in the DROPDOWN, not the shot being viewed
  onAddToShot?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  onAddToShotWithoutPosition?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  
  // Optimistic updates
  onShowTick?: (imageId: string) => void;
  onOptimisticPositioned?: (imageId: string, shotId: string) => void;
  onShowSecondaryTick?: (imageId: string) => void;
  onOptimisticUnpositioned?: (imageId: string, shotId: string) => void;
  
  // Loading states
  isAdding?: boolean;
  isAddingWithoutPosition?: boolean;
  
  // Other actions
  onApplySettings?: (metadata: Record<string, unknown>) => void;
  handleApplySettings: () => void;
  onDelete?: LightboxDeleteHandler;
  handleDelete: () => Promise<void>;
  isDeleting?: string | null;
  
  // Navigation
  onNavigateToShot?: (shot: ShotOption) => void;
  
  // Close lightbox
  onClose?: () => void;
}

/**
 * WorkflowControls Component
 * Compatibility adapter for centered-layout controls.
 * Delegates to WorkflowControlsBar so all layouts share one implementation path.
 */
export const WorkflowControls: React.FC<WorkflowControlsProps> = ({
  mediaId,
  imageUrl,
  thumbUrl,
  isVideo,
  isInpaintMode,
  allShots,
  selectedShotId,
  onShotChange,
  onCreateShot,
  contentRef,
  isAlreadyPositionedInSelectedShot,
  isAlreadyAssociatedWithoutPosition,
  showTickForImageId,
  showTickForSecondaryImageId,
  onAddToShot,
  onAddToShotWithoutPosition,
  onShowTick,
  onOptimisticPositioned,
  onShowSecondaryTick,
  onOptimisticUnpositioned,
  isAdding = false,
  isAddingWithoutPosition = false,
  onApplySettings,
  handleApplySettings,
  onDelete,
  onClose,
  onNavigateToShot,
}) => (
  <WorkflowControlsBar
    onAddToShot={onAddToShot}
    onDelete={onDelete}
    onApplySettings={onApplySettings}
    isSpecialEditMode={Boolean(isInpaintMode)}
    isVideo={isVideo}
    mediaId={mediaId}
    imageUrl={imageUrl}
    thumbUrl={thumbUrl}
    allShots={allShots}
    selectedShotId={selectedShotId}
    onShotChange={onShotChange}
    onCreateShot={onCreateShot}
    isAlreadyPositionedInSelectedShot={isAlreadyPositionedInSelectedShot}
    isAlreadyAssociatedWithoutPosition={isAlreadyAssociatedWithoutPosition}
    showTickForImageId={showTickForImageId}
    showTickForSecondaryImageId={showTickForSecondaryImageId}
    onAddToShotWithoutPosition={onAddToShotWithoutPosition}
    onShowTick={onShowTick}
    onOptimisticPositioned={onOptimisticPositioned}
    onShowSecondaryTick={onShowSecondaryTick}
    onOptimisticUnpositioned={onOptimisticUnpositioned}
    isAdding={isAdding}
    isAddingWithoutPosition={isAddingWithoutPosition}
    contentRef={contentRef}
    handleApplySettings={handleApplySettings}
    onNavigateToShot={onNavigateToShot}
    onClose={onClose}
  />
);
