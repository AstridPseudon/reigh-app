import type { FC, ReactNode } from 'react';
import { Sequence } from 'remotion';
import {
  continuousEffects,
  getEffectRegistry,
  lookupEffect,
  wrapWithEffect,
} from '@/tools/video-editor/effects';
import { getClipDurationInFrames, secondsToFrames } from '@/tools/video-editor/lib/config-utils';
import type { ResolvedTimelineClip } from '@/tools/video-editor/types';

interface EffectLayerSequenceProps {
  clip: ResolvedTimelineClip;
  fps: number;
  children: ReactNode;
}

/**
 * Applies a continuous effect for the effect-layer clip's time range
 * while preserving the children's original composition time context.
 */
export const EffectLayerSequence: FC<EffectLayerSequenceProps> = ({ clip, fps, children }) => {
  const startFrame = Math.max(0, secondsToFrames(clip.at, fps));
  const durationInFrames = getClipDurationInFrames(clip, fps);

  if (!clip.continuous) {
    return <>{children}</>;
  }

  const Effect = lookupEffect(continuousEffects, clip.continuous.type);
  if (!Effect) {
    console.warn('[EffectLayer] effect NOT FOUND for clip=%s type=%s', clip.id, clip.continuous.type);
    return <>{children}</>;
  }

  const inner = startFrame === 0 ? children : <Sequence from={-startFrame}>{children}</Sequence>;

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      {wrapWithEffect(
        inner,
        Effect,
        {
          effectName: clip.continuous.type,
          durationInFrames,
          effectFrames: durationInFrames,
          intensity: clip.continuous.intensity ?? 0.5,
          params: clip.continuous.params,
          schema: getEffectRegistry().getSchema(clip.continuous.type),
        },
      )}
    </Sequence>
  );
};
