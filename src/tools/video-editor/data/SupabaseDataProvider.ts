import { getSupabaseClient } from '@/integrations/supabase/client';
import { generateUUID } from '@/shared/lib/taskCreation/ids';
import { validateSerializedConfig } from '@/tools/video-editor/lib/serialize';
import { createDefaultTimelineConfig } from '@/tools/video-editor/lib/defaults';
import { extractAssetRegistryEntry } from '@/tools/video-editor/lib/mediaMetadata';
import {
  TimelineVersionConflictError,
  type DataProvider,
  type LoadedTimeline,
  type UploadAssetOptions,
} from '@/tools/video-editor/data/DataProvider';
import type { AssetRegistry, AssetRegistryEntry, TimelineConfig } from '@/tools/video-editor/types';

const TIMELINE_ASSETS_BUCKET = 'timeline-assets';

export class SupabaseDataProvider implements DataProvider {
  constructor(
    private readonly options: {
      projectId: string;
      userId: string;
    },
  ) {}

  async loadTimeline(timelineId: string): Promise<LoadedTimeline> {
    const { data, error } = await getSupabaseClient()
      .from('timelines')
      .select('config, config_version')
      .eq('id', timelineId)
      .eq('project_id', this.options.projectId)
      .eq('user_id', this.options.userId)
      .single();

    if (error) {
      throw error;
    }

    const config = (data?.config ?? createDefaultTimelineConfig()) as TimelineConfig;
    validateSerializedConfig(config);

    return {
      config,
      configVersion: typeof (data as { config_version?: unknown } | null)?.config_version === 'number'
        ? (data as { config_version: number }).config_version
        : 1,
    };
  }

  async saveTimeline(timelineId: string, config: TimelineConfig, expectedVersion: number): Promise<number> {
    validateSerializedConfig(config);

    const { data, error } = await getSupabaseClient()
      .rpc('update_timeline_config_versioned' as never, {
        p_timeline_id: timelineId,
        p_expected_version: expectedVersion,
        p_config: config,
      } as never)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const nextVersion = (data as { config_version?: unknown } | null)?.config_version;
    if (typeof nextVersion !== 'number') {
      throw new TimelineVersionConflictError();
    }

    return nextVersion;
  }

  async loadAssetRegistry(timelineId: string): Promise<AssetRegistry> {
    const { data, error } = await getSupabaseClient()
      .from('timelines')
      .select('asset_registry')
      .eq('id', timelineId)
      .eq('project_id', this.options.projectId)
      .eq('user_id', this.options.userId)
      .single();

    if (error) {
      throw error;
    }

    return (data?.asset_registry as AssetRegistry | null) ?? { assets: {} };
  }

  async resolveAssetUrl(file: string): Promise<string> {
    if (/^https?:\/\//.test(file)) {
      return file;
    }

    const { data, error } = await getSupabaseClient()
      .storage
      .from(TIMELINE_ASSETS_BUCKET)
      .createSignedUrl(file, 60 * 60);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  async registerAsset(
    timelineId: string,
    assetId: string,
    entry: AssetRegistryEntry,
  ): Promise<void> {
    const registry = await this.loadAssetRegistry(timelineId);

    const { error: updateError } = await getSupabaseClient()
      .from('timelines')
      .update({
        asset_registry: {
          assets: {
            ...(registry.assets ?? {}),
            [assetId]: entry,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', timelineId)
      .eq('project_id', this.options.projectId)
      .eq('user_id', this.options.userId);

    if (updateError) {
      throw updateError;
    }
  }

  async uploadAsset(
    file: File,
    options: UploadAssetOptions,
  ): Promise<{ assetId: string; entry: Awaited<ReturnType<typeof extractAssetRegistryEntry>> }> {
    const safeFilename = (options.filename ?? file.name)
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `${options.userId}/${options.timelineId}/${Date.now()}-${safeFilename}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage
      .from(TIMELINE_ASSETS_BUCKET)
      .upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw uploadError;
    }

    const entry = await extractAssetRegistryEntry(file, storagePath);
    const assetId = generateUUID();
    await this.registerAsset(options.timelineId, assetId, entry);

    return { assetId, entry };
  }

  async loadWaveform(): Promise<null> {
    return null;
  }

  async loadAssetProfile(): Promise<null> {
    return null;
  }
}
