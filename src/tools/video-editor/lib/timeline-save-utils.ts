import { getConfigSignature } from '@/tools/video-editor/lib/config-utils';
import { configToRows, type TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { TimelineConfig } from '@/tools/video-editor/types';

export function shouldAcceptPolledData(
  editSeq: number,
  savedSeq: number,
  polledSig: string,
  lastSavedSig: string,
): boolean {
  if (savedSeq < editSeq) {
    return false;
  }

  return polledSig !== lastSavedSig;
}

export function buildDataFromCurrentRegistry(
  config: TimelineConfig,
  current: TimelineData,
): TimelineData {
  const rowData = configToRows(config);
  const resolvedConfig = {
    output: { ...config.output },
    tracks: config.tracks ?? [],
    clips: config.clips.map((clip) => ({
      ...clip,
      assetEntry: clip.asset ? current.resolvedConfig.registry[clip.asset] : undefined,
    })),
    registry: { ...current.resolvedConfig.registry },
  };

  return {
    config,
    configVersion: current.configVersion,
    registry: { ...current.registry },
    resolvedConfig,
    rows: rowData.rows,
    meta: rowData.meta,
    effects: rowData.effects,
    assetMap: Object.fromEntries(
      Object.entries(current.registry.assets ?? {}).map(([assetId, entry]) => [assetId, entry.file]),
    ),
    output: { ...config.output },
    tracks: config.tracks ?? [],
    clipOrder: rowData.clipOrder,
    signature: getConfigSignature(resolvedConfig),
  };
}
