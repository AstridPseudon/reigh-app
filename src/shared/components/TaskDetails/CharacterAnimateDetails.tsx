import React, { useState, useMemo } from 'react';
import { TaskDetailsProps, getVariantConfig } from '@/shared/types/taskDetailsTypes';
import {
  normalizeTaskDetailsPayload,
  pickTaskDetailsString,
} from '@/shared/components/TaskDetails/hooks/normalizeTaskDetailsPayload';
import { TaskDetailsField } from '@/shared/components/TaskDetails/components/TaskDetailsField';
import { TaskDetailsImageBlock } from '@/shared/components/TaskDetails/components/TaskDetailsImageBlock';

/**
 * Task details for character animation tasks
 * Shows: mode, character image, motion video, prompt, resolution
 */
export const CharacterAnimateDetails: React.FC<TaskDetailsProps> = ({
  task,
  inputImages,
  variant,
  isMobile = false,
}) => {
  const config = getVariantConfig(variant, isMobile, inputImages.length);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const normalized = useMemo(() => normalizeTaskDetailsPayload(task), [task]);

  // Extract character animate data
  const mode = pickTaskDetailsString(normalized, 'mode');
  const characterImageUrl = pickTaskDetailsString(normalized, 'character_image_url');
  const motionVideoUrl = pickTaskDetailsString(normalized, 'motion_video_url');
  const prompt = pickTaskDetailsString(normalized, 'prompt');
  const resolution = pickTaskDetailsString(normalized, 'resolution');

  return (
    <div className={`p-3 bg-muted/30 rounded-lg border space-y-3 ${variant === 'panel' ? '' : variant === 'modal' && isMobile ? 'w-full' : 'w-[360px]'}`}>
      {/* Mode Display */}
      {mode && (
        <div className="space-y-1 pb-2 border-b border-muted-foreground/20">
          <p className={`${config.textSize} font-medium text-muted-foreground`}>Mode</p>
          <p className={`${config.textSize} ${config.fontWeight} text-foreground capitalize`}>
            {mode}
          </p>
        </div>
      )}

      {/* Character Image */}
      {characterImageUrl && (
        <TaskDetailsImageBlock
          config={config}
          label={mode === 'animate' ? '✨ Character to animate' : '✨ Character to insert'}
          imageUrl={characterImageUrl}
          alt="Character"
          containerClassName={`flex-shrink-0 ${isMobile ? 'w-20' : 'w-40'}`}
          imageClassName="transition-transform group-hover:scale-105"
        />
      )}

      {/* Motion Video */}
      {motionVideoUrl && (
        <div className="space-y-2">
          <p className={`${config.textSize} font-medium text-muted-foreground`}>
            {mode === 'animate' ? '🎬 Source of movement' : '🎬 Video to replace character in'}
          </p>
          <div className={`relative group flex-shrink-0 cursor-pointer ${isMobile ? 'w-20' : 'w-40'}`}>
            {!videoLoaded ? (
              <div
                className="w-full aspect-video bg-black rounded border shadow-sm flex items-center justify-center"
                onClick={() => setVideoLoaded(true)}
              >
                <div className="bg-white/20 group-hover:bg-white/30 rounded-full p-3 transition-colors">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            ) : (
              <>
                <video
                  src={motionVideoUrl}
                  className="w-full object-cover rounded border shadow-sm"
                  loop
                  muted
                  playsInline
                  autoPlay
                  onClick={(e) => {
                    const video = e.currentTarget;
                    if (video.paused) {
                      video.play();
                    } else {
                      video.pause();
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 rounded-full p-2">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Prompt */}
      {prompt && (
        <TaskDetailsField
          config={config}
          label="Prompt"
          value={prompt}
          valueClassName="break-words whitespace-pre-wrap leading-relaxed preserve-case"
        />
      )}

      {/* Resolution */}
      {resolution && (
        <TaskDetailsField
          config={config}
          label="Resolution"
          value={resolution}
        />
      )}
    </div>
  );
};
