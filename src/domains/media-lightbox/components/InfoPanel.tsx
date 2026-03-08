/**
 * InfoPanel Component
 *
 * Unified info panel for both desktop and mobile layouts.
 * Shows task details, variants, and Info/Edit toggle controls.
 *
 * Uses context hooks for shared state (core, media, edit, variants).
 * Receives only layout-specific and deeply-nested props.
 */

import React from 'react';
import { SegmentedControl, SegmentedControlItem } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/components/ui/contracts/cn';

import { TaskDetailsPanelWrapper } from './TaskDetailsPanelWrapper';
import { VariantSelector } from '@/shared/components/VariantSelector';
import { PanelCloseButton, PanelHeaderMeta } from './PanelHeaderControls';
import {
  useLightboxCoreSafe,
  useLightboxMediaSafe,
  useLightboxVariantsSafe,
} from '../contexts/LightboxStateContext';
import { useImageEditCanvasSafe } from '../contexts/ImageEditCanvasContext';
import { useVideoEditSafe } from '../contexts/VideoEditContext';
import type { GenerationRow } from '@/domains/generation/types';
import type { TaskDetailsData } from '../types';
import { useCopyToClipboard } from '@/shared/hooks/clipboard/useCopyToClipboard';
import type { DerivedItem } from '@/domains/generation/hooks/useDerivedItems';

interface InfoPanelTaskPanelModel {
  taskDetailsData: TaskDetailsData | undefined;
  derivedItems: DerivedItem[];
  derivedGenerations: GenerationRow[] | null;
  paginatedDerived: DerivedItem[];
  derivedPage: number;
  derivedTotalPages: number;
  onSetDerivedPage: (page: number) => void;
  onNavigateToGeneration?: (generationId: string, derivedContext?: string[]) => Promise<void>;
  currentMediaId: string;
  currentShotId?: string;
  replaceImages: boolean;
  onReplaceImagesChange: (value: boolean) => void;
  onSwitchToPrimary?: () => void;
}

interface InfoPanelProps {
  /** Layout variant */
  variant: 'desktop' | 'mobile';

  // Header toggle - only specialized props now
  showImageEditTools: boolean;

  // TaskDetailsPanelWrapper model (deeply nested data)
  taskPanel: InfoPanelTaskPanelModel;

