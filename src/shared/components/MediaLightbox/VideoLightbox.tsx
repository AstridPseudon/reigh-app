/**
 * VideoLightbox
 *
 * Specialized lightbox for video media. Handles all video-specific functionality:
 * - Video trimming
 * - Video replace mode
 * - Video regenerate mode
 * - Video enhance mode
 * - Segment slot mode (timeline navigation)
 *
 * Uses useSharedLightboxState for shared functionality (variants, navigation, etc.)
 *
 * This is part of the split architecture where MediaLightbox dispatches to
 * ImageLightbox or VideoLightbox based on media type.
 */

import React from 'react';
import type { GenerationRow } from '@/types/shots';
import type {
  SegmentSlotModeData,
  AdjacentSegmentsData,
  TaskDetailsData,
  LightboxNavigationProps,
  LightboxShotWorkflowProps,
  LightboxFeatureFlags,
  LightboxActionHandlers,
} from './types';
import { handleError } from '@/shared/lib/errorHandling/handleError';

import { LightboxProviders } from './components';
import { LightboxLayout } from './components/layouts/LightboxLayout';
import { SegmentSlotFormView } from './components/SegmentSlotFormView';

import {
  useVideoLightboxMode,
  useVideoLightboxEnvironment,
} from './hooks/useVideoLightboxEnvironment';
import { useVideoLightboxRenderModel } from './hooks/useVideoLightboxRenderModel';
import {
  useVideoLightboxSharedState,
  useVideoLightboxEditing,
} from './hooks/useVideoLightboxController';

import { LightboxShell } from './components';
import { VideoEditProvider } from './contexts/VideoEditContext';

/** Video-specific props that don't fit into shared groups */
export interface VideoLightboxVideoProps {
  initialVideoTrimMode?: boolean;
  fetchVariantsForSelf?: boolean;
  currentSegmentImages?: {
    startUrl?: string;
    endUrl?: string;
    startGenerationId?: string;
    endGenerationId?: string;
    startShotGenerationId?: string;
    endShotGenerationId?: string;
    activeChildGenerationId?: string;
    startVariantId?: string;
    endVariantId?: string;
  };
  onSegmentFrameCountChange?: (pairShotGenerationId: string, frameCount: number) => void;
  currentFrameCount?: number;
  onTrimModeChange?: (isTrimMode: boolean) => void;
  onShowTaskDetails?: () => void;
}

export interface VideoLightboxProps {
  media?: GenerationRow;
  onClose: () => void;
  segmentSlotMode?: SegmentSlotModeData;
  readOnly?: boolean;
  shotId?: string;
  initialVariantId?: string;
  taskDetailsData?: TaskDetailsData;
  onOpenExternalGeneration?: (generationId: string, derivedContext?: string[]) => Promise<void>;
  showTickForImageId?: string | null;
  showTickForSecondaryImageId?: string | null;
  tasksPaneOpen?: boolean;
  tasksPaneWidth?: number;
  adjacentSegments?: AdjacentSegmentsData;
  // Grouped props
  navigation?: LightboxNavigationProps;
  shotWorkflow?: LightboxShotWorkflowProps;
  features?: LightboxFeatureFlags;
  actions?: LightboxActionHandlers;
  videoProps?: VideoLightboxVideoProps;
}

export type {
  VideoLightboxSharedStateModel,
  VideoLightboxEditModel,
} from './hooks/useVideoLightboxController';

const VideoLightboxContent: React.FC<VideoLightboxProps> = (props) => {
  const modeModel = useVideoLightboxMode(props);
  const env = useVideoLightboxEnvironment(props, modeModel);
  const sharedState = useVideoLightboxSharedState(props, modeModel, env);
  const editModel = useVideoLightboxEditing(props, modeModel, env, sharedState);
  const renderModel = useVideoLightboxRenderModel(props, modeModel, env, sharedState, editModel);

  return (
    <LightboxProviders stateValue={renderModel.lightboxStateValue}>
      <VideoEditProvider value={editModel.videoEditValue}>
        <LightboxShell
          onClose={props.onClose}
          hasCanvasOverlay={false}
          isRepositionMode={false}
          isMobile={env.isMobile}
          isTabletOrLarger={sharedState.layout.isTabletOrLarger}
          effectiveTasksPaneOpen={env.effectiveTasksPaneOpen}
          effectiveTasksPaneWidth={env.effectiveTasksPaneWidth}
          isTasksPaneLocked={env.isTasksPaneLocked}
          needsFullscreenLayout={renderModel.needsFullscreenLayout}
          needsTasksPaneOffset={renderModel.needsTasksPaneOffset}
          contentRef={env.contentRef}
          accessibilityTitle={renderModel.accessibilityTitle}
          accessibilityDescription={renderModel.accessibilityDescription}
        >
          {modeModel.isFormOnlyMode && props.segmentSlotMode ? (
            <SegmentSlotFormView
              segmentSlotMode={props.segmentSlotMode}
              onClose={props.onClose}
              onNavPrev={modeModel.handleSlotNavPrev}
              onNavNext={modeModel.handleSlotNavNext}
              hasPrevious={modeModel.hasPrevious}
              hasNext={modeModel.hasNext}
              readOnly={props.readOnly}
            />
          ) : (
            <LightboxLayout {...renderModel.layoutProps} controlsPanelContent={renderModel.controlsPanelContent} />
          )}
        </LightboxShell>
      </VideoEditProvider>
    </LightboxProviders>
  );
};

export const VideoLightbox: React.FC<VideoLightboxProps> = (props) => {
  const isSegmentSlotMode = !!props.segmentSlotMode;
  const hasSegmentVideo = isSegmentSlotMode && !!props.segmentSlotMode?.segmentVideo;
  const isFormOnlyMode = isSegmentSlotMode && !hasSegmentVideo;

  if (!props.media && !isFormOnlyMode) {
    handleError(new Error('No media prop provided and not in form-only mode'), {
      context: 'VideoLightbox',
      showToast: false,
    });
    return null;
  }

  return <VideoLightboxContent {...props} />;
};
