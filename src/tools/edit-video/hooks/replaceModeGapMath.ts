function quantizeGapFramesFromDuration(duration: number, fps: number): number {
  const frameCount = Math.round(duration * fps);
  return quantizeGapFrameCount(frameCount);
}

function getMaxGapFramesForContext(contextFrameCount: number): number {
  return Math.max(1, 81 - (contextFrameCount * 2));
}

export function quantizeGapFrameCount(frameCount: number): number {
  const n = Math.round((frameCount - 1) / 4);
  return Math.max(1, n * 4 + 1);
}

export function calculateGapFramesFromRange({
  start,
  end,
  fps,
  fallbackGapFrameCount,
  contextFrameCount,
}: {
  start: number;
  end: number;
  fps: number | null;
  fallbackGapFrameCount: number;
  contextFrameCount: number;
}): number {
  if (!fps || end <= start) {
    return fallbackGapFrameCount;
  }

  const quantized = quantizeGapFramesFromDuration(end - start, fps);
  return Math.min(quantized, getMaxGapFramesForContext(contextFrameCount));
}
