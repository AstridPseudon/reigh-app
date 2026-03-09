/**
 * TimelineMediaContext — passes structure video + audio props from
 * ShotImagesEditor straight to TimelineContainer, skipping Timeline.
 */

import { createContext, useContext } from 'react';
import type { PrimaryStructureVideo } from '@/shared/lib/tasks/travelBetweenImages';
import type {
  OnAudioChange,
  OnPrimaryStructureVideoInputChange,
  StructureVideoCollectionHandlers,
} from '@/tools/travel-between-images/types/mediaHandlers';

export interface TimelineMediaContextValue extends StructureVideoCollectionHandlers {
  primaryStructureVideo: PrimaryStructureVideo;
  onPrimaryStructureVideoInputChange?: OnPrimaryStructureVideoInputChange;
  audioUrl?: string | null;
  audioMetadata?: { duration: number; name?: string } | null;
  onAudioChange?: OnAudioChange;
}

const TimelineMediaContext = createContext<TimelineMediaContextValue | null>(null);

export const TimelineMediaProvider = TimelineMediaContext.Provider;

export function useTimelineMedia(): TimelineMediaContextValue {
  const ctx = useContext(TimelineMediaContext);
  if (!ctx) throw new Error('useTimelineMedia must be used within a TimelineMediaProvider');
  return ctx;
}
