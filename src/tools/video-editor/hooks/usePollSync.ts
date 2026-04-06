import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { shouldAcceptPolledData } from '@/tools/video-editor/lib/timeline-save-utils';
import { buildTimelineData, preserveUploadingClips, type TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { DataProvider } from '@/tools/video-editor/data/DataProvider';
import type { CommitDataOptions } from '@/tools/video-editor/hooks/useTimelineCommit';

const TIMELINE_SYNC_LOG_TAG = '[TimelineSync]';

type PollCheckPhase = 'preflight' | 'timeout';
type ConfigVersionUpdateSource = 'poll';

export interface UsePollSyncQueries {
  timelineQuery: {
    data: TimelineData | undefined;
    isLoading: boolean;
  };
  assetRegistryQuery: {
    data: Awaited<ReturnType<DataProvider['loadAssetRegistry']>> | undefined;
  };
}

interface TimelinePollGate {
  editSeq: number;
  savedSeq: number;
  pendingOps: number;
  isSaving: boolean;
}

export interface PollRejectionInput extends TimelinePollGate {
  polledConfigVersion: number;
  currentConfigVersion: number;
  polledStableSignature: string;
  lastSavedStableSignature: string;
}

interface UsePollSyncOptions {
  queries: UsePollSyncQueries;
  provider: DataProvider;
  commitData: (nextData: TimelineData, options?: CommitDataOptions) => void;
  dataRef: MutableRefObject<TimelineData | null>;
  selectedClipIdRef: MutableRefObject<string | null>;
  selectedTrackIdRef: MutableRefObject<string | null>;
  editSeqRef: MutableRefObject<number>;
  pendingOpsRef: MutableRefObject<number>;
  savedSeqRef: MutableRefObject<number>;
  configVersionRef: MutableRefObject<number>;
  lastSavedSignatureRef: MutableRefObject<string>;
  isSavingRef: MutableRefObject<boolean>;
}

export function isTimelinePollIdle({ editSeq, savedSeq, pendingOps, isSaving }: TimelinePollGate): boolean {
  return savedSeq >= editSeq && !isSaving && pendingOps === 0;
}

export function getTimelinePollRejectionReason({
  editSeq,
  savedSeq,
  pendingOps,
  isSaving,
  polledConfigVersion,
  currentConfigVersion,
  polledStableSignature,
  lastSavedStableSignature,
}: PollRejectionInput): string | null {
  if (!isTimelinePollIdle({ editSeq, savedSeq, pendingOps, isSaving })) {
    if (savedSeq < editSeq) {
      return 'unsaved edits';
    }

    if (pendingOps > 0) {
      return 'pending ops';
    }

    if (isSaving) {
      return 'saving';
    }

    return 'busy';
  }

  if (polledConfigVersion < currentConfigVersion) {
    return 'stale version';
  }

  if (
    !shouldAcceptPolledData(
      editSeq,
      savedSeq,
      pendingOps,
      polledStableSignature,
      lastSavedStableSignature,
    )
  ) {
    return polledConfigVersion === currentConfigVersion ? 'own echo' : 'signature match';
  }

  return null;
}

export function usePollSync({
  queries,
  provider,
  commitData,
  dataRef,
  selectedClipIdRef,
  selectedTrackIdRef,
  editSeqRef,
  pendingOpsRef,
  savedSeqRef,
  configVersionRef,
  lastSavedSignatureRef,
  isSavingRef,
}: UsePollSyncOptions): void {
  const lastRegistryDataRef = useRef<Awaited<ReturnType<DataProvider['loadAssetRegistry']>> | null>(null);
  const commitDataRef = useRef(commitData);

  useLayoutEffect(() => {
    commitDataRef.current = commitData;
  }, [commitData]);

  useEffect(() => {
    const polledVersion = queries.timelineQuery.data?.configVersion;
    if (queries.timelineQuery.data && typeof polledVersion === 'number' && polledVersion > configVersionRef.current) {
      configVersionRef.current = polledVersion;
    }
  }, [configVersionRef, queries.timelineQuery.data]);

  const logTimelineSync = useCallback((message: string, details?: Record<string, unknown>) => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.log(TIMELINE_SYNC_LOG_TAG, message, details);
  }, []);

  const logConfigVersionUpdate = useCallback((source: ConfigVersionUpdateSource, nextVersion: number) => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.log(TIMELINE_SYNC_LOG_TAG, 'configVersionRef updated', {
      source,
      from: configVersionRef.current,
      to: nextVersion,
    });
  }, [configVersionRef]);

  const getPollRejectionReason = useCallback((polledData: TimelineData): string | null => {
    return getTimelinePollRejectionReason({
      editSeq: editSeqRef.current,
      savedSeq: savedSeqRef.current,
      pendingOps: pendingOpsRef.current,
      isSaving: isSavingRef.current,
      polledConfigVersion: polledData.configVersion,
      currentConfigVersion: configVersionRef.current,
      polledStableSignature: polledData.stableSignature,
      lastSavedStableSignature: lastSavedSignatureRef.current,
    });
  }, [
    configVersionRef,
    editSeqRef,
    isSavingRef,
    lastSavedSignatureRef,
    pendingOpsRef,
    savedSeqRef,
  ]);

  const logPollRejection = useCallback((phase: PollCheckPhase, polledData: TimelineData, reason: string) => {
    logTimelineSync('poll rejected', {
      phase,
      reason,
      polledConfigVersion: polledData.configVersion,
      currentConfigVersion: configVersionRef.current,
      editSeq: editSeqRef.current,
      savedSeq: savedSeqRef.current,
      pendingOps: pendingOpsRef.current,
      isSaving: isSavingRef.current,
    });
  }, [configVersionRef, editSeqRef, isSavingRef, logTimelineSync, pendingOpsRef, savedSeqRef]);

  useEffect(() => {
    const polledData = queries.timelineQuery.data;
    if (!polledData) {
      return;
    }

    const preflightRejectionReason = getPollRejectionReason(polledData);
    if (preflightRejectionReason) {
      logPollRejection('preflight', polledData, preflightRejectionReason);
      return;
    }

    const syncHandle = window.setTimeout(() => {
      const timeoutRejectionReason = getPollRejectionReason(polledData);
      if (timeoutRejectionReason) {
        logPollRejection('timeout', polledData, timeoutRejectionReason);
        return;
      }

      logTimelineSync('poll accepted', {
        fromConfigVersion: configVersionRef.current,
        toConfigVersion: polledData.configVersion,
      });
      logConfigVersionUpdate('poll', polledData.configVersion);
      configVersionRef.current = polledData.configVersion;
      commitDataRef.current(
        dataRef.current ? preserveUploadingClips(dataRef.current, polledData) : polledData,
        { save: false, skipHistory: true, updateLastSavedSignature: true },
      );
    }, 0);

    return () => window.clearTimeout(syncHandle);
  }, [
    configVersionRef,
    dataRef,
    getPollRejectionReason,
    logConfigVersionUpdate,
    logPollRejection,
    logTimelineSync,
    queries.timelineQuery.data,
  ]);

  useEffect(() => {
    const current = dataRef.current;
    const registry = queries.assetRegistryQuery.data;

    if (
      !current
      || !registry
      || !isTimelinePollIdle({
        editSeq: editSeqRef.current,
        savedSeq: savedSeqRef.current,
        pendingOps: pendingOpsRef.current,
        isSaving: isSavingRef.current,
      })
      || registry === lastRegistryDataRef.current
    ) {
      return;
    }

    lastRegistryDataRef.current = registry;

    void buildTimelineData(
      current.config,
      registry,
      (file) => provider.resolveAssetUrl(file),
      current.configVersion,
    ).then((nextData) => {
      if (
        nextData.stableSignature === current.stableSignature
        && Object.keys(nextData.assetMap).length === Object.keys(current.assetMap).length
      ) {
        return;
      }

      const syncHandle = window.setTimeout(() => {
        if (!isTimelinePollIdle({
          editSeq: editSeqRef.current,
          savedSeq: savedSeqRef.current,
          pendingOps: pendingOpsRef.current,
          isSaving: isSavingRef.current,
        })) {
          return;
        }

        commitDataRef.current(nextData, {
          save: false,
          skipHistory: true,
          updateLastSavedSignature: true,
          selectedClipId: selectedClipIdRef.current,
          selectedTrackId: selectedTrackIdRef.current,
        });
      }, 0);

      return () => window.clearTimeout(syncHandle);
    });
  }, [
    dataRef,
    editSeqRef,
    isSavingRef,
    pendingOpsRef,
    provider,
    queries.assetRegistryQuery.data,
    savedSeqRef,
    selectedClipIdRef,
    selectedTrackIdRef,
  ]);
}
