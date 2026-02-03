/**
 * Video Time/Frame Utilities
 *
 * Re-exports from shared/lib/videoUtils.ts for backwards compatibility.
 * The actual implementation has been moved to shared/ as these utilities
 * are used across multiple tools and shared components.
 */

export {
  FPS,
  isValidFrameCount,
  quantizeFrameCount,
  nextValidFrameCount,
  prevValidFrameCount,
  getValidFrameCounts,
  quantizeGap,
  framesToSeconds,
  framesToSecondsValue,
  secondsToFrames,
} from '@/shared/lib/videoUtils';
