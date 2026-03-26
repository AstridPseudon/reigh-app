import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeEventProcessor } from '@/shared/realtime/RealtimeEventProcessor';
import { assetRegistryQueryKey, timelineQueryKey } from '@/tools/video-editor/hooks/useTimeline';
import { timelineListQueryKey } from '@/tools/video-editor/hooks/useTimelinesList';

interface UseTimelineRealtimeOptions {
  timelineId: string;
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  onDiscardRemoteChanges: () => Promise<void>;
}

export function useTimelineRealtime({
  timelineId,
  saveStatus,
  onDiscardRemoteChanges,
}: UseTimelineRealtimeOptions) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (saveStatus === 'error') {
      setIsOpen(true);
    }
  }, [saveStatus]);

  useEffect(() => {
    return realtimeEventProcessor.onEvent((event) => {
      if (event.type !== 'timelines-updated') {
        return;
      }

      const matching = event.timelines.find((timeline) => timeline.id === timelineId);
      if (!matching) {
        return;
      }

      if (saveStatus !== 'saved') {
        setIsOpen(true);
        return;
      }

      void queryClient.invalidateQueries({ queryKey: timelineQueryKey(timelineId) });
      void queryClient.invalidateQueries({ queryKey: assetRegistryQueryKey(timelineId) });
      void queryClient.invalidateQueries({ queryKey: timelineListQueryKey(matching.projectId) });
    });
  }, [queryClient, saveStatus, timelineId]);

  const keepLocalChanges = useCallback(() => setIsOpen(false), []);

  const discardAndReload = useCallback(async () => {
    setIsOpen(false);
    await onDiscardRemoteChanges();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: timelineQueryKey(timelineId) }),
      queryClient.invalidateQueries({ queryKey: assetRegistryQueryKey(timelineId) }),
    ]);
  }, [onDiscardRemoteChanges, queryClient, timelineId]);

  return {
    isOpen,
    setOpen: setIsOpen,
    keepLocalChanges,
    discardAndReload,
  };
}
