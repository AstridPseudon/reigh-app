/**
 * JoinModeContent - Join Segments mode UI
 *
 * Renders the JoinClipsSettingsForm and swap button for Join Segments mode.
 * Pulls data from ShotSettingsContext - only receives refs as props.
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  JoinClipsSettingsForm,
} from '@/shared/components/JoinClipsSettingsForm/JoinClipsSettingsForm';
import {
  useShotCore,
  useShotLoras,
  useGenerationMode,
  useJoinState,
} from '../../ShotSettingsContext';
import { buildJoinClipsFormProps } from './joinClipsFormProps';

interface JoinModeContentProps {
  // Refs - must be passed from parent for DOM positioning
  joinSegmentsSectionRef: React.RefObject<HTMLDivElement>;
  swapButtonRef: React.RefObject<HTMLButtonElement>;
}

export const JoinModeContent: React.FC<JoinModeContentProps> = ({
  joinSegmentsSectionRef,
  swapButtonRef,
}) => {
  // Pull from ShotSettingsContext
  const { projectId } = useShotCore();
  const { availableLoras } = useShotLoras();
  const generationMode = useGenerationMode();
  const joinState = useJoinState();

  const joinFormProps = buildJoinClipsFormProps({
    joinState,
    availableLoras,
    projectId,
    loraPersistenceKey: 'join-clips-shot-editor',
  });

  return (
    <div ref={joinSegmentsSectionRef}>
      <JoinClipsSettingsForm
        clipSettings={joinFormProps.clipSettings}
        motionConfig={joinFormProps.motionConfig}
        uiState={{
          onGenerate: joinState.handleJoinSegments,
          isGenerating: joinState.isJoiningClips,
          generateSuccess: joinState.joinClipsSuccess,
          generateButtonText: 'Join Segments',
          isGenerateDisabled: joinState.joinValidationData.videoCount < 2,
          onRestoreDefaults: joinState.handleRestoreJoinDefaults,
        }}
      />

      {/* Swap to Batch Generate */}
      <button
        ref={swapButtonRef}
        onClick={() => generationMode.toggleGenerateModePreserveScroll('batch')}
        className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <ArrowLeftRight className="w-4 h-4" />
        <span>Swap to Batch Generate</span>
      </button>
    </div>
  );
};
