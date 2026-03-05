import type { GenerationRow } from '@/domains/generation/types';
import type { MouseEvent } from 'react';

interface TimelineItemLayoutModel {
  timelineWidth: number;
  fullMinFrames: number;
  fullRange: number;
}

interface TimelineItemInteractionModel {
  isDragging: boolean;
  isSwapTarget: boolean;
  dragOffset: { x: number; y: number } | null;
  onMouseDown?: (e: MouseEvent, imageId: string) => void;
  onDoubleClick?: () => void;
  onMobileTap?: () => void;
  currentDragFrame: number | null;
  originalFramePos: number;
  onPrefetch?: () => void;
}

interface TimelineItemActionModel {
  onDelete?: (imageId: string) => void;
  onDuplicate?: (imageId: string, timeline_frame: number) => void;
  onInpaintClick?: () => void;
  duplicatingImageId?: string;
  duplicateSuccessImageId?: string;
}

interface TimelineItemSelectionModel {
  isSelected?: boolean;
  onSelectionClick?: (e: MouseEvent) => void;
  selectedCount?: number;
}

interface TimelineItemPresentationModel {
  shouldLoad?: boolean;
  projectAspectRatio?: string;
  readOnly?: boolean;
  isJustDropped?: boolean;
}

export interface TimelineItemProps {
  image: GenerationRow;
  framePosition: number;
  layout: TimelineItemLayoutModel;
  interaction: TimelineItemInteractionModel;
  actions?: TimelineItemActionModel;
  selection?: TimelineItemSelectionModel;
  presentation?: TimelineItemPresentationModel;
}
