import { memo, type FC } from 'react';
import { Sequence } from 'remotion';
import { Audio } from '@remotion/media';
import { getClipDurationInFrames, secondsToFrames } from '@/tools/video-editor/lib/config-utils';
import type { ResolvedTimelineClip } from '@/tools/video-editor/types';

const AudioTrackComponent: FC<{
  trackId: string;
  clips: ResolvedTimelineClip[];
  fps: number;
}> = ({ clips, fps }) => {
  return (
    <>
      {clips.map((clip) => (
        <Sequence
          // Remotion's Sequence + Audio timing is not fully updated by prop changes during playback,
          // so audio clips need a remount whenever timing or playback-rate inputs change.
          key={`${clip.id}-${clip.at}-${clip.from ?? 0}-${clip.to ?? ''}-${clip.speed ?? 1}`}
          from={secondsToFrames(clip.at, fps)}
          durationInFrames={getClipDurationInFrames(clip, fps)}
        >
          {clip.assetEntry ? (
            <Audio
              src={clip.assetEntry.src}
              trimBefore={secondsToFrames(clip.from ?? 0, fps)}
              trimAfter={clip.to ? secondsToFrames(clip.to, fps) : undefined}
              playbackRate={clip.speed ?? 1}
              volume={clip.volume ?? 1}
            />
          ) : null}
        </Sequence>
      ))}
    </>
  );
};

export const AudioTrack = memo(AudioTrackComponent);
AudioTrack.displayName = 'AudioTrack';
