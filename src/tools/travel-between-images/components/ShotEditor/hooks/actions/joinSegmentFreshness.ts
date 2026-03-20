interface BoundaryFreshness {
  canCrossfade: boolean;
  overlapFrames: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function checkBoundaryFreshness(
  predecessorPrimaryVariantId: string | null | undefined,
  successorVariantParams: Record<string, unknown> | null | undefined,
): BoundaryFreshness {
  if (!predecessorPrimaryVariantId || !successorVariantParams) {
    return { canCrossfade: false, overlapFrames: 0 };
  }

  const continuationConfig = asRecord(successorVariantParams.continuation_config);
  const overlapFrames = asNumber(continuationConfig?.overlap_frames)
    ?? asNumber(successorVariantParams.frame_overlap_from_previous)
    ?? 0;

  if (overlapFrames <= 0) {
    return { canCrossfade: false, overlapFrames: 0 };
  }

  const predecessorVariantId = typeof successorVariantParams.continuation_predecessor_variant_id === 'string'
    ? successorVariantParams.continuation_predecessor_variant_id
    : null;

  return {
    canCrossfade: predecessorVariantId === predecessorPrimaryVariantId,
    overlapFrames,
  };
}

export type { BoundaryFreshness };
