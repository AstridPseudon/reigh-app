export interface StyledVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  playsInline?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  playbackStart?: number;
  playbackEnd?: number;
  videoDimensions?: { width: number; height: number };
}
