import React, { type MutableRefObject } from 'react';
import { Check, Copy, Maximize2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { VariantBadge } from '@/shared/components/VariantBadge';
import type { GenerationRow } from '@/domains/generation/types';

interface TimelineItemActionButtonsProps {
  image: GenerationRow;
  imageKey: string;
  isDragging: boolean;
  readOnly: boolean;
  isSelected: boolean;
  isTouchDevice: boolean;
  onMobileTap?: () => void;
  onInpaintClick?: () => void;
  onDuplicateClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDeleteClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  duplicatingImageId?: string;
  duplicateSuccessImageId?: string;
  onMarkAllVariantsViewed: () => void;
  buttonClickedRef: MutableRefObject<boolean>;
  scheduleButtonClickReset: () => void;
}

export const TimelineItemActionButtons: React.FC<TimelineItemActionButtonsProps> = ({
  image,
  imageKey,
  isDragging,
  readOnly,
  isSelected,
  isTouchDevice,
  onMobileTap,
  onInpaintClick,
  onDuplicateClick,
  onDeleteClick,
  duplicatingImageId,
  duplicateSuccessImageId,
  onMarkAllVariantsViewed,
  buttonClickedRef,
  scheduleButtonClickReset,
}) => {
  const markButtonInteraction = (e: React.MouseEvent | React.PointerEvent) => {
    buttonClickedRef.current = true;
    e.preventDefault();
    e.stopPropagation();
    scheduleButtonClickReset();
  };

  return (
    <>
      {isSelected && isTouchDevice && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none gap-1">
          <div className="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-medium shadow-md">
            Tap timeline to place
          </div>
          {onMobileTap && (
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 rounded-full bg-background/90 hover:bg-background shadow-lg pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                onMobileTap();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
              }}
              title="Open lightbox"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {!isDragging && !readOnly && (
        <>
          {onInpaintClick && (
            <div
              data-click-blocker="edit-button"
              className="absolute bottom-0 left-0 h-7 w-7 z-[19]"
              onMouseDown={markButtonInteraction}
              onPointerDown={markButtonInteraction}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          )}

          {onInpaintClick && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-1 left-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onInpaintClick();
              }}
              onMouseDown={markButtonInteraction}
              onPointerDown={markButtonInteraction}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
              }}
              title="Edit image"
            >
              <Pencil className="!h-3 !w-3" />
            </Button>
          )}

          <VariantBadge
            derivedCount={image.derivedCount}
            unviewedVariantCount={image.unviewedVariantCount}
            hasUnviewedVariants={image.hasUnviewedVariants}
            variant="overlay"
            size="sm"
            zIndex={20}
            onMarkAllViewed={onMarkAllVariantsViewed}
          />

          <Button
            variant="secondary"
            size="icon"
            className="absolute top-1 right-[1.65rem] h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onClick={onDuplicateClick}
            onMouseDown={markButtonInteraction}
            onPointerDown={markButtonInteraction}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
            }}
            disabled={duplicatingImageId === imageKey}
            title="Duplicate image"
          >
            {duplicatingImageId === imageKey ? (
              <div className="!h-3 !w-3 animate-spin rounded-full border-b-2 border-white" />
            ) : duplicateSuccessImageId === imageKey ? (
              <Check className="!h-3 !w-3" />
            ) : (
              <Copy className="!h-3 !w-3" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onClick={onDeleteClick}
            onMouseDown={markButtonInteraction}
            onPointerDown={markButtonInteraction}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
            }}
            title="Remove from timeline"
          >
            <Trash2 className="!h-3 !w-3" />
          </Button>
        </>
      )}
    </>
  );
};
