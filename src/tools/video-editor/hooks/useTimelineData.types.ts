import { useQueryClient } from '@tanstack/react-query';
import type { ApplyEditOptions, TimelineEditMutation } from '@/tools/video-editor/hooks/useTimelineCommit';
import type { AssetRegistryEntry, TrackDefinition } from '@/tools/video-editor/types';
import type { Checkpoint } from '@/tools/video-editor/types/history';
import type { TimelineData } from '@/tools/video-editor/lib/timeline-data';

export type { SaveStatus } from './useTimelineSave';
export type { RenderStatus } from './useRenderState';
export type { ClipTab, EditorPreferences } from './useEditorPreferences';

import type { SaveStatus } from './useTimelineSave';
import type { RenderStatus } from './useRenderState';
import type { ClipTab, EditorPreferences } from './useEditorPreferences';

export type TimelineResolvedConfig = TimelineData['resolvedConfig'] | null;
export type TimelineSelectedClip = TimelineData['resolvedConfig']['clips'][number] | null;
export type TimelineSelectedTrack = TrackDefinition | null;
export type TimelineRenderProgress = {
  current: number;
  total: number;
  percent: number;
  phase: string;
} | null;

export type TimelineDataRef = React.MutableRefObject<TimelineData | null>;
export type TimelinePendingOpsRef = React.MutableRefObject<number>;
export type TimelineSetSelectedClipId = React.Dispatch<React.SetStateAction<string | null>>;
export type TimelineSetSelectedTrackId = React.Dispatch<React.SetStateAction<string | null>>;
export type TimelineSetRenderStatus = React.Dispatch<React.SetStateAction<RenderStatus>>;
export type TimelineSetRenderLog = React.Dispatch<React.SetStateAction<string>>;
export type TimelineSetRenderDirty = React.Dispatch<React.SetStateAction<boolean>>;
export type TimelineSetScaleWidth = (updater: number | ((value: number) => number)) => void;
export type TimelineSetActiveClipTab = (tab: ClipTab) => void;
export type TimelineSetAssetPanelState = (patch: Partial<EditorPreferences['assetPanel']>) => void;

export type TimelineApplyEdit = (
  mutation: TimelineEditMutation,
  options?: ApplyEditOptions,
) => void;
export type TimelinePatchRegistry = (
  assetId: string,
  entry: AssetRegistryEntry,
  src?: string,
) => void;
export type TimelineRegisterAsset = (
  assetId: string,
  entry: AssetRegistryEntry,
) => Promise<void>;
export type TimelineQueryClient = ReturnType<typeof useQueryClient>;
export type TimelineUploadAsset = (
  file: File,
) => Promise<{ assetId: string; entry: AssetRegistryEntry }>;
export type TimelineUploadFiles = (files: File[]) => Promise<void>;
export type TimelineInvalidateAssetRegistry = () => Promise<void>;
export type TimelineReloadFromServer = () => Promise<void>;
export type TimelineRetrySaveAfterConflict = () => Promise<void>;
export type TimelineStartRender = () => Promise<void>;
export type TimelineJumpToCheckpoint = (checkpointId: string) => void;
export type TimelineCreateManualCheckpoint = (label?: string) => Promise<void>;
export type TimelineCheckpoints = Checkpoint[];
export type TimelineSaveStatus = SaveStatus;
export type TimelineRenderStatusValue = RenderStatus;
