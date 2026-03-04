import { GenerationRow } from '@/domains/generation/types';
import { getPairIdentifiers } from './segmentDataTransforms';
import { ExpectedSegmentData, LiveTimelineRow, SegmentSlot } from './segmentOutputTypes';

interface BuildSegmentSlotsArgs {
  segments: GenerationRow[];
  expectedSegmentData: ExpectedSegmentData | null;
  effectiveTimelineData: LiveTimelineRow[] | undefined;
  liveShotGenIdToPosition: Map<string, number>;
  localShotGenPositions?: Map<string, number>;
  trailingShotGenId?: string;
}

export function buildSegmentSlots({
  segments,
  expectedSegmentData,
  effectiveTimelineData,
  liveShotGenIdToPosition,
  localShotGenPositions,
  trailingShotGenId,
}: BuildSegmentSlotsArgs): SegmentSlot[] {
  const hasLocalPositions = !!localShotGenPositions && localShotGenPositions.size > 0;
  const localPositionCount = localShotGenPositions?.size ?? 0;
  const useLocalPositions = hasLocalPositions;
  const positionMap = useLocalPositions ? localShotGenPositions : liveShotGenIdToPosition;
  const baseSlotCount = useLocalPositions
    ? localPositionCount - 1
    : (effectiveTimelineData?.length ? effectiveTimelineData.length - 1 : 0);
  const slotCount = trailingShotGenId ? baseSlotCount + 1 : baseSlotCount;

  if (slotCount === 0) {
    if (!effectiveTimelineData) {
      return [];
    }

    return segments.map((child, index) => ({
      type: 'child' as const,
      child,
      index: child.child_order ?? index,
    }));
  }

  const slots: SegmentSlot[] = [];
  const childrenBySlot = new Map<number, GenerationRow>();
  const usedSlots = new Set<number>();
  const childrenWithoutValidSlot: GenerationRow[] = [];

  segments.forEach((child) => {
    const childParams = child.params as Record<string, unknown> | null;
    const { pairShotGenId } = getPairIdentifiers(child, childParams);
    const childOrder = child.child_order;
    const individualParams = (childParams?.individual_segment_params || {}) as Record<string, unknown>;
    const endGenId = (individualParams.end_image_generation_id || childParams?.end_image_generation_id) as string | undefined;

    let derivedSlot: number | undefined;
    let slotSource = 'NONE';
    let pairShotGenPosition: number | undefined;

    if (pairShotGenId && positionMap.has(pairShotGenId)) {
      pairShotGenPosition = positionMap.get(pairShotGenId)!;
      const isTrailingSegment = trailingShotGenId && pairShotGenId === trailingShotGenId;

      if (pairShotGenPosition < slotCount || isTrailingSegment) {
        derivedSlot = pairShotGenPosition;
        slotSource = isTrailingSegment
          ? 'TRAILING_SEGMENT'
          : (useLocalPositions ? 'LOCAL_POSITION' : 'PAIR_SHOT_GEN_ID_LIVE');
      } else {
        slotSource = 'PAIR_AT_END_NO_SLOT';
      }

      if (!useLocalPositions && derivedSlot !== undefined && endGenId && effectiveTimelineData) {
        const endImageInTimeline = effectiveTimelineData[derivedSlot + 1];
        if (endImageInTimeline && endImageInTimeline.generation_id !== endGenId) {
          const endImageNewSlot = effectiveTimelineData.findIndex(
            (item) => item.generation_id === endGenId,
          );
          if (endImageNewSlot === -1 || endImageNewSlot > derivedSlot) {
            derivedSlot = undefined;
            slotSource = 'STALE_END_IMAGE';
          }
        }
      }
    }

    if (
      derivedSlot === undefined
      && !pairShotGenId
      && typeof childOrder === 'number'
      && childOrder >= 0
      && childOrder < slotCount
    ) {
      derivedSlot = childOrder;
      slotSource = 'CHILD_ORDER';
    }

    if (slotSource === 'PAIR_AT_END_NO_SLOT') {
      return;
    }

    if (derivedSlot !== undefined && !usedSlots.has(derivedSlot)) {
      childrenBySlot.set(derivedSlot, child);
      usedSlots.add(derivedSlot);
    } else if (derivedSlot !== undefined && usedSlots.has(derivedSlot)) {
      const existing = childrenBySlot.get(derivedSlot)!;
      if (!existing.location && child.location) {
        childrenBySlot.set(derivedSlot, child);
        childrenWithoutValidSlot.push(existing);
      } else {
        childrenWithoutValidSlot.push(child);
      }
    } else {
      childrenWithoutValidSlot.push(child);
    }
  });

  for (let i = 0; i < slotCount; i++) {
    const child = childrenBySlot.get(i);
    const liveStartImage = effectiveTimelineData?.[i];
    const liveEndImage = effectiveTimelineData?.[i + 1];
    const pairShotGenerationId = liveStartImage?.id || expectedSegmentData?.pairShotGenIds?.[i];

    if (child) {
      const childPsgId = getPairIdentifiers(
        child,
        child.params as Record<string, unknown> | null,
      ).pairShotGenId;
      slots.push({
        type: 'child',
        child,
        index: i,
        pairShotGenerationId: childPsgId || pairShotGenerationId,
      });
    } else {
      slots.push({
        type: 'placeholder',
        index: i,
        expectedFrames: expectedSegmentData?.frames[i],
        expectedPrompt: expectedSegmentData?.prompts[i],
        startImage: liveStartImage?.generation_id || expectedSegmentData?.inputImages[i],
        endImage: liveEndImage?.generation_id || expectedSegmentData?.inputImages[i + 1],
        pairShotGenerationId,
      });
    }
  }

  return slots;
}
