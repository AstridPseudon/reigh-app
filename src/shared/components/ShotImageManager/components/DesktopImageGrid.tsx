import React from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { SegmentSlot } from '@/shared/hooks/segments';
import type { useBatchOperations } from '@/shared/components/ShotImageManager/hooks/useBatchOperations';
import type { useDragAndDrop } from '@/shared/components/ShotImageManager/hooks/useDragAndDrop';
import type { useLightbox } from '@/shared/components/ShotImageManager/hooks/useLightbox';
import type { useSelection } from '@/shared/components/ShotImageManager/hooks/useSelection';
import type { useVideoScrubbing } from '@/shared/hooks/useVideoScrubbing';
import type { GenerationRow } from '@/domains/generation/types';
import type { ShotImageManagerProps } from '@/shared/components/ShotImageManager/types';
import BatchDropZone from '@/shared/components/ShotImageManager/components/BatchDropZone';
import { DeleteConfirmationDialog } from '@/shared/components/ShotImageManager/components/DeleteConfirmationDialog';
import { ImageGrid } from '@/shared/components/ShotImageManager/components/ImageGrid';
import { SelectionActionBar } from '@/shared/components/ShotImageManager/components/SelectionActionBar';
import {
  MultiImagePreview,
  SingleImagePreview,
} from '@/shared/components/ImageDragPreview';

interface DesktopImageGridProps {
  managerProps: ShotImageManagerProps;
  currentImages: GenerationRow[];
  columns: number;
  gridColsClass: string;
  isMobile: boolean;
  dragAndDrop: ReturnType<typeof useDragAndDrop>;
  selection: ReturnType<typeof useSelection>;
  lightbox: ReturnType<typeof useLightbox>;
  batchOps: ReturnType<typeof useBatchOperations>;
  getFramePositionForIndex: (index: number) => number | undefined;
  segmentSlots?: SegmentSlot[];
  onSegmentClick?: (slotIndex: number) => void;
  hasPendingTask?: (pairShotGenerationId: string | null | undefined) => boolean;
  onSegmentDelete?: (generationId: string) => void;
  deletingSegmentId?: string | null;
  activeScrubbingIndex: number | null;
  onScrubbingStart: (index: number, segmentRect: DOMRect) => void;
  scrubbing: ReturnType<typeof useVideoScrubbing>;
  lightboxPanel?: React.ReactNode;
}

export function DesktopImageGrid({
  managerProps,
  currentImages,
  columns,
  gridColsClass,
  isMobile,
  dragAndDrop,
  selection,
  lightbox,
  batchOps,
  getFramePositionForIndex,
  segmentSlots,
  onSegmentClick,
  hasPendingTask,
  onSegmentDelete,
  deletingSegmentId,
  activeScrubbingIndex,
  onScrubbingStart,
  scrubbing,
  lightboxPanel,
}: DesktopImageGridProps) {
  return (
    <BatchDropZone
      onFileDrop={managerProps.onFileDrop}
      onGenerationDrop={managerProps.onGenerationDrop}
      columns={columns}
      itemCount={currentImages.length}
      disabled={managerProps.readOnly || (!managerProps.onFileDrop && !managerProps.onGenerationDrop)}
      getFramePositionForIndex={getFramePositionForIndex}
      projectAspectRatio={managerProps.projectAspectRatio}
    >
      {(_isFileDragOver, dropTargetIndex) => (
        <DndContext
          sensors={dragAndDrop.sensors}
          collisionDetection={closestCenter}
          onDragStart={dragAndDrop.handleDragStart}
          onDragEnd={dragAndDrop.handleDragEnd}
        >
          <SortableContext
            items={currentImages.map((image: GenerationRow) => image.shotImageEntryId ?? image.id)}
            strategy={rectSortingStrategy}
          >
            <ImageGrid
              images={currentImages}
              selectedIds={selection.selectedIds}
              gridColsClass={gridColsClass}
              columns={columns}
              onItemClick={selection.handleItemClick}
              onItemDoubleClick={(index) => lightbox.setLightboxIndex(index)}
              onInpaintClick={(index) => {
                lightbox.setShouldAutoEnterInpaint(true);
                lightbox.setLightboxIndex(index);
              }}
              onDelete={batchOps.handleIndividualDelete}
              onDuplicate={managerProps.onImageDuplicate}
              isMobile={isMobile}
              duplicatingImageId={managerProps.duplicatingImageId}
              duplicateSuccessImageId={managerProps.duplicateSuccessImageId}
              projectAspectRatio={managerProps.projectAspectRatio}
              batchVideoFrames={managerProps.batchVideoFrames}
              onGridDoubleClick={() => {
                selection.setSelectedIds([]);
                selection.setLastSelectedIndex(null);
              }}
              onImageUpload={managerProps.onImageUpload}
              isUploadingImage={managerProps.isUploadingImage}
              readOnly={managerProps.readOnly}
              onPairClick={managerProps.onPairClick}
              pairPrompts={managerProps.pairPrompts}
              enhancedPrompts={managerProps.enhancedPrompts}
              defaultPrompt={managerProps.defaultPrompt}
              defaultNegativePrompt={managerProps.defaultNegativePrompt}
              onClearEnhancedPrompt={managerProps.onClearEnhancedPrompt}
              pairOverrides={managerProps.pairOverrides}
              activeDragId={dragAndDrop.activeId}
              dropTargetIndex={dropTargetIndex}
              segmentSlots={segmentSlots}
              onSegmentClick={onSegmentClick}
              hasPendingTask={hasPendingTask}
              onSegmentDelete={onSegmentDelete}
              deletingSegmentId={deletingSegmentId}
              activeScrubbingIndex={activeScrubbingIndex}
              onScrubbingStart={onScrubbingStart}
              scrubbing={scrubbing}
            />
          </SortableContext>

          <DragOverlay>
            {dragAndDrop.activeImage && (
              selection.selectedIds.length > 1 &&
              dragAndDrop.activeId !== null &&
              selection.selectedIds.includes(dragAndDrop.activeId) ? (
                <MultiImagePreview
                  count={selection.selectedIds.length}
                  image={dragAndDrop.activeImage}
                />
              ) : (
                <SingleImagePreview image={dragAndDrop.activeImage} />
              )
            )}
          </DragOverlay>

          {lightboxPanel}

          {selection.showSelectionBar && selection.selectedIds.length >= 1 && (
            <SelectionActionBar
              selectedCount={selection.selectedIds.length}
              onDeselect={selection.clearSelection}
              onDelete={() => batchOps.handleBatchDelete(selection.selectedIds)}
              onNewShot={
                managerProps.onNewShotFromSelection
                  ? async () => {
                      const shotId = await managerProps.onNewShotFromSelection!(
                        selection.selectedIds
                      );
                      return shotId;
                    }
                  : undefined
              }
              onJumpToShot={managerProps.onShotChange}
            />
          )}

          <DeleteConfirmationDialog
            open={batchOps.confirmOpen}
            onOpenChange={batchOps.setConfirmOpen}
            pendingDeleteIds={batchOps.pendingDeleteIds}
            onConfirm={batchOps.performBatchDelete}
          />
        </DndContext>
      )}
    </BatchDropZone>
  );
}