  /** Task ID for copy functionality (fallback when not in taskDetailsData) */
  taskId?: string | null;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  variant,
  // Header props
  showImageEditTools,
  // TaskDetails model
  taskPanel,
  // Task ID fallback
  taskId: taskIdProp,
}) => {
  const {
    taskDetailsData,
    derivedItems,
    derivedGenerations,
    paginatedDerived,
    derivedPage,
    derivedTotalPages,
    onSetDerivedPage,
    onNavigateToGeneration,
    currentMediaId,
    currentShotId,
    replaceImages,
    onReplaceImagesChange,
    onSwitchToPrimary,
  } = taskPanel;
  const isMobile = variant === 'mobile';

  // ========================================
  // CONTEXT STATE (no longer from props)
  // ========================================
  const { onClose, readOnly } = useLightboxCoreSafe();
  const { isVideo } = useLightboxMediaSafe();
  const { isInpaintMode, handleEnterInpaintMode, handleExitInpaintMode } = useImageEditCanvasSafe();
  const { isInVideoEditMode, handleEnterVideoEditMode, handleExitVideoEditMode } = useVideoEditSafe();
  const {
    variants,
    activeVariant,
    primaryVariant,
    handleVariantSelect: onVariantSelect,
    handleMakePrimary: onMakePrimary,
    isLoadingVariants,
    variantsSectionRef,
    pendingTaskCount,
    unviewedVariantCount,
    onMarkAllViewed,
    handlePromoteToGeneration: onPromoteToGeneration,
    isPromoting,
    handleDeleteVariant: onDeleteVariant,
    onLoadVariantSettings,
    onLoadVariantImages,
    currentSegmentImages,
  } = useLightboxVariantsSafe();

  const hasVariants = variants && variants.length >= 1;

  // Get task ID for copy functionality - use prop as fallback for videos
  const taskId = taskDetailsData?.taskId || taskIdProp;
  const { copied: idCopied, handleCopy: handleCopyId } = useCopyToClipboard(taskId ?? undefined);

  // Render the Info/Edit toggle (shared for image and video modes)
  const renderEditToggle = () => {
    // Determine which edit mode applies
    const isImageEdit = showImageEditTools && !isVideo;
    const isVideoEdit = isVideo;

    if (readOnly || (!isImageEdit && !isVideoEdit)) return null;

    const isActive = isImageEdit ? isInpaintMode : isInVideoEditMode;
    const handleEnter = isImageEdit ? handleEnterInpaintMode : handleEnterVideoEditMode;
    const handleExit = isImageEdit ? handleExitInpaintMode : handleExitVideoEditMode;

    return (
      <SegmentedControl
        value={isActive ? 'edit' : 'info'}
        onValueChange={(value) => {
          if (value === 'info' && isActive) {
            handleExit();
          } else if (value === 'edit' && !isActive) {
            handleEnter();
          }
        }}
      >
        <SegmentedControlItem value="info">Info</SegmentedControlItem>
        <SegmentedControlItem value="edit">Edit</SegmentedControlItem>
      </SegmentedControl>
    );
  };

  // Render the header - consistent single row layout for both mobile and desktop
  const renderHeader = () => (
    <div className={cn(
      "flex-shrink-0 border-b border-border bg-background",
      isMobile ? "sticky top-0 z-[80] px-3 py-2" : "p-4"
    )}>
      {/* Single row: ID + variants on left, toggle + close on right */}
      <div className={cn(
        "flex items-center justify-between",
        isMobile ? "gap-2" : "gap-3"
      )}>
        <PanelHeaderMeta
          taskId={taskId}
          idCopied={idCopied}
          onCopyId={handleCopyId}
          hasVariants={hasVariants}
          variants={variants}
          pendingTaskCount={pendingTaskCount}
          unviewedVariantCount={unviewedVariantCount}
          onMarkAllViewed={onMarkAllViewed}
          variantsSectionRef={variantsSectionRef}
        />

        {/* Right side - toggles and close button */}
        <div className="flex items-center gap-3">
          {renderEditToggle()}
          <PanelCloseButton
            isMobile={isMobile}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );

  // Render task details wrapper
  const renderTaskDetails = () => (
    <TaskDetailsPanelWrapper
      taskDetailsData={taskDetailsData}
      derivedItems={derivedItems}
      derivedGenerations={derivedGenerations}
      paginatedDerived={paginatedDerived}
      derivedPage={derivedPage}
      derivedTotalPages={derivedTotalPages}
      onSetDerivedPage={onSetDerivedPage}
      onNavigateToGeneration={onNavigateToGeneration}
      onVariantSelect={onVariantSelect}
      currentMediaId={currentMediaId}
      currentShotId={currentShotId}
      replaceImages={replaceImages}
      onReplaceImagesChange={onReplaceImagesChange}
      onClose={onClose}
      variant={variant}
      activeVariant={activeVariant}
      primaryVariant={primaryVariant}
      onSwitchToPrimary={onSwitchToPrimary}
    />
  );

  // Render variants section - matches EditPanelLayout styling
  const renderVariants = () => {
    if (!hasVariants) return null;

    // Match EditPanelLayout: border-t, consistent padding
    const variantPadding = isMobile ? 'pt-2 mt-2 px-3 pb-2' : 'pt-4 mt-4 p-6';

    return (
      <div
        ref={variantsSectionRef}
        className={cn("border-t border-border", variantPadding)}
      >
        <VariantSelector
          variants={variants}
          activeVariantId={activeVariant?.id || null}
          onVariantSelect={onVariantSelect}
          onMakePrimary={onMakePrimary}
          isLoading={isLoadingVariants}
          onPromoteToGeneration={onPromoteToGeneration}
          isPromoting={isPromoting}
          onDeleteVariant={onDeleteVariant}
          onLoadVariantSettings={onLoadVariantSettings}
          onLoadVariantImages={onLoadVariantImages}
          currentSegmentImages={currentSegmentImages}
          readOnly={readOnly}
        />
      </div>
    );
  };

  // Both desktop and mobile: variants inside scroll area (matches EditPanelLayout)
  return (
    <div className={cn("w-full flex flex-col", !isMobile && "h-full")}>
      {renderHeader()}

      {/* Scrollable content area - contains both task details and variants */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-none">
        {renderTaskDetails()}
        {renderVariants()}
      </div>
    </div>
  );
};
