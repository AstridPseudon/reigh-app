import type { PinnedShotGroup, TimelineConfig } from '@/tools/video-editor/types';
import type { TimelineRow } from '@/tools/video-editor/types/timeline-canvas';

export type PinnedGroupKey = Pick<PinnedShotGroup, 'shotId' | 'trackId'>;

export type CategorizedSelection = {
  freeClipIds: string[];
  groups: Array<{
    groupKey: PinnedGroupKey;
    clipIds: string[];
  }>;
};

const getGroupId = (groupKey: PinnedGroupKey): string => `${groupKey.shotId}:${groupKey.trackId}`;

/**
 * Find the pinned group that contains `clipId`, if any. Soft-tag lookup only —
 * returns the first group whose `clipIds` list includes the target.
 */
export function findEnclosingPinnedGroup(
  config: TimelineConfig,
  clipId: string,
): { group: PinnedShotGroup; groupKey: PinnedGroupKey; index: number } | null {
  const groups = config.pinnedShotGroups ?? [];
  const index = groups.findIndex((group) => group.clipIds.includes(clipId));
  if (index < 0) {
    return null;
  }

  const group = groups[index];
  return {
    group,
    groupKey: { shotId: group.shotId, trackId: group.trackId },
    index,
  };
}

/**
 * Split a selection of clip ids into free clips and enclosing groups. If any
 * clip in the selection belongs to a group, the group's full `clipIds` list is
 * used (selection expands to the whole group).
 */
export function categorizeSelection(
  clipIds: string[],
  config: TimelineConfig,
): CategorizedSelection {
  const uniqueClipIds = [...new Set(clipIds)];
  const freeClipIds: string[] = [];
  const groups = new Map<string, { groupKey: PinnedGroupKey; clipIds: string[] }>();

  for (const clipId of uniqueClipIds) {
    const enclosingGroup = findEnclosingPinnedGroup(config, clipId);
    if (!enclosingGroup) {
      freeClipIds.push(clipId);
      continue;
    }

    const groupId = getGroupId(enclosingGroup.groupKey);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        groupKey: enclosingGroup.groupKey,
        clipIds: [...enclosingGroup.group.clipIds],
      });
    }
  }

  return {
    freeClipIds,
    groups: [...groups.values()],
  };
}

interface OrderClipIdsByAtContext {
  clips?: TimelineConfig['clips'];
  rows?: TimelineRow[];
}

/**
 * Return `clipIds` sorted left-to-right by each clip's current live `at`.
 * Unknown clip ids are preserved at their existing relative order at the end.
 * Accepts either a `clips[]` snapshot (from a TimelineConfig) or live `rows`
 * (from TimelineData) — whichever is more convenient at the call site.
 */
export function orderClipIdsByAt(
  clipIds: readonly string[],
  context: OrderClipIdsByAtContext,
): string[] {
  const atById = new Map<string, number>();

  if (context.clips) {
    for (const clip of context.clips) {
      atById.set(clip.id, clip.at);
    }
  }
  if (context.rows) {
    for (const row of context.rows) {
      for (const action of row.actions) {
        // Only overwrite if not already set (clips wins if both provided).
        if (!atById.has(action.id)) {
          atById.set(action.id, action.start);
        }
      }
    }
  }

  const known: Array<{ id: string; at: number; originalIndex: number }> = [];
  const unknown: string[] = [];
  clipIds.forEach((id, originalIndex) => {
    const at = atById.get(id);
    if (typeof at === 'number') {
      known.push({ id, at, originalIndex });
    } else {
      unknown.push(id);
    }
  });

  known.sort((left, right) => {
    if (left.at !== right.at) return left.at - right.at;
    return left.originalIndex - right.originalIndex;
  });

  return [...known.map((entry) => entry.id), ...unknown];
}
