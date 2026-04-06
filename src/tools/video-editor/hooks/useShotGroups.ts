import { useMemo } from 'react';
import type { Shot } from '@/domains/generation/types';
import type { ClipMeta } from '@/tools/video-editor/lib/timeline-data';
import type { AssetRegistry, TimelineConfig } from '@/tools/video-editor/types';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';

const MAX_GAP_SECONDS = 0.5;
const SHOT_COLORS = ['#a855f7', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#14b8a6', '#ec4899', '#84cc16'];

export interface ShotGroup {
  shotId: string;
  shotName: string;
  rowId: string;
  rowIndex: number;
  clipIds: string[];
  color: string;
  isPinned: boolean;
  mode?: 'images' | 'video';
}

export function getShotColor(shotId: string): string {
  let hash = 0;
  for (let index = 0; index < shotId.length; index += 1) {
    hash = ((hash * 31) + shotId.charCodeAt(index)) >>> 0;
  }
  return SHOT_COLORS[hash % SHOT_COLORS.length];
}

function sortActions(actions: TimelineAction[]) {
  return [...actions].sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}

export function useShotGroups(
  rows: TimelineRow[],
  meta: Record<string, ClipMeta>,
  registry: AssetRegistry,
  shots: Shot[] | undefined,
  pinnedShotGroups?: TimelineConfig['pinnedShotGroups'],
): ShotGroup[] {
  return useMemo(() => {
    const rowById = new Map(rows.map((row, rowIndex) => [row.id, { row, rowIndex }]));
    const shotNameById = new Map((shots ?? []).map((shot) => [shot.id, shot.name]));

    // --- Pinned groups (source of truth) ---
    const pinned: ShotGroup[] = (pinnedShotGroups ?? [])
      .map((group) => {
        const rowEntry = rowById.get(group.trackId);
        if (!rowEntry) return null;
        const liveClipIds = group.clipIds.filter((clipId) =>
          rowEntry.row.actions.some((action) => action.id === clipId),
        );
        if (liveClipIds.length === 0) return null;
        return {
          shotId: group.shotId,
          shotName: shotNameById.get(group.shotId) ?? group.shotId,
          rowId: group.trackId,
          rowIndex: rowEntry.rowIndex,
          clipIds: liveClipIds,
          color: getShotColor(group.shotId),
          isPinned: true,
          mode: group.mode,
        } satisfies ShotGroup;
      })
      .filter((g): g is ShotGroup => g !== null);

    const pinnedClipIds = new Set(pinned.flatMap((g) => g.clipIds));

    // --- Strict inference (only unambiguous generations) ---
    if (!shots?.length || rows.length === 0) return pinned;

    // Build generationId → Set<shotId> to find ambiguous generations
    const generationShotOwners = new Map<string, Set<string>>();
    for (const shot of shots) {
      for (const image of shot.images ?? []) {
        const gid = image.generation_id;
        if (typeof gid !== 'string' || gid.length === 0) continue;
        if (image.type?.startsWith('video')) continue;
        if (image.timeline_frame == null) continue;
        let owners = generationShotOwners.get(gid);
        if (!owners) {
          owners = new Set();
          generationShotOwners.set(gid, owners);
        }
        owners.add(shot.id);
      }
    }

    // Map clip → generationId (images only, skip pinned clips)
    const clipGenerationId = new Map<string, string>();
    for (const row of rows) {
      for (const action of row.actions) {
        if (pinnedClipIds.has(action.id)) continue;
        const assetKey = meta[action.id]?.asset;
        if (!assetKey) continue;
        const entry = registry.assets[assetKey];
        if (!entry?.generationId) continue;
        if (entry.type?.startsWith('video/')) continue;
        // Only include if this generation belongs to exactly one shot
        const owners = generationShotOwners.get(entry.generationId);
        if (!owners || owners.size !== 1) continue;
        clipGenerationId.set(action.id, entry.generationId);
      }
    }

    // For each shot, build imageIndex map (only unambiguous positioned images)
    const inferred: ShotGroup[] = [];
    const sortedRowActions = rows.map((row) => sortActions(row.actions));

    for (const shot of shots) {
      const imageIndexByGenId = new Map<string, number>();
      for (const [idx, image] of (shot.images ?? []).entries()) {
        const gid = image.generation_id;
        if (typeof gid !== 'string' || gid.length === 0) continue;
        if (image.type?.startsWith('video')) continue;
        if (image.timeline_frame == null) continue;
        const owners = generationShotOwners.get(gid);
        if (!owners || owners.size !== 1) continue;
        if (!imageIndexByGenId.has(gid)) imageIndexByGenId.set(gid, idx);
      }
      if (imageIndexByGenId.size < 2) continue;

      const color = getShotColor(shot.id);

      for (const [rowIndex, row] of rows.entries()) {
        let current: ShotGroup | null = null;
        let lastIdx = -1;
        let lastEnd = 0;

        for (const action of sortedRowActions[rowIndex]) {
          const gid = clipGenerationId.get(action.id);
          const imgIdx = gid !== undefined ? imageIndexByGenId.get(gid) : undefined;

          if (imgIdx === undefined) {
            if (current && current.clipIds.length >= 2) inferred.push(current);
            current = null;
            lastIdx = -1;
            lastEnd = 0;
            continue;
          }

          if (!current) {
            current = { shotId: shot.id, shotName: shot.name, rowId: row.id, rowIndex, clipIds: [action.id], color, isPinned: false };
            lastIdx = imgIdx;
            lastEnd = action.end;
            continue;
          }

          if (action.start - lastEnd < MAX_GAP_SECONDS && imgIdx > lastIdx) {
            current.clipIds.push(action.id);
            lastIdx = imgIdx;
            lastEnd = action.end;
            continue;
          }

          if (current.clipIds.length >= 2) inferred.push(current);
          current = { shotId: shot.id, shotName: shot.name, rowId: row.id, rowIndex, clipIds: [action.id], color, isPinned: false };
          lastIdx = imgIdx;
          lastEnd = action.end;
        }

        if (current && current.clipIds.length >= 2) inferred.push(current);
      }
    }

    return [...pinned, ...inferred];
  }, [rows, meta, registry, shots, pinnedShotGroups]);
}
