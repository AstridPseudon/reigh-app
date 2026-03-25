import type { AssetRegistry, AssetRegistryEntry, TimelineConfig } from '@/tools/video-editor/types';

export interface SilenceRegion {
  start: number;
  end: number;
}

export interface AssetProfile {
  transcript?: { segments?: Array<{ start: number; end: number; text: string }> };
  [key: string]: unknown;
}

export interface UploadAssetOptions {
  timelineId: string;
  userId: string;
  filename?: string;
}

export interface DataProvider {
  loadTimeline(timelineId: string): Promise<TimelineConfig>;
  saveTimeline(timelineId: string, config: TimelineConfig): Promise<void>;
  loadAssetRegistry(timelineId: string): Promise<AssetRegistry>;
  resolveAssetUrl(file: string): Promise<string>;
  registerAsset?(timelineId: string, assetId: string, entry: AssetRegistryEntry): Promise<void>;
  uploadAsset?(
    file: File,
    options: UploadAssetOptions,
  ): Promise<{ assetId: string; entry: AssetRegistryEntry }>;
  loadWaveform?(assetId: string): Promise<SilenceRegion[] | null>;
  loadAssetProfile?(assetId: string): Promise<AssetProfile | null>;
}
